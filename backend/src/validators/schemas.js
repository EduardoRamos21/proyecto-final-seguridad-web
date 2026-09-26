// =============================================================================
// ESQUEMAS DE VALIDACIÓN CON ZOD
// =============================================================================
// Zod es como un "guardia de seguridad" para los datos que nos llegan.
// Antes de procesar cualquier dato del usuario, verificamos que tenga
// el formato correcto, la longitud adecuada y no contenga caracteres peligrosos.
//
// ¿Por qué validar en el servidor también, si ya validamos en el cliente?
// Porque cualquier persona con Postman o Burp Suite puede saltarse el frontend
// y enviar peticiones directamente al servidor con datos maliciosos.
// =============================================================================

const { z } = require('zod');

// ---------------------------------------------------------------
// VALIDACIÓN DE LOGIN
// ---------------------------------------------------------------
const esquemaLogin = z.object({
  // El email debe tener formato válido (contiene @ y dominio)
  // .toLowerCase() normaliza para que "JUAN@GMAIL.COM" y "juan@gmail.com" sean iguales
  email: z
    .string()
    .email({ message: 'Formato de email inválido' })
    .toLowerCase()
    .trim(), // Eliminamos espacios al inicio y final (typos comunes)

  // La contraseña debe tener al menos 8 caracteres
  // No hacemos más validaciones aquí intencionalmente:
  // si alguien pone cualquier cosa, simplemente no coincidirá con el hash guardado
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .max(128, { message: 'Contraseña demasiado larga' }) // Limite para prevenir DoS con contraseñas enormes
});

// ---------------------------------------------------------------
// VALIDACIÓN DE REGISTRO DE USUARIO
// ---------------------------------------------------------------
const esquemaRegistro = z.object({
  // Nombre: solo letras, espacios, tildes y guiones (evitamos caracteres peligrosos como < > " ')
  nombre: z
    .string()
    .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
    .max(100, { message: 'El nombre es demasiado largo' })
    // Regex: solo permite letras (incluyendo letras con tilde), espacios y guiones
    // Esto previene que alguien ponga "<script>alert('xss')</script>" como nombre
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$/, {
      message: 'El nombre solo puede contener letras, espacios y guiones'
    })
    .trim(),

  email: z
    .string()
    .email({ message: 'Formato de email inválido' })
    .toLowerCase()
    .trim(),

  // La contraseña debe ser FUERTE: mayúscula + minúscula + número + símbolo
  // Esto hace que sea muy difícil de adivinar por fuerza bruta
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .max(128, { message: 'Contraseña demasiado larga' })
    // Verificamos que tenga al menos una mayúscula
    .regex(/[A-Z]/, { message: 'La contraseña debe tener al menos una mayúscula' })
    // Verificamos que tenga al menos una minúscula
    .regex(/[a-z]/, { message: 'La contraseña debe tener al menos una minúscula' })
    // Verificamos que tenga al menos un número
    .regex(/[0-9]/, { message: 'La contraseña debe tener al menos un número' })
    // Verificamos que tenga al menos un símbolo especial
    .regex(/[!@#$%^&*(),.?":{}|<>]/, {
      message: 'La contraseña debe tener al menos un símbolo especial'
    }),

  // El rol es opcional en el registro público (siempre será 'user' por seguridad)
  // Solo mencionamos 'admin' para documentar que existe, pero el backend lo ignora en el registro público
  rol: z
    .enum(['user']) // En registro público SOLO se puede crear rol 'user'
    .optional()
    .default('user')
});

// ---------------------------------------------------------------
// VALIDACIÓN DE CREACIÓN DE EXPEDIENTE MÉDICO
// ---------------------------------------------------------------
const esquemaExpediente = z.object({
  // Nombre del paciente: solo texto seguro
  nombre_paciente: z
    .string()
    .min(2, { message: 'Nombre del paciente requerido' })
    .max(150, { message: 'Nombre demasiado largo' })
    .trim(),

  // Diagnóstico: texto libre pero con límite de tamaño para prevenir DoS
  diagnostico: z
    .string()
    .min(5, { message: 'El diagnóstico debe ser descriptivo (mínimo 5 caracteres)' })
    .max(1000, { message: 'Diagnóstico demasiado largo (máximo 1000 caracteres)' })
    .trim(),

  tratamiento: z
    .string()
    .min(5, { message: 'El tratamiento debe ser descriptivo' })
    .max(1000, { message: 'Tratamiento demasiado largo' })
    .trim(),

  // Campos opcionales
  medicamentos: z
    .string()
    .max(500)
    .optional()
    .default(''),

  notas_medico: z
    .string()
    .max(2000)
    .optional()
    .default(''),

  medico_responsable: z
    .string()
    .min(2, { message: 'Médico responsable requerido' })
    .max(150)
    .trim(),

  // La fecha debe tener formato YYYY-MM-DD
  // Esto previene que alguien ponga "' OR '1'='1" como fecha (inyección SQL en fecha)
  fecha_consulta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'La fecha debe tener formato YYYY-MM-DD'
    })
});

// ---------------------------------------------------------------
// VALIDACIÓN DE ACTUALIZACIÓN DE EXPEDIENTE (campos opcionales)
// ---------------------------------------------------------------
// Para actualizar, todos los campos son opcionales (solo se actualizan los que se envían)
const esquemaExpedienteUpdate = esquemaExpediente.partial();

// ---------------------------------------------------------------
// MIDDLEWARE DE VALIDACIÓN GENÉRICO
// ---------------------------------------------------------------
// Esta función devuelve un middleware de Express que valida el body
// según el esquema Zod que le pasemos.
//
// ¿Cómo funciona? Envolvemos la lógica de Zod en un middleware reutilizable
// para no repetir el código de validación en cada ruta.
const validar = (esquema) => {
  return (req, res, next) => {
    try {
      // .parse() valida Y transforma los datos (aplica .trim(), .toLowerCase(), etc.)
      // Si algo es inválido, lanza un ZodError con descripción de qué falló
      const datosValidados = esquema.parse(req.body);
      
      // Reemplazamos req.body con los datos validados y transformados
      // Así en los controladores ya tenemos datos limpios y seguros
      req.body = datosValidados;
      
      // Continuamos al siguiente middleware o controlador
      next();
      
    } catch (error) {
      // Si Zod encontró errores, los formateamos y los devolvemos al cliente
      if (error.name === 'ZodError') {
        // Formateamos los errores de Zod en un mensaje más amigable
        const errores = error.errors.map(err => ({
          campo: err.path.join('.'),
          mensaje: err.message
        }));
        
        // 400 Bad Request: el cliente envió datos inválidos
        return res.status(400).json({
          exito: false,
          mensaje: 'Datos de entrada inválidos',
          errores // Mostramos qué campos fallaron (útil para el frontend)
        });
      }
      
      // Si es otro tipo de error, lo pasamos al manejador de errores global
      next(error);
    }
  };
};

// Exportamos los esquemas y el middleware para usarlos en las rutas
module.exports = {
  esquemaLogin,
  esquemaRegistro,
  esquemaExpediente,
  esquemaExpedienteUpdate,
  validar
};

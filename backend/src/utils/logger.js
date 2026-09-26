// =============================================================================
// SISTEMA DE LOGS DE AUDITORÍA CON WINSTON
// =============================================================================
// Los logs son como la "cámara de seguridad" del sistema.
// Registran todo lo que pasa: quién entró, quién intentó hacer algo raro,
// qué errores ocurrieron, etc.
//
// REGLA DE ORO: Los logs NUNCA deben contener contraseñas, tokens JWT completos,
// datos médicos completos ni información personal sensible.
// Si un atacante accede a los logs, no debe poder robar datos de verdad.
// =============================================================================

require('dotenv').config();
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------
// CONFIGURACIÓN DE CARPETA DE LOGS
// ---------------------------------------------------------------
// Creamos la carpeta 'logs' si no existe
// Separamos los logs del código fuente para facilitar su análisis
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ---------------------------------------------------------------
// FUNCIÓN DE CENSURA DE DATOS SENSIBLES
// ---------------------------------------------------------------
// Esta función recorre el objeto de log y BORRA o enmascara
// cualquier campo que no debería aparecer en los logs.
// Es como tachar información confidencial en un documento.
const censurarDatosSensibles = winston.format((info) => {
  
  // Si el log tiene datos extra (metadata), los revisamos
  if (info.meta) {
    // Clonamos para no modificar el objeto original
    info.meta = { ...info.meta };
    
    // Censuramos la contraseña si por error se incluyó en el log
    if (info.meta.password) {
      info.meta.password = '[CENSURADO]';
    }
    if (info.meta.password_hash) {
      info.meta.password_hash = '[CENSURADO]';
    }
    
    // Censuramos el token JWT completo (solo mostramos los primeros 20 chars)
    // Con eso podemos identificar el token sin exponerlo completo
    if (info.meta.token) {
      info.meta.token = info.meta.token.substring(0, 20) + '...[TRUNCADO]';
    }
    
    // Censuramos datos médicos específicos para proteger privacidad
    // Solo en logs de "acceso general", no en logs de errores de auditoría
    if (info.meta.diagnostico && info.level !== 'audit') {
      info.meta.diagnostico = '[DATO MÉDICO - CENSURADO EN LOG]';
    }
    if (info.meta.tratamiento && info.level !== 'audit') {
      info.meta.tratamiento = '[DATO MÉDICO - CENSURADO EN LOG]';
    }
  }
  
  return info;
});

// ---------------------------------------------------------------
// FORMATO DE LOS LOGS
// ---------------------------------------------------------------
// Definimos cómo se verá cada línea de log
// Queremos: timestamp, nivel, mensaje, y datos extra en JSON
const formatoLog = winston.format.combine(
  // Primero aplicamos la censura
  censurarDatosSensibles(),
  
  // Agregamos timestamp con fecha y hora exacta
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  
  // Formato final: "2024-01-15 14:30:22 [ERROR] Mensaje aquí {"extra": "datos"}"
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Convertimos los datos extra a JSON para que sea fácil de parsear
    const extras = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${extras}`;
  })
);

// ---------------------------------------------------------------
// CREACIÓN DEL LOGGER
// ---------------------------------------------------------------
const logger = winston.createLogger({
  // Nivel mínimo de log: todo lo que sea 'info' o más crítico se guarda
  // Niveles: error > warn > info > http > verbose > debug > silly
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  
  // Aplicamos el formato definido arriba
  format: formatoLog,
  
  // "Transportes": a dónde enviamos los logs
  transports: [
    
    // 1. Archivo para ERRORES solamente
    // Si algo falla gravemente, aquí lo encontraremos
    new winston.transports.File({
      filename: path.join(logsDir, 'errores.log'),
      level: 'error',
      // Rotación: máximo 5MB por archivo, máximo 5 archivos históricos
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
      tailable: true
    }),
    
    // 2. Archivo para TODOS los logs (info, warn, error)
    // Aquí vemos el historial completo de actividad
    new winston.transports.File({
      filename: path.join(logsDir, 'actividad.log'),
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 10,
      tailable: true
    }),
    
    // 3. Archivo específico para AUDITORÍA DE SEGURIDAD
    // Aquí registramos logins, accesos denegados, cambios de datos importantes
    // Este archivo es especialmente importante para detectar ataques
    new winston.transports.File({
      filename: path.join(logsDir, 'auditoria.log'),
      level: 'info',
      maxsize: 20 * 1024 * 1024, // 20 MB - más grande porque hay muchos eventos
      maxFiles: 30, // Guardamos más historial para auditorías
      tailable: true
    })
  ]
});

// ---------------------------------------------------------------
// LOG EN CONSOLA (solo en desarrollo)
// ---------------------------------------------------------------
// En producción no mostramos logs en consola para no llenar la terminal
// y para que los logs queden guardados en archivos
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    // En consola usamos colores para facilitar la lectura
    format: winston.format.combine(
      winston.format.colorize(), // Verde=info, Amarillo=warn, Rojo=error
      formatoLog
    )
  }));
}

// ---------------------------------------------------------------
// FUNCIONES AUXILIARES DE AUDITORÍA
// ---------------------------------------------------------------
// Estas funciones son "atajos" para registrar eventos de seguridad específicos
// con un formato estandarizado y con toda la información necesaria

/**
 * Registra un intento de login exitoso
 * @param {string} email - Email del usuario (no la contraseña!)
 * @param {number} userId - ID del usuario en la base de datos
 * @param {string} ip - Dirección IP del cliente
 * @param {string} rol - Rol del usuario (admin/user)
 */
logger.loginExitoso = (email, userId, ip, rol) => {
  logger.info('LOGIN_EXITOSO', {
    meta: {
      evento: 'LOGIN_EXITOSO',
      email, // Solo el email, NUNCA la contraseña
      userId,
      rol,
      ip,
      // El timestamp lo agrega Winston automáticamente
    }
  });
};

/**
 * Registra un intento de login fallido
 * IMPORTANTE: No registramos la contraseña incorrecta que ingresaron
 * ya que podría ser casi la contraseña correcta (typo de un dígito)
 */
logger.loginFallido = (email, ip, motivo) => {
  logger.warn('LOGIN_FALLIDO', {
    meta: {
      evento: 'LOGIN_FALLIDO',
      email,
      ip,
      motivo // Ej: "contraseña incorrecta", "usuario no existe", "cuenta bloqueada"
      // NO registramos la contraseña ingresada
    }
  });
};

/**
 * Registra cuando se niega el acceso a un recurso (403 Forbidden)
 * Esto puede indicar un intento de IDOR o escalada de privilegios
 */
logger.accesoDenegado = (userId, recurso, ip, motivo) => {
  logger.warn('ACCESO_DENEGADO', {
    meta: {
      evento: 'ACCESO_DENEGADO',
      userId,
      recurso, // Ej: "/api/expedientes/42"
      ip,
      motivo // Ej: "rol insuficiente", "expediente de otro usuario"
    }
  });
};

/**
 * Registra cambios importantes en los datos (crear, editar, eliminar expedientes)
 * Esto sirve para saber quién cambió qué y cuándo
 */
logger.cambioEnDatos = (userId, accion, entidad, entidadId, ip) => {
  logger.info('CAMBIO_EN_DATOS', {
    meta: {
      evento: 'CAMBIO_EN_DATOS',
      userId,
      accion, // Ej: "CREAR", "EDITAR", "ELIMINAR"
      entidad, // Ej: "expediente_medico"
      entidadId, // ID del registro afectado
      ip
      // NO registramos el contenido del expediente (datos médicos sensibles)
    }
  });
};

/**
 * Registra errores de seguridad o comportamientos sospechosos
 */
logger.eventoSospechoso = (descripcion, detalles, ip) => {
  logger.warn('EVENTO_SOSPECHOSO', {
    meta: {
      evento: 'EVENTO_SOSPECHOSO',
      descripcion,
      detalles,
      ip
    }
  });
};

// Exportamos el logger para usarlo en toda la aplicación
module.exports = logger;

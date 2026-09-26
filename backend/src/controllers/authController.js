// =============================================================================
// CONTROLADOR DE AUTENTICACIÓN
// =============================================================================
// Aquí manejamos el registro de usuarios y el inicio de sesión.
// Esta es la parte más crítica de la seguridad: manejar contraseñas y tokens.
// =============================================================================

require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const logger = require('../utils/logger');

// ---------------------------------------------------------------
// REGISTRO DE USUARIO
// ---------------------------------------------------------------
const registrar = async (req, res, next) => {
  
  // req.body ya viene validado por el middleware de Zod (en las rutas)
  // No necesitamos validar de nuevo, pero tampoco confiamos ciegamente
  const { nombre, email, password } = req.body;
  
  try {
    
    // --- PASO 1: Verificar si el email ya está registrado ---
    // Consulta parametrizada para evitar SQL Injection
    const usuarioExistente = db.prepare(
      'SELECT id FROM usuarios WHERE email = ?'
    ).get(email);
    
    if (usuarioExistente) {
      // IMPORTANTE: No decimos "este email ya está registrado"
      // eso permitiría a un atacante enumerar qué emails existen en el sistema.
      // En su lugar, damos un mensaje genérico pero el status 409 (Conflict)
      // indica que hubo conflicto (duplicado) sin revelar datos del usuario.
      return res.status(409).json({
        exito: false,
        mensaje: 'No se pudo completar el registro. Verifique los datos ingresados.'
      });
    }
    
    // --- PASO 2: Hashear la contraseña con bcrypt ---
    // saltRounds: cuántas veces se aplica el algoritmo de hashing.
    // Con 12 rondas, cada hash tarda ~300ms, lo que hace inviable la fuerza bruta.
    // (Un atacante necesitaría miles de años para probar millones de contraseñas)
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    
    // bcrypt.hash() agrega automáticamente una "sal" aleatoria al hash.
    // La sal hace que dos usuarios con la misma contraseña tengan hashes DIFERENTES.
    // Esto evita ataques de "rainbow table" (tablas precalculadas de hashes)
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // --- PASO 3: Guardar el usuario en la base de datos ---
    // Usamos consulta parametrizada, NUNCA concatenamos strings con datos del usuario
    // Todos los nuevos registros son rol 'user' por defecto (no pueden elegir 'admin')
    const resultado = db.prepare(`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES (?, ?, ?, 'user')
    `).run(nombre, email, passwordHash);
    
    // Registramos el evento en los logs de auditoría
    logger.info('REGISTRO_NUEVO_USUARIO', {
      meta: {
        evento: 'REGISTRO_NUEVO_USUARIO',
        usuarioId: resultado.lastInsertRowid,
        email, // El email no es tan sensible como la contraseña
        ip: req.ip
        // NO registramos la contraseña ni el hash
      }
    });
    
    // Respondemos con éxito sin incluir datos sensibles
    return res.status(201).json({
      exito: true,
      mensaje: 'Usuario registrado exitosamente. Ahora puede iniciar sesión.'
    });
    
  } catch (error) {
    // Pasamos el error al manejador centralizado
    next(error);
  }
};

// ---------------------------------------------------------------
// INICIO DE SESIÓN (LOGIN)
// ---------------------------------------------------------------
const login = async (req, res, next) => {
  
  // Los datos ya fueron validados por Zod (formato email, longitud contraseña)
  const { email, password } = req.body;
  
  try {
    
    // --- PASO 1: Buscar al usuario en la base de datos ---
    // Consulta parametrizada para evitar SQL Injection en el email
    const usuario = db.prepare(
      'SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = ?'
    ).get(email);
    
    // --- PASO 2: Verificar contraseña (siempre ejecutamos bcrypt.compare) ---
    // TRUCO DE SEGURIDAD IMPORTANTE:
    // Si el usuario no existe, hacemos bcrypt.compare con un hash falso de todas formas.
    // ¿Por qué? Para que el tiempo de respuesta sea IGUAL si el usuario existe o no.
    // Si no hiciéramos esto, un atacante podría medir el tiempo de respuesta:
    // - Respuesta rápida = email no existe (no necesitó comparar hash)
    // - Respuesta lenta = email existe (tuvo que comparar hash)
    // Esto se llama "timing attack" (ataque de temporización)
    const hashParaComparar = usuario 
      ? usuario.password_hash 
      : '$2b$12$invalidhashfortiminAttackPrevention.FAKEHASHVALUE'; // Hash falso pero del mismo formato
    
    const passwordCorrecta = await bcrypt.compare(password, hashParaComparar);
    
    // --- PASO 3: Verificar si el login fue exitoso ---
    // Verificamos AMBAS condiciones juntas (usuario existe Y contraseña correcta)
    // Si verificáramos por separado y devolviéramos mensajes distintos,
    // revelaríamos si el email existe o no
    if (!usuario || !passwordCorrecta) {
      
      // Registramos el intento fallido para detectar fuerza bruta
      logger.loginFallido(
        email,
        req.ip,
        !usuario ? 'usuario no encontrado' : 'contraseña incorrecta'
      );
      
      // Mensaje GENÉRICO: no decimos si el email existe o si la contraseña está mal
      // Esto previene la enumeración de usuarios
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario o contraseña incorrectos.'
      });
    }
    
    // --- PASO 4: Generar Token JWT ---
    // El token contiene información del usuario pero NO la contraseña
    // jwt.sign() firma el payload con nuestra clave secreta
    const token = jwt.sign(
      {
        // Payload del token: lo que guardamos "dentro" del JWT
        userId: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
        nombre: usuario.nombre
        // NO incluimos la contraseña ni información innecesaria en el token
      },
      process.env.JWT_SECRET, // Clave secreta para firmar
      {
        // El token expira en 15 minutos (configurable por .env)
        // Esto limita el daño si alguien roba el token: en 15 min ya no sirve
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        
        // Issuer: quién emitió el token (nuestro servidor)
        // Esto añade otra capa de verificación
        issuer: 'expedientes-medicos-api'
      }
    );
    
    // Registramos el login exitoso en auditoría
    logger.loginExitoso(usuario.email, usuario.id, req.ip, usuario.rol);
    
    // Respondemos con el token y datos básicos del usuario
    return res.status(200).json({
      exito: true,
      mensaje: 'Inicio de sesión exitoso.',
      token, // El frontend debe guardar esto (en memoria o sessionStorage, NUNCA localStorage)
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
        // NO incluimos password_hash en la respuesta
      }
    });
    
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------
// OBTENER PERFIL DEL USUARIO ACTUAL
// ---------------------------------------------------------------
// Ruta protegida que devuelve los datos del usuario logueado
const obtenerPerfil = (req, res) => {
  // req.user viene del middleware verificarToken (ya fue verificado)
  // No necesitamos ir a la base de datos de nuevo
  res.json({
    exito: true,
    usuario: {
      id: req.user.id,
      nombre: req.user.nombre,
      email: req.user.email,
      rol: req.user.rol
    }
  });
};

module.exports = {
  registrar,
  login,
  obtenerPerfil
};

// =============================================================================
// RUTAS DE AUTENTICACIÓN
// =============================================================================
// Este archivo define las URLs disponibles para registro y login.
// También aplica los middlewares de seguridad específicos para cada ruta.
// =============================================================================

const express = require('express');
const rateLimit = require('express-rate-limit');
const { registrar, login, obtenerPerfil } = require('../controllers/authController');
const { validar, esquemaLogin, esquemaRegistro } = require('../validators/schemas');
const { verificarToken } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------
// RATE LIMITER ESPECÍFICO PARA LOGIN
// ---------------------------------------------------------------
// Este limitador es más estricto que el global porque login es el objetivo
// principal de los ataques de fuerza bruta.
// Si alguien intenta más de 5 veces en 15 minutos desde la misma IP,
// lo bloqueamos temporalmente.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // Ventana de tiempo: 15 minutos
  max: 5,                    // Máximo 5 intentos por IP en esa ventana
  
  // Mensaje cuando se supera el límite
  message: {
    exito: false,
    mensaje: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.'
  },
  
  // Estas opciones ayudan al cliente a saber cuándo puede intentar de nuevo
  standardHeaders: true,   // Envía cabeceras RateLimit-* en la respuesta
  legacyHeaders: false,    // No usar las cabeceras X-RateLimit-* antiguas
  
  // Función que se ejecuta cuando alguien supera el límite
  // Registramos esto como evento sospechoso
  handler: (req, res, next, options) => {
    logger.eventoSospechoso(
      'Rate limit de login superado',
      { intentosFallidos: options.max },
      req.ip
    );
    // Enviamos la respuesta del rate limiter
    res.status(options.statusCode).json(options.message);
  }
});

// ---------------------------------------------------------------
// RATE LIMITER PARA REGISTRO
// ---------------------------------------------------------------
// También limitamos el registro para evitar que alguien cree miles de cuentas
const registroRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,                   // Máximo 10 registros por IP por hora
  message: {
    exito: false,
    mensaje: 'Demasiados registros desde esta IP. Intente más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ---------------------------------------------------------------
// DEFINICIÓN DE RUTAS
// ---------------------------------------------------------------

// POST /api/auth/register
// Ruta pública para crear nuevas cuentas
// Cadena de middlewares: registroRateLimit → validar(esquema) → controlador
router.post(
  '/register',
  registroRateLimit,           // 1. Limitamos la cantidad de registros
  validar(esquemaRegistro),    // 2. Validamos y sanitizamos los datos con Zod
  registrar                    // 3. Procesamos el registro
);

// POST /api/auth/login
// Ruta pública para iniciar sesión y obtener el JWT
router.post(
  '/login',
  loginRateLimit,              // 1. Limitamos intentos (anti fuerza bruta)
  validar(esquemaLogin),       // 2. Validamos formato del email y longitud del password
  login                        // 3. Verificamos credenciales y devolvemos JWT
);

// GET /api/auth/perfil
// Ruta PROTEGIDA: devuelve los datos del usuario autenticado
// verificarToken verifica el JWT antes de pasar al controlador
router.get(
  '/perfil',
  verificarToken,              // 1. Verificamos que el JWT sea válido
  obtenerPerfil                // 2. Devolvemos los datos del perfil
);

module.exports = router;

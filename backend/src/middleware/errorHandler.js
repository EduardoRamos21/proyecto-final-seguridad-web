// =============================================================================
// MANEJADOR CENTRALIZADO DE ERRORES
// =============================================================================
// En Express, cuando un middleware llama a next(error), el error llega aquí.
// Este manejador es el "último recurso" antes de responder al cliente.
//
// ¿Por qué centralizar el manejo de errores?
// Para asegurarnos de que en PRODUCCIÓN nunca devolvamos información técnica
// al cliente (como stack traces, nombres de archivos, versiones de librerías).
// Esa información ayuda a los atacantes a encontrar vulnerabilidades.
// =============================================================================

const logger = require('../utils/logger');

// En Express, los manejadores de error tienen 4 parámetros: (err, req, res, next)
// El cuarto parámetro 'next' es lo que los identifica como manejadores de error
const errorHandler = (err, req, res, next) => {
  
  // Determinamos el código de estado HTTP a devolver
  // Si el error ya tiene un statusCode definido, lo usamos; si no, 500 (error interno)
  const statusCode = err.statusCode || err.status || 500;
  
  // ---------------------------------------------------------------
  // SIEMPRE registramos el error completo en los LOGS del servidor
  // Los logs son para nosotros (los desarrolladores), no para el cliente
  // ---------------------------------------------------------------
  logger.error('Error capturado por manejador centralizado', {
    meta: {
      // Guardamos toda la info técnica en el log para poder depurar
      statusCode,
      mensaje: err.message,
      // Stack trace solo en development para no saturar los logs en producción
      stack: process.env.NODE_ENV !== 'production' ? err.stack : '[stack omitido en producción]',
      ruta: req.path,
      metodo: req.method,
      ip: req.ip,
      // Si hay usuario autenticado, registramos su ID para saber quién causó el error
      usuarioId: req.user ? req.user.id : 'no autenticado'
    }
  });
  
  // ---------------------------------------------------------------
  // RESPUESTA AL CLIENTE según el entorno
  // En producción: mensaje genérico (no revelamos nada técnico)
  // En desarrollo: mensaje completo para facilitar la depuración
  // ---------------------------------------------------------------
  
  if (process.env.NODE_ENV === 'production') {
    // EN PRODUCCIÓN: Siempre respondemos con mensajes genéricos
    // Esto es CRÍTICO para no revelar información a los atacantes
    
    // Para errores de cliente (4xx) podemos dar más detalles
    if (statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({
        exito: false,
        mensaje: err.message || 'Solicitud inválida'
      });
    }
    
    // Para errores del servidor (5xx) damos mensaje COMPLETAMENTE genérico
    // No revelamos qué salió mal internamente
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor. Por favor, intente más tarde.'
      // NUNCA enviamos: err.message, err.stack, nombres de archivos, etc.
    });
    
  } else {
    // EN DESARROLLO: Podemos dar más detalles para facilitar la depuración
    // Pero NUNCA desplegar con NODE_ENV=development en un servidor real
    return res.status(statusCode).json({
      exito: false,
      mensaje: err.message || 'Error interno del servidor',
      // En desarrollo mostramos el stack trace para depurar más fácil
      stack: err.stack,
      detalles: 'Este detalle solo se muestra en development. En producción se ocultará.'
    });
  }
};

// ---------------------------------------------------------------
// MANEJADOR DE RUTAS NO ENCONTRADAS (404)
// ---------------------------------------------------------------
// Si una petición llega y no coincide con ninguna ruta definida,
// enviamos un 404 en lugar de dejar que Express devuelva su respuesta por defecto
// (que puede revelar información del servidor)
const notFoundHandler = (req, res) => {
  logger.warn('Ruta no encontrada', {
    meta: {
      ruta: req.path,
      metodo: req.method,
      ip: req.ip
    }
  });
  
  res.status(404).json({
    exito: false,
    mensaje: 'El recurso solicitado no existe.'
    // No revelamos qué rutas SÍ existen (eso ayudaría al atacante a mapear la API)
  });
};

module.exports = { errorHandler, notFoundHandler };

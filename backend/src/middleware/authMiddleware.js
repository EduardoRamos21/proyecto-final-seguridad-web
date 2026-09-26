// =============================================================================
// MIDDLEWARES DE AUTENTICACIÓN Y CONTROL DE ACCESO
// =============================================================================
// Estos middlewares son como los "guardias de seguridad" del servidor.
// Cada petición que llegue a rutas protegidas pasa por aquí PRIMERO,
// antes de llegar al controlador que tiene la lógica del negocio.
// =============================================================================

require('dotenv').config();
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const db = require('../database/db');

// ---------------------------------------------------------------
// MIDDLEWARE 1: VERIFICAR TOKEN JWT
// ---------------------------------------------------------------
// Este middleware verifica que el cliente envíe un token JWT válido
// en la cabecera Authorization de cada petición protegida.
//
// Flujo: Cliente envía "Authorization: Bearer eyJhbGc..." → 
//        Verificamos la firma → Si es válido, guardamos el usuario en req.user
const verificarToken = (req, res, next) => {
  
  // Obtenemos la cabecera Authorization
  // Formato esperado: "Bearer <token>"
  const cabecera = req.headers['authorization'];
  
  // Si no hay cabecera, el usuario no mandó ningún token
  if (!cabecera) {
    // Registramos el acceso sin token (puede ser un bot o alguien probando)
    logger.warn('Petición sin token JWT', { 
      meta: { ruta: req.path, ip: req.ip, metodo: req.method }
    });
    
    // 401 Unauthorized: no sabemos quién eres
    return res.status(401).json({
      exito: false,
      mensaje: 'Acceso no autorizado. Se requiere autenticación.'
    });
  }
  
  // El formato debe ser "Bearer TOKEN"
  // Dividimos por espacio y tomamos la segunda parte (el token en sí)
  const partes = cabecera.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    return res.status(401).json({
      exito: false,
      mensaje: 'Formato de token inválido. Use: Bearer <token>'
    });
  }
  
  const token = partes[1];
  
  try {
    // Verificamos el token usando la clave secreta
    // jwt.verify() hace DOS cosas a la vez:
    // 1. Verifica la FIRMA: que el token fue creado por nuestro servidor
    // 2. Verifica que no esté EXPIRADO
    // Si alguna falla, lanza un error
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Guardamos la información del usuario en req para usarla en los controladores
    // Esto es seguro porque viene del payload VERIFICADO del JWT
    req.user = {
      id: payload.userId,
      email: payload.email,
      rol: payload.rol,
      nombre: payload.nombre
    };
    
    // Pasamos al siguiente middleware o controlador
    next();
    
  } catch (error) {
    
    // jwt.verify() puede lanzar diferentes tipos de error:
    
    if (error.name === 'TokenExpiredError') {
      // El token expiró: el usuario debe hacer login de nuevo
      // Esto es seguridad intencional: tokens cortos minimizan el daño si se roban
      return res.status(401).json({
        exito: false,
        mensaje: 'La sesión ha expirado. Por favor, inicie sesión de nuevo.',
        codigo: 'TOKEN_EXPIRADO' // El frontend puede usar este código para redirigir al login
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      // El token está malformado o la firma no coincide (posible intento de falsificación)
      logger.eventoSospechoso(
        'Token JWT inválido/falsificado',
        { error: error.message },
        req.ip
      );
      
      return res.status(401).json({
        exito: false,
        mensaje: 'Token inválido.'
      });
    }
    
    // Otro error inesperado, lo pasamos al manejador global
    next(error);
  }
};

// ---------------------------------------------------------------
// MIDDLEWARE 2: VERIFICAR ROL (Control de Acceso Basado en Roles - RBAC)
// ---------------------------------------------------------------
// Esta función DEVUELVE un middleware configurado para verificar un rol específico.
// Uso: router.get('/admin/todo', verificarToken, requireRole('admin'), controlador)
//
// DOBLE VERIFICACIÓN: aunque el frontend oculte rutas de admin, el servidor
// SIEMPRE verifica el rol. Un atacante podría enviar peticiones directas al API.
const requireRole = (...rolesPermitidos) => {
  return (req, res, next) => {
    
    // Este middleware SIEMPRE debe ir DESPUÉS de verificarToken
    // Si req.user no existe, significa que verificarToken no se ejecutó
    if (!req.user) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Autenticación requerida'
      });
    }
    
    // Verificamos si el rol del usuario está en la lista de roles permitidos
    if (!rolesPermitidos.includes(req.user.rol)) {
      // Registramos el intento de escalada de privilegios
      logger.accesoDenegado(
        req.user.id,
        req.path,
        req.ip,
        `Rol '${req.user.rol}' no tiene permiso. Se requiere: ${rolesPermitidos.join(' o ')}`
      );
      
      // 403 Forbidden: sabemos quién eres, pero no tienes permiso
      // No damos detalles de qué rol se requiere (información que podría usar un atacante)
      return res.status(403).json({
        exito: false,
        mensaje: 'No tienes permiso para realizar esta acción.'
      });
    }
    
    // El usuario tiene el rol correcto, continuamos
    next();
  };
};

// ---------------------------------------------------------------
// MIDDLEWARE 3: VERIFICAR PROPIEDAD DEL EXPEDIENTE (Anti-IDOR)
// ---------------------------------------------------------------
// IDOR = Insecure Direct Object Reference
// Es cuando alguien cambia el ID en la URL para acceder a datos de otro usuario.
// Ejemplo: yo tengo expediente ID=5, pero accedo a /api/expedientes/99 (de otro)
//
// Este middleware verifica que el expediente solicitado pertenezca al usuario
// que hace la petición. Los admins pueden ver todos los expedientes.
const verificarPropietario = (req, res, next) => {
  
  if (!req.user) {
    return res.status(401).json({ exito: false, mensaje: 'Autenticación requerida' });
  }
  
  // Si el usuario es admin, puede acceder a cualquier expediente
  // Los admins no tienen restricción de propiedad
  if (req.user.rol === 'admin') {
    return next();
  }
  
  // Para usuarios normales, verificamos que el expediente sea de ellos
  const expedienteId = parseInt(req.params.id);
  
  // Verificamos que el ID sea un número válido (previene inyecciones con IDs raros)
  if (isNaN(expedienteId) || expedienteId <= 0) {
    return res.status(400).json({
      exito: false,
      mensaje: 'ID de expediente inválido'
    });
  }
  
  // Consultamos la base de datos para verificar el dueño del expediente
  // Consulta PARAMETRIZADA con ? para evitar SQL Injection en el ID
  const expediente = db.prepare(
    'SELECT usuario_id FROM expedientes_medicos WHERE id = ?'
  ).get(expedienteId);
  
  // Si el expediente no existe, devolvemos 404 (no existe)
  if (!expediente) {
    return res.status(404).json({
      exito: false,
      mensaje: 'Expediente no encontrado'
    });
  }
  
  // VERIFICACIÓN ANTI-IDOR: ¿el expediente pertenece al usuario logueado?
  if (expediente.usuario_id !== req.user.id) {
    // Registramos este intento como sospechoso
    logger.accesoDenegado(
      req.user.id,
      `expediente #${expedienteId}`,
      req.ip,
      `Intento IDOR: expediente pertenece a usuario #${expediente.usuario_id}`
    );
    
    // 403 Forbidden: no tienes permiso para ver el expediente de otro
    // No decimos "el expediente existe pero es de otro" (info innecesaria)
    // Decimos simplemente que no tiene permiso
    return res.status(403).json({
      exito: false,
      mensaje: 'No tienes permiso para acceder a este expediente.'
    });
  }
  
  // El expediente sí pertenece al usuario, continuamos
  next();
};

// Exportamos los tres middlewares para usarlos en las rutas
module.exports = {
  verificarToken,
  requireRole,
  verificarPropietario
};

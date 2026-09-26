// =============================================================================
// RUTAS DE EXPEDIENTES MÉDICOS
// =============================================================================
// Aquí definimos qué métodos HTTP están disponibles para los expedientes,
// y qué middlewares de seguridad se aplican a cada uno.
// =============================================================================

const express = require('express');
const {
  listarExpedientes,
  obtenerExpediente,
  crearExpediente,
  actualizarExpediente,
  listarUsuarios
} = require('../controllers/expedientesController');
const { verificarToken, requireRole, verificarPropietario } = require('../middleware/authMiddleware');
const { validar, esquemaExpediente, esquemaExpedienteUpdate } = require('../validators/schemas');

const router = express.Router();

// ---------------------------------------------------------------
// TODAS LAS RUTAS REQUIEREN AUTENTICACIÓN (JWT válido)
// ---------------------------------------------------------------
// Aplicamos verificarToken a TODAS las rutas de este router.
// Si el token es inválido o no existe, ninguna ruta será accesible.
// Esto evita que accesos anónimos puedan ver datos médicos.
router.use(verificarToken);

// ---------------------------------------------------------------
// GET /api/expedientes
// ---------------------------------------------------------------
// Admin: lista todos los expedientes del sistema
// User: lista solo SUS expedientes
// La lógica de filtrado está en el controlador (verifica req.user.rol)
router.get('/', listarExpedientes);

// ---------------------------------------------------------------
// GET /api/expedientes/:id
// ---------------------------------------------------------------
// Obtiene UN expediente específico.
// verificarPropietario: ANTES de llegar al controlador, verifica que:
//   - Si es admin: puede ver cualquier expediente
//   - Si es user: el expediente DEBE ser suyo (anti-IDOR)
router.get(
  '/:id',
  verificarPropietario,  // Anti-IDOR: verifica propiedad del expediente
  obtenerExpediente
);

// ---------------------------------------------------------------
// POST /api/expedientes
// ---------------------------------------------------------------
// Solo los administradores pueden crear nuevos expedientes
// requireRole('admin') bloquea a cualquier usuario con rol 'user'
router.post(
  '/',
  requireRole('admin'),          // Solo admins
  validar(esquemaExpediente),    // Validamos todos los campos requeridos
  crearExpediente
);

// ---------------------------------------------------------------
// PUT /api/expedientes/:id
// ---------------------------------------------------------------
// Actualiza un expediente existente (solo admin)
router.put(
  '/:id',
  requireRole('admin'),           // Solo admins
  validar(esquemaExpedienteUpdate), // Validamos campos (todos opcionales en update)
  actualizarExpediente
);

// ---------------------------------------------------------------
// GET /api/expedientes/admin/usuarios
// ---------------------------------------------------------------
// Lista todos los usuarios del sistema (solo para admin)
// Necesario para que el admin pueda asignar expedientes a usuarios
router.get(
  '/admin/usuarios',
  requireRole('admin'),  // Solo admins
  listarUsuarios
);

module.exports = router;

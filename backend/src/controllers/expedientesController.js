// =============================================================================
// CONTROLADOR DE EXPEDIENTES MÉDICOS
// =============================================================================
// Aquí manejamos todas las operaciones CRUD de expedientes médicos.
// La seguridad ya fue verificada por los middlewares ANTES de llegar aquí:
// - verificarToken: confirmó que el usuario está autenticado
// - requireRole: confirmó que el usuario tiene el rol correcto
// - verificarPropietario: confirmó que el expediente pertenece al usuario (anti-IDOR)
//
// Este controlador SOLO maneja la lógica del negocio, no la seguridad.
// =============================================================================

const db = require('../database/db');
const logger = require('../utils/logger');

// ---------------------------------------------------------------
// LISTAR EXPEDIENTES
// ---------------------------------------------------------------
// Admin: ve todos los expedientes del sistema
// Usuario normal: solo ve SUS expedientes
const listarExpedientes = (req, res, next) => {
  try {
    let expedientes;
    
    if (req.user.rol === 'admin') {
      // Los administradores pueden ver TODOS los expedientes
      // Incluimos JOIN con usuarios para mostrar el nombre del paciente
      // Consulta parametrizada (aunque aquí no hay input del usuario, es buena práctica)
      expedientes = db.prepare(`
        SELECT 
          e.id,
          e.nombre_paciente,
          e.diagnostico,
          e.tratamiento,
          e.medicamentos,
          e.medico_responsable,
          e.fecha_consulta,
          e.created_at,
          e.updated_at,
          u.email as email_paciente,
          u.nombre as nombre_usuario
        FROM expedientes_medicos e
        JOIN usuarios u ON e.usuario_id = u.id
        ORDER BY e.created_at DESC
      `).all();
      
    } else {
      // Los usuarios normales solo ven sus propios expedientes
      // El ? recibe el ID del usuario autenticado (viene del JWT verificado)
      // Esto es la protección anti-IDOR: el usuario no puede cambiar este ID
      expedientes = db.prepare(`
        SELECT 
          id,
          nombre_paciente,
          diagnostico,
          tratamiento,
          medicamentos,
          notas_medico,
          medico_responsable,
          fecha_consulta,
          created_at,
          updated_at
        FROM expedientes_medicos
        WHERE usuario_id = ?
        ORDER BY fecha_consulta DESC
      `).all(req.user.id);
    }
    
    res.json({
      exito: true,
      total: expedientes.length,
      expedientes
    });
    
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------
// OBTENER UN EXPEDIENTE ESPECÍFICO
// ---------------------------------------------------------------
// La verificación de propiedad ya se hizo en el middleware verificarPropietario
// Aquí solo obtenemos y devolvemos el expediente
const obtenerExpediente = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Consulta parametrizada: el ? recibe el ID de la URL
    // La verificación de que es el dueño ya se hizo ANTES en el middleware
    const expediente = db.prepare(`
      SELECT 
        e.*,
        u.nombre as nombre_usuario,
        u.email as email_usuario
      FROM expedientes_medicos e
      JOIN usuarios u ON e.usuario_id = u.id
      WHERE e.id = ?
    `).get(parseInt(id));
    
    if (!expediente) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Expediente no encontrado'
      });
    }
    
    res.json({
      exito: true,
      expediente
    });
    
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------
// CREAR NUEVO EXPEDIENTE
// ---------------------------------------------------------------
// Solo accesible para administradores (verificado en las rutas con requireRole)
const crearExpediente = (req, res, next) => {
  try {
    // Los datos ya fueron validados y sanitizados por el middleware de Zod
    const {
      nombre_paciente,
      diagnostico,
      tratamiento,
      medicamentos,
      notas_medico,
      medico_responsable,
      fecha_consulta,
      usuario_id // El admin puede especificar a qué usuario pertenece el expediente
    } = req.body;
    
    // Verificamos que el usuario al que se asignará el expediente existe
    const usuarioDestino = db.prepare(
      'SELECT id FROM usuarios WHERE id = ?'
    ).get(usuario_id);
    
    if (!usuarioDestino) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El usuario especificado no existe'
      });
    }
    
    // Inserción con consulta COMPLETAMENTE parametrizada
    // Todos los valores vienen de los parámetros ?, nunca se concatenan strings
    const resultado = db.prepare(`
      INSERT INTO expedientes_medicos 
      (usuario_id, nombre_paciente, diagnostico, tratamiento, medicamentos, notas_medico, medico_responsable, fecha_consulta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id,
      nombre_paciente,
      diagnostico,
      tratamiento,
      medicamentos || '',
      notas_medico || '',
      medico_responsable,
      fecha_consulta
    );
    
    // Registramos la creación en el log de auditoría
    // IMPORTANTE: Solo registramos metadatos (quién, cuándo, qué ID),
    // NO el contenido del expediente (datos médicos sensibles)
    logger.cambioEnDatos(
      req.user.id,
      'CREAR',
      'expediente_medico',
      resultado.lastInsertRowid,
      req.ip
    );
    
    return res.status(201).json({
      exito: true,
      mensaje: 'Expediente médico creado exitosamente.',
      expedienteId: resultado.lastInsertRowid
    });
    
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------
// ACTUALIZAR EXPEDIENTE
// ---------------------------------------------------------------
const actualizarExpediente = (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Los datos ya fueron validados por Zod (esquemaExpedienteUpdate, campos opcionales)
    const {
      nombre_paciente,
      diagnostico,
      tratamiento,
      medicamentos,
      notas_medico,
      medico_responsable,
      fecha_consulta
    } = req.body;
    
    // Verificamos que el expediente existe antes de actualizarlo
    const expedienteExistente = db.prepare(
      'SELECT id FROM expedientes_medicos WHERE id = ?'
    ).get(parseInt(id));
    
    if (!expedienteExistente) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Expediente no encontrado'
      });
    }
    
    // Actualizamos con consulta parametrizada
    // updated_at se actualiza automáticamente para saber cuándo fue el último cambio
    db.prepare(`
      UPDATE expedientes_medicos SET
        nombre_paciente    = COALESCE(?, nombre_paciente),
        diagnostico        = COALESCE(?, diagnostico),
        tratamiento        = COALESCE(?, tratamiento),
        medicamentos       = COALESCE(?, medicamentos),
        notas_medico       = COALESCE(?, notas_medico),
        medico_responsable = COALESCE(?, medico_responsable),
        fecha_consulta     = COALESCE(?, fecha_consulta),
        updated_at         = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      nombre_paciente || null,
      diagnostico || null,
      tratamiento || null,
      medicamentos !== undefined ? medicamentos : null,
      notas_medico !== undefined ? notas_medico : null,
      medico_responsable || null,
      fecha_consulta || null,
      parseInt(id)
    );
    
    // Registramos la actualización en auditoría (sin datos médicos)
    logger.cambioEnDatos(req.user.id, 'ACTUALIZAR', 'expediente_medico', id, req.ip);
    
    return res.json({
      exito: true,
      mensaje: 'Expediente actualizado exitosamente.'
    });
    
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------
// LISTAR TODOS LOS USUARIOS (solo admin)
// ---------------------------------------------------------------
// Para que el admin pueda asignar expedientes a usuarios específicos
const listarUsuarios = (req, res, next) => {
  try {
    // Solo obtenemos datos no sensibles (NO el password_hash)
    const usuarios = db.prepare(`
      SELECT id, nombre, email, rol, created_at
      FROM usuarios
      ORDER BY created_at DESC
    `).all();
    
    res.json({
      exito: true,
      total: usuarios.length,
      usuarios
    });
    
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listarExpedientes,
  obtenerExpediente,
  crearExpediente,
  actualizarExpediente,
  listarUsuarios
};

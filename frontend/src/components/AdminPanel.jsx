// =============================================================================
// COMPONENTE: PANEL DE ADMINISTRACIÓN (rol: admin)
// =============================================================================
// Solo accesible para usuarios con rol 'admin'.
// Permite: ver todos los expedientes, crear nuevos, editar existentes.
// La verificación del rol ocurre en DOS lugares:
//   1. PrivateRoute (frontend): oculta la ruta si no es admin
//   2. Backend middleware requireRole('admin'): rechaza peticiones no-admin
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { expedientesAPI } from '../api/client';

// Formulario inicial vacío para crear expedientes
const FORM_INICIAL = {
  usuario_id: '',
  nombre_paciente: '',
  diagnostico: '',
  tratamiento: '',
  medicamentos: '',
  notas_medico: '',
  medico_responsable: '',
  fecha_consulta: ''
};

const AdminPanel = () => {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  
  // Estado de datos
  const [expedientes, setExpedientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  
  // Estado del modal de creación/edición
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [expedienteEditando, setExpedienteEditando] = useState(null);
  const [formData, setFormData] = useState(FORM_INICIAL);
  const [erroresForm, setErroresForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  
  // Vista activa (expedientes o usuarios)
  const [vistaActiva, setVistaActiva] = useState('expedientes');
  
  // ---------------------------------------------------------------
  // CARGAR DATOS AL MONTAR
  // ---------------------------------------------------------------
  useEffect(() => {
    cargarDatos();
  }, []);
  
  const cargarDatos = async () => {
    setCargando(true);
    setError('');
    try {
      // Cargamos expedientes y usuarios en paralelo
      const [respExpedientes, respUsuarios] = await Promise.all([
        expedientesAPI.listar(),
        expedientesAPI.listarUsuarios()
      ]);
      setExpedientes(respExpedientes.data.expedientes || []);
      setUsuarios(respUsuarios.data.usuarios || []);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Acceso denegado. Solo los administradores pueden ver esta página.');
      } else {
        setError('Error al cargar los datos.');
      }
    } finally {
      setCargando(false);
    }
  };
  
  // ---------------------------------------------------------------
  // VALIDACIÓN DEL FORMULARIO
  // ---------------------------------------------------------------
  const validarForm = () => {
    const errores = {};
    if (!formData.usuario_id) errores.usuario_id = 'Selecciona un paciente';
    if (!formData.nombre_paciente.trim()) errores.nombre_paciente = 'Campo requerido';
    if (!formData.diagnostico.trim()) errores.diagnostico = 'Campo requerido';
    if (!formData.tratamiento.trim()) errores.tratamiento = 'Campo requerido';
    if (!formData.medico_responsable.trim()) errores.medico_responsable = 'Campo requerido';
    if (!formData.fecha_consulta) errores.fecha_consulta = 'Campo requerido';
    setErroresForm(errores);
    return Object.keys(errores).length === 0;
  };
  
  // ---------------------------------------------------------------
  // CREAR O EDITAR EXPEDIENTE
  // ---------------------------------------------------------------
  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!validarForm()) return;
    
    setGuardando(true);
    setMensaje('');
    
    try {
      if (modoEdicion && expedienteEditando) {
        await expedientesAPI.actualizar(expedienteEditando.id, formData);
        setMensaje('✅ Expediente actualizado correctamente');
      } else {
        await expedientesAPI.crear(formData);
        setMensaje('✅ Expediente creado correctamente');
      }
      
      setMostrarModal(false);
      setFormData(FORM_INICIAL);
      setModoEdicion(false);
      setExpedienteEditando(null);
      
      // Recargamos la lista
      await cargarDatos();
      
    } catch (err) {
      const msg = err.response?.data?.mensaje || 'Error al guardar el expediente';
      setMensaje(`❌ ${msg}`);
    } finally {
      setGuardando(false);
    }
  };
  
  const abrirCrear = () => {
    setFormData(FORM_INICIAL);
    setErroresForm({});
    setModoEdicion(false);
    setExpedienteEditando(null);
    setMostrarModal(true);
  };
  
  const abrirEditar = (exp) => {
    setFormData({
      usuario_id: exp.usuario_id || '',
      nombre_paciente: exp.nombre_paciente || '',
      diagnostico: exp.diagnostico || '',
      tratamiento: exp.tratamiento || '',
      medicamentos: exp.medicamentos || '',
      notas_medico: exp.notas_medico || '',
      medico_responsable: exp.medico_responsable || '',
      fecha_consulta: exp.fecha_consulta || ''
    });
    setErroresForm({});
    setModoEdicion(true);
    setExpedienteEditando(exp);
    setMostrarModal(true);
  };
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };
  
  return (
    <div className="app-layout">
      {/* ---- BARRA SUPERIOR ---- */}
      <header className="app-header admin-header">
        <div className="header-left">
          <span className="header-icon">🏥</span>
          <h1>Panel de Administración</h1>
        </div>
        <div className="header-right">
          <span className="user-badge">👑 {usuario?.nombre}</span>
          <span className="role-badge role-admin">Administrador</span>
          <button onClick={handleLogout} className="btn-logout">Cerrar Sesión</button>
        </div>
      </header>
      
      {/* ---- NAVEGACIÓN LATERAL ---- */}
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <nav>
            <button
              className={`sidebar-btn ${vistaActiva === 'expedientes' ? 'active' : ''}`}
              onClick={() => setVistaActiva('expedientes')}
            >
              📋 Expedientes
            </button>
            <button
              className={`sidebar-btn ${vistaActiva === 'usuarios' ? 'active' : ''}`}
              onClick={() => setVistaActiva('usuarios')}
            >
              👥 Usuarios
            </button>
          </nav>
        </aside>
        
        {/* ---- CONTENIDO PRINCIPAL ---- */}
        <main className="admin-main">
          
          {/* Mensaje de éxito/error */}
          {mensaje && (
            <div className={`alert ${mensaje.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>
              {mensaje}
              <button onClick={() => setMensaje('')} className="close-alert">✕</button>
            </div>
          )}
          
          {cargando && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Cargando datos...</p>
            </div>
          )}
          
          {error && (
            <div className="alert alert-error">⚠️ {error}</div>
          )}
          
          {/* ---- VISTA: EXPEDIENTES ---- */}
          {!cargando && !error && vistaActiva === 'expedientes' && (
            <>
              <div className="section-header">
                <h2>Todos los Expedientes Médicos</h2>
                <button onClick={abrirCrear} className="btn-primary">
                  + Nuevo Expediente
                </button>
              </div>
              
              <div className="stats-bar">
                <span>Total: <strong>{expedientes.length}</strong> expedientes</span>
              </div>
              
              {expedientes.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📋</span>
                  <p>No hay expedientes registrados aún.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Paciente</th>
                        <th>Diagnóstico</th>
                        <th>Médico</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expedientes.map(exp => (
                        <tr key={exp.id}>
                          <td>#{exp.id}</td>
                          <td>
                            <div>{exp.nombre_paciente}</div>
                            <small className="text-muted">{exp.email_paciente}</small>
                          </td>
                          <td>{exp.diagnostico.substring(0, 60)}{exp.diagnostico.length > 60 ? '...' : ''}</td>
                          <td>{exp.medico_responsable}</td>
                          <td>{formatearFecha(exp.fecha_consulta)}</td>
                          <td>
                            <button 
                              onClick={() => abrirEditar(exp)} 
                              className="btn-secondary btn-small"
                            >
                              ✏️ Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          
          {/* ---- VISTA: USUARIOS ---- */}
          {!cargando && !error && vistaActiva === 'usuarios' && (
            <>
              <div className="section-header">
                <h2>Usuarios del Sistema</h2>
              </div>
              
              <div className="stats-bar">
                <span>Total: <strong>{usuarios.length}</strong> usuarios registrados</span>
              </div>
              
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Registrado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td>{u.nombre}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`role-badge ${u.rol === 'admin' ? 'role-admin' : 'role-user'}`}>
                            {u.rol === 'admin' ? '👑 Admin' : '👤 Paciente'}
                          </span>
                        </td>
                        <td>{formatearFecha(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
      
      {/* ---- MODAL: CREAR / EDITAR EXPEDIENTE ---- */}
      {mostrarModal && (
        <div className="modal-overlay" onClick={() => setMostrarModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modoEdicion ? '✏️ Editar Expediente' : '+ Nuevo Expediente'}</h3>
              <button className="modal-close" onClick={() => setMostrarModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleGuardar} className="modal-form">
              {/* Selector de paciente */}
              {!modoEdicion && (
                <div className="form-group">
                  <label>Paciente *</label>
                  <select
                    value={formData.usuario_id}
                    onChange={e => setFormData(p => ({ ...p, usuario_id: parseInt(e.target.value) }))}
                    className={erroresForm.usuario_id ? 'input-error' : ''}
                  >
                    <option value="">-- Seleccionar paciente --</option>
                    {usuarios.filter(u => u.rol === 'user').map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.email})</option>
                    ))}
                  </select>
                  {erroresForm.usuario_id && <span className="error-msg">{erroresForm.usuario_id}</span>}
                </div>
              )}
              
              {/* Grid de dos columnas para los campos */}
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre del Paciente *</label>
                  <input
                    type="text"
                    value={formData.nombre_paciente}
                    onChange={e => setFormData(p => ({ ...p, nombre_paciente: e.target.value }))}
                    className={erroresForm.nombre_paciente ? 'input-error' : ''}
                    placeholder="Nombre completo"
                  />
                  {erroresForm.nombre_paciente && <span className="error-msg">{erroresForm.nombre_paciente}</span>}
                </div>
                
                <div className="form-group">
                  <label>Médico Responsable *</label>
                  <input
                    type="text"
                    value={formData.medico_responsable}
                    onChange={e => setFormData(p => ({ ...p, medico_responsable: e.target.value }))}
                    className={erroresForm.medico_responsable ? 'input-error' : ''}
                    placeholder="Dr. Nombre Apellido"
                  />
                  {erroresForm.medico_responsable && <span className="error-msg">{erroresForm.medico_responsable}</span>}
                </div>
                
                <div className="form-group">
                  <label>Fecha de Consulta *</label>
                  <input
                    type="date"
                    value={formData.fecha_consulta}
                    onChange={e => setFormData(p => ({ ...p, fecha_consulta: e.target.value }))}
                    className={erroresForm.fecha_consulta ? 'input-error' : ''}
                  />
                  {erroresForm.fecha_consulta && <span className="error-msg">{erroresForm.fecha_consulta}</span>}
                </div>
              </div>
              
              <div className="form-group">
                <label>Diagnóstico *</label>
                <textarea
                  rows={3}
                  value={formData.diagnostico}
                  onChange={e => setFormData(p => ({ ...p, diagnostico: e.target.value }))}
                  className={erroresForm.diagnostico ? 'input-error' : ''}
                  placeholder="Describe el diagnóstico..."
                />
                {erroresForm.diagnostico && <span className="error-msg">{erroresForm.diagnostico}</span>}
              </div>
              
              <div className="form-group">
                <label>Tratamiento *</label>
                <textarea
                  rows={3}
                  value={formData.tratamiento}
                  onChange={e => setFormData(p => ({ ...p, tratamiento: e.target.value }))}
                  className={erroresForm.tratamiento ? 'input-error' : ''}
                  placeholder="Tratamiento indicado..."
                />
                {erroresForm.tratamiento && <span className="error-msg">{erroresForm.tratamiento}</span>}
              </div>
              
              <div className="form-group">
                <label>Medicamentos</label>
                <input
                  type="text"
                  value={formData.medicamentos}
                  onChange={e => setFormData(p => ({ ...p, medicamentos: e.target.value }))}
                  placeholder="Medicamentos prescritos (opcional)"
                />
              </div>
              
              <div className="form-group">
                <label>Notas del Médico</label>
                <textarea
                  rows={2}
                  value={formData.notas_medico}
                  onChange={e => setFormData(p => ({ ...p, notas_medico: e.target.value }))}
                  placeholder="Observaciones adicionales (opcional)..."
                />
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setMostrarModal(false)} 
                  className="btn-secondary"
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={guardando}
                >
                  {guardando ? 'Guardando...' : (modoEdicion ? 'Actualizar' : 'Crear Expediente')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

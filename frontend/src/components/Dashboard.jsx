// =============================================================================
// COMPONENTE: DASHBOARD DEL USUARIO (rol: user)
// =============================================================================
// Aquí el usuario normal puede ver sus propios expedientes médicos.
// NO puede ver expedientes de otros usuarios (protección anti-IDOR).
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { expedientesAPI } from '../api/client';

const Dashboard = () => {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  
  const [expedientes, setExpedientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  
  // ---------------------------------------------------------------
  // CARGAR EXPEDIENTES AL MONTAR EL COMPONENTE
  // ---------------------------------------------------------------
  useEffect(() => {
    cargarExpedientes();
  }, []);
  
  const cargarExpedientes = async () => {
    setCargando(true);
    setError('');
    
    try {
      const respuesta = await expedientesAPI.listar();
      setExpedientes(respuesta.data.expedientes || []);
    } catch (err) {
      // Manejo de errores específicos
      if (err.response?.status === 403) {
        setError('No tienes permiso para ver estos expedientes.');
      } else if (err.response?.status === 401) {
        // El interceptor de Axios ya manejó la redirección, pero por si acaso
        logout();
        navigate('/login');
      } else {
        setError('Error al cargar los expedientes. Intente de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  };
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const formatearFecha = (fecha) => {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };
  
  return (
    <div className="app-layout">
      {/* ---- BARRA SUPERIOR ---- */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-icon">🏥</span>
          <h1>Expedientes Médicos</h1>
        </div>
        <div className="header-right">
          <span className="user-badge">
            👤 {usuario?.nombre}
          </span>
          <span className="role-badge role-user">Paciente</span>
          <button onClick={handleLogout} className="btn-logout">
            Cerrar Sesión
          </button>
        </div>
      </header>
      
      {/* ---- CONTENIDO PRINCIPAL ---- */}
      <main className="app-main">
        <div className="page-header">
          <h2>Mis Expedientes Médicos</h2>
          <p className="page-subtitle">
            Consulta tu historial médico. Solo tú puedes ver estos datos.
          </p>
        </div>
        
        {/* Estado de carga */}
        {cargando && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Cargando tus expedientes...</p>
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div className="alert alert-error">
            ⚠️ {error}
            <button onClick={cargarExpedientes} className="btn-retry">
              Reintentar
            </button>
          </div>
        )}
        
        {/* Lista de expedientes */}
        {!cargando && !error && (
          <>
            {expedientes.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <p>No tienes expedientes médicos registrados aún.</p>
                <p className="empty-hint">Contacta al administrador para que registre tu expediente.</p>
              </div>
            ) : (
              <div className="cards-grid">
                {expedientes.map(exp => (
                  <div 
                    key={exp.id} 
                    className="expediente-card"
                    onClick={() => setExpedienteSeleccionado(exp)}
                  >
                    <div className="card-header-row">
                      <span className="card-icon">📄</span>
                      <span className="card-date">{formatearFecha(exp.fecha_consulta)}</span>
                    </div>
                    <h3>{exp.diagnostico}</h3>
                    <p className="card-doctor">
                      <strong>Médico:</strong> {exp.medico_responsable}
                    </p>
                    <p className="card-treatment">
                      <strong>Tratamiento:</strong> {exp.tratamiento.substring(0, 80)}
                      {exp.tratamiento.length > 80 ? '...' : ''}
                    </p>
                    <button className="btn-secondary btn-small">Ver detalle →</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Modal de detalle del expediente */}
        {expedienteSeleccionado && (
          <div className="modal-overlay" onClick={() => setExpedienteSeleccionado(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📋 Detalle del Expediente</h3>
                <button 
                  className="modal-close" 
                  onClick={() => setExpedienteSeleccionado(null)}
                >✕</button>
              </div>
              <div className="modal-body">
                <div className="detail-row">
                  <label>Paciente:</label>
                  <span>{expedienteSeleccionado.nombre_paciente}</span>
                </div>
                <div className="detail-row">
                  <label>Fecha de Consulta:</label>
                  <span>{formatearFecha(expedienteSeleccionado.fecha_consulta)}</span>
                </div>
                <div className="detail-row">
                  <label>Diagnóstico:</label>
                  <span>{expedienteSeleccionado.diagnostico}</span>
                </div>
                <div className="detail-row">
                  <label>Tratamiento:</label>
                  <span>{expedienteSeleccionado.tratamiento}</span>
                </div>
                {expedienteSeleccionado.medicamentos && (
                  <div className="detail-row">
                    <label>Medicamentos:</label>
                    <span>{expedienteSeleccionado.medicamentos}</span>
                  </div>
                )}
                {expedienteSeleccionado.notas_medico && (
                  <div className="detail-row">
                    <label>Notas del Médico:</label>
                    <span>{expedienteSeleccionado.notas_medico}</span>
                  </div>
                )}
                <div className="detail-row">
                  <label>Médico Responsable:</label>
                  <span>{expedienteSeleccionado.medico_responsable}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

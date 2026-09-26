// =============================================================================
// COMPONENTE: FORMULARIO DE LOGIN
// =============================================================================
// Permite al usuario iniciar sesión con email y contraseña.
// Incluye validación en el cliente ANTES de enviar los datos al servidor.
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, estaLogueado, esAdmin } = useAuth();
  
  // Estado del formulario
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensajeInfo, setMensajeInfo] = useState('');
  
  // Si hay parámetros de sesión expirada en la URL, mostramos mensaje
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sesion_expirada')) {
      setMensajeInfo('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
    }
    if (params.get('sesion_invalida')) {
      setMensajeInfo('Sesión inválida. Por favor, inicia sesión de nuevo.');
    }
  }, []);
  
  // Si el usuario ya está logueado, redirigimos automáticamente
  useEffect(() => {
    if (estaLogueado) {
      navigate(esAdmin ? '/admin' : '/dashboard');
    }
  }, [estaLogueado, esAdmin, navigate]);
  
  // ---------------------------------------------------------------
  // VALIDACIÓN EN EL CLIENTE
  // ---------------------------------------------------------------
  // Validamos ANTES de enviar al servidor para dar retroalimentación rápida.
  // Pero SIEMPRE validamos también en el servidor (el cliente puede ser modificado).
  const validarFormulario = () => {
    const nuevosErrores = {};
    
    // Validar email: debe tener formato básico de email
    // Usamos una regex sencilla, no perfecta (el servidor hará la validación real)
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      nuevosErrores.email = 'El email es requerido';
    } else if (!regexEmail.test(formData.email)) {
      nuevosErrores.email = 'Formato de email inválido';
    }
    
    // Validar contraseña: solo verificamos que no esté vacía
    // No damos pistas sobre los requisitos de contraseña en el login
    if (!formData.password) {
      nuevosErrores.password = 'La contraseña es requerida';
    } else if (formData.password.length < 8) {
      nuevosErrores.password = 'La contraseña debe tener al menos 8 caracteres';
    }
    
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0; // true si no hay errores
  };
  
  // ---------------------------------------------------------------
  // MANEJAR CAMBIOS EN EL FORMULARIO
  // ---------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Sanitización básica en cliente: eliminamos caracteres peligrosos
    // NOTA: Esto es solo cosmético. La sanitización real la hace Zod en el servidor.
    // No bloqueamos caracteres en contraseña (puede tener símbolos especiales válidos)
    let valorSanitizado = value;
    if (name === 'email') {
      // Para el email solo permitimos caracteres válidos de email
      valorSanitizado = value.replace(/[<>'"]/g, '');
    }
    
    setFormData(prev => ({ ...prev, [name]: valorSanitizado }));
    
    // Limpiamos el error del campo cuando el usuario empieza a corregirlo
    if (errores[name]) {
      setErrores(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  // ---------------------------------------------------------------
  // ENVIAR EL FORMULARIO
  // ---------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault(); // Evitamos que el formulario recargue la página
    
    setErrorGeneral(''); // Limpiamos errores anteriores
    
    // Primero validamos en el cliente
    if (!validarFormulario()) return;
    
    setCargando(true);
    
    try {
      const usuario = await login(formData.email.trim().toLowerCase(), formData.password);
      
      // Redirigimos según el rol del usuario
      // Los admins van al panel de administración
      // Los usuarios normales van a su dashboard
      const destino = usuario.rol === 'admin' ? '/admin' : '/dashboard';
      navigate(destino, { replace: true });
      
    } catch (error) {
      // Mostramos el mensaje de error del servidor
      // El servidor devuelve mensajes GENÉRICOS ("Usuario o contraseña incorrectos")
      // para no revelar si el email existe o no
      const mensaje = error.response?.data?.mensaje || 'Error al iniciar sesión. Intente de nuevo.';
      setErrorGeneral(mensaje);
      
    } finally {
      setCargando(false);
    }
  };
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🏥</div>
          <h1>Sistema de Expedientes Médicos</h1>
          <p>Inicia sesión para acceder</p>
        </div>
        
        {/* Mensaje de información (sesión expirada, etc.) */}
        {mensajeInfo && (
          <div className="alert alert-info">
            ℹ️ {mensajeInfo}
          </div>
        )}
        
        {/* Error general del login */}
        {errorGeneral && (
          <div className="alert alert-error">
            ⚠️ {errorGeneral}
          </div>
        )}
        
        <form onSubmit={handleSubmit} noValidate>
          {/* Campo Email */}
          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
              autoComplete="email"
              disabled={cargando}
              className={errores.email ? 'input-error' : ''}
            />
            {errores.email && <span className="error-msg">{errores.email}</span>}
          </div>
          
          {/* Campo Contraseña */}
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              disabled={cargando}
              className={errores.password ? 'input-error' : ''}
            />
            {errores.password && <span className="error-msg">{errores.password}</span>}
          </div>
          
          <button 
            type="submit" 
            className="btn-primary"
            disabled={cargando}
          >
            {cargando ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
        
        <p className="auth-link">
          ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
        </p>
        
        {/* Credenciales de prueba para la demostración */}
        <div className="demo-credentials">
          <p><strong>Credenciales de prueba:</strong></p>
          <p>👑 Admin: admin@hospital.com / Admin@123456</p>
          <p>👤 Usuario: juan.perez@email.com / User@123456</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

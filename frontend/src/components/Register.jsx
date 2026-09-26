// =============================================================================
// COMPONENTE: FORMULARIO DE REGISTRO
// =============================================================================
// Permite crear nuevas cuentas con validación fuerte en el cliente.
// La contraseña debe cumplir requisitos de complejidad.
// =============================================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/client';

const Register = () => {
  const navigate = useNavigate();
  const { estaLogueado } = useAuth();
  
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmarPassword: ''
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(false);
  
  // Si ya está logueado, redirigimos
  useEffect(() => {
    if (estaLogueado) navigate('/dashboard');
  }, [estaLogueado, navigate]);
  
  // ---------------------------------------------------------------
  // VALIDACIÓN EN CLIENTE
  // ---------------------------------------------------------------
  const validarFormulario = () => {
    const nuevosErrores = {};
    
    // Nombre: solo letras y espacios (previene XSS en el nombre)
    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es requerido';
    } else if (formData.nombre.trim().length < 2) {
      nuevosErrores.nombre = 'El nombre debe tener al menos 2 caracteres';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$/.test(formData.nombre)) {
      // Regex que solo permite letras (con tildes), espacios y guiones
      // Bloquea caracteres HTML peligrosos como < > " ' ; que podrían usarse para XSS
      nuevosErrores.nombre = 'El nombre solo puede contener letras y espacios';
    }
    
    // Email: formato básico
    if (!formData.email.trim()) {
      nuevosErrores.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nuevosErrores.email = 'Formato de email inválido';
    }
    
    // Contraseña: requisitos de complejidad (igual que en el servidor con Zod)
    if (!formData.password) {
      nuevosErrores.password = 'La contraseña es requerida';
    } else {
      const erroresPassword = [];
      if (formData.password.length < 8) erroresPassword.push('al menos 8 caracteres');
      if (!/[A-Z]/.test(formData.password)) erroresPassword.push('una mayúscula');
      if (!/[a-z]/.test(formData.password)) erroresPassword.push('una minúscula');
      if (!/[0-9]/.test(formData.password)) erroresPassword.push('un número');
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) erroresPassword.push('un símbolo especial');
      
      if (erroresPassword.length > 0) {
        nuevosErrores.password = `La contraseña necesita: ${erroresPassword.join(', ')}`;
      }
    }
    
    // Confirmar contraseña
    if (formData.password !== formData.confirmarPassword) {
      nuevosErrores.confirmarPassword = 'Las contraseñas no coinciden';
    }
    
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Sanitización básica del nombre (en cliente)
    let valorSanitizado = value;
    if (name === 'nombre') {
      // Eliminamos caracteres HTML especiales del nombre
      valorSanitizado = value.replace(/[<>'";&]/g, '');
    } else if (name === 'email') {
      valorSanitizado = value.replace(/[<>'"]/g, '');
    }
    
    setFormData(prev => ({ ...prev, [name]: valorSanitizado }));
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: '' }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    
    if (!validarFormulario()) return;
    
    setCargando(true);
    
    try {
      await authAPI.registrar(
        formData.nombre.trim(),
        formData.email.trim().toLowerCase(),
        formData.password
      );
      
      setExito(true);
      // Después de 3 segundos redirigimos al login
      setTimeout(() => navigate('/login'), 3000);
      
    } catch (error) {
      const mensaje = error.response?.data?.mensaje || 'Error al registrarse. Intente de nuevo.';
      setErrorGeneral(mensaje);
    } finally {
      setCargando(false);
    }
  };
  
  // Indicador visual de fuerza de contraseña
  const getFuerzaPassword = () => {
    const pwd = formData.password;
    if (!pwd) return { nivel: 0, texto: '', color: '' };
    let puntos = 0;
    if (pwd.length >= 8) puntos++;
    if (/[A-Z]/.test(pwd)) puntos++;
    if (/[a-z]/.test(pwd)) puntos++;
    if (/[0-9]/.test(pwd)) puntos++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) puntos++;
    
    if (puntos <= 2) return { nivel: puntos, texto: 'Débil', color: '#e74c3c' };
    if (puntos <= 3) return { nivel: puntos, texto: 'Regular', color: '#f39c12' };
    if (puntos <= 4) return { nivel: puntos, texto: 'Buena', color: '#2ecc71' };
    return { nivel: puntos, texto: 'Fuerte', color: '#27ae60' };
  };
  
  const fuerzaPassword = getFuerzaPassword();
  
  if (exito) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="alert alert-success">
            ✅ ¡Registro exitoso! Redirigiendo al login en 3 segundos...
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🏥</div>
          <h1>Crear Cuenta</h1>
          <p>Registra una nueva cuenta de paciente</p>
        </div>
        
        {errorGeneral && (
          <div className="alert alert-error">⚠️ {errorGeneral}</div>
        )}
        
        <form onSubmit={handleSubmit} noValidate>
          {/* Nombre */}
          <div className="form-group">
            <label htmlFor="nombre">Nombre Completo</label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Nombre Apellido"
              autoComplete="name"
              disabled={cargando}
              className={errores.nombre ? 'input-error' : ''}
            />
            {errores.nombre && <span className="error-msg">{errores.nombre}</span>}
          </div>
          
          {/* Email */}
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
          
          {/* Contraseña */}
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              disabled={cargando}
              className={errores.password ? 'input-error' : ''}
            />
            {/* Indicador de fuerza de contraseña */}
            {formData.password && (
              <div className="password-strength">
                <div 
                  className="strength-bar"
                  style={{ 
                    width: `${(fuerzaPassword.nivel / 5) * 100}%`,
                    backgroundColor: fuerzaPassword.color
                  }}
                />
                <span style={{ color: fuerzaPassword.color }}>
                  {fuerzaPassword.texto}
                </span>
              </div>
            )}
            {errores.password && <span className="error-msg">{errores.password}</span>}
            <small className="form-hint">
              Debe tener: mayúscula, minúscula, número y símbolo especial (!@#$...)
            </small>
          </div>
          
          {/* Confirmar Contraseña */}
          <div className="form-group">
            <label htmlFor="confirmarPassword">Confirmar Contraseña</label>
            <input
              type="password"
              id="confirmarPassword"
              name="confirmarPassword"
              value={formData.confirmarPassword}
              onChange={handleChange}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              disabled={cargando}
              className={errores.confirmarPassword ? 'input-error' : ''}
            />
            {errores.confirmarPassword && (
              <span className="error-msg">{errores.confirmarPassword}</span>
            )}
          </div>
          
          <button type="submit" className="btn-primary" disabled={cargando}>
            {cargando ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>
        
        <p className="auth-link">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión aquí</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

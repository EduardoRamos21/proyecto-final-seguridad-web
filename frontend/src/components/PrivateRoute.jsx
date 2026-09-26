// =============================================================================
// COMPONENTE: RUTA PRIVADA (PrivateRoute)
// =============================================================================
// Este componente protege las rutas que requieren autenticación o un rol específico.
// 
// ¿Cómo funciona? Actúa como un "guardia" de ruta:
// - Si el usuario no está logueado → lo redirige al login
// - Si no tiene el rol requerido → lo redirige a donde tiene acceso
// - Si todo está bien → muestra el componente pedido
//
// IMPORTANTE: Esta verificación es solo UX (experiencia de usuario).
// La seguridad REAL está en el backend. Un usuario malicioso podría
// saltarse esta verificación, pero el backend le negará el acceso de todas formas.
// =============================================================================

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, rolRequerido }) => {
  const { usuario, cargando, estaLogueado, esAdmin } = useAuth();
  const location = useLocation();
  
  // Mientras verificamos si hay sesión guardada, mostramos un loader
  // (evitamos que el usuario vea un flash de la página de login)
  if (cargando) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#0a0e1a',
        color: '#4a9eff'
      }}>
        <div>Verificando sesión...</div>
      </div>
    );
  }
  
  // Si el usuario NO está logueado, lo mandamos al login
  // Guardamos la ruta a la que intentó acceder para redirigirlo después del login
  if (!estaLogueado) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Si se requiere un rol específico y el usuario no lo tiene
  // lo redirigimos a su dashboard correspondiente
  if (rolRequerido === 'admin' && !esAdmin) {
    // Un usuario normal intentó acceder a rutas de admin → lo mandamos a su dashboard
    return <Navigate to="/dashboard" replace />;
  }
  
  // Todo bien: el usuario está autenticado y tiene el rol correcto
  return children;
};

export default PrivateRoute;

// =============================================================================
// CONTEXTO DE AUTENTICACIÓN (AuthContext)
// =============================================================================
// En React, el "contexto" es como una "mochila de datos" que cualquier
// componente de la app puede cargar, sin tener que pasar los datos
// de padre a hijo a nieto (prop drilling).
//
// Aquí guardamos: quién está logueado, su rol, y funciones para login/logout.
// =============================================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';

// Creamos el contexto (como una "caja vacía" que vamos a llenar)
const AuthContext = createContext(null);

// ---------------------------------------------------------------
// PROVEEDOR DE AUTENTICACIÓN
// ---------------------------------------------------------------
// Este componente "envuelve" toda la app y proporciona el estado de autenticación
// a cualquier componente que lo necesite.
export const AuthProvider = ({ children }) => {
  
  // Estado del usuario: null = no logueado, objeto = logueado
  const [usuario, setUsuario] = useState(null);
  
  // Estado de carga: mientras verificamos si hay sesión guardada
  const [cargando, setCargando] = useState(true);
  
  // ---------------------------------------------------------------
  // RESTAURAR SESIÓN AL CARGAR LA APP
  // ---------------------------------------------------------------
  // Cuando el usuario recarga la página, verificamos si hay una sesión guardada
  // en sessionStorage. Si hay token, verificamos que sea válido en el servidor.
  useEffect(() => {
    const restaurarSesion = async () => {
      const token = sessionStorage.getItem('jwt_token');
      const usuarioGuardado = sessionStorage.getItem('usuario_data');
      
      if (token && usuarioGuardado) {
        try {
          // Verificamos con el servidor que el token sigue siendo válido
          // (podría haber expirado mientras el tab estaba abierto)
          await authAPI.obtenerPerfil();
          
          // Si el servidor responde OK, restauramos los datos del usuario
          setUsuario(JSON.parse(usuarioGuardado));
          
        } catch (error) {
          // Si el token expiró o es inválido, limpiamos y dejamos al usuario sin sesión
          // El interceptor de Axios ya maneja la redirección, pero limpiamos por si acaso
          sessionStorage.removeItem('jwt_token');
          sessionStorage.removeItem('usuario_data');
          setUsuario(null);
        }
      }
      
      // Terminamos de verificar (ya sea con sesión o sin ella)
      setCargando(false);
    };
    
    restaurarSesion();
  }, []); // [] = solo se ejecuta una vez al montar el componente
  
  // ---------------------------------------------------------------
  // FUNCIÓN DE LOGIN
  // ---------------------------------------------------------------
  const login = useCallback(async (email, password) => {
    // Hacemos la petición al backend
    const respuesta = await authAPI.login(email, password);
    const { token, usuario: datosUsuario } = respuesta.data;
    
    // Guardamos el token en sessionStorage (no localStorage por seguridad)
    // sessionStorage se borra al cerrar el tab
    sessionStorage.setItem('jwt_token', token);
    
    // Guardamos los datos básicos del usuario (sin contraseña ni hash)
    sessionStorage.setItem('usuario_data', JSON.stringify(datosUsuario));
    
    // Actualizamos el estado de React para que todos los componentes se enteren
    setUsuario(datosUsuario);
    
    return datosUsuario; // Devolvemos el usuario para que el componente pueda redirigir
  }, []);
  
  // ---------------------------------------------------------------
  // FUNCIÓN DE LOGOUT
  // ---------------------------------------------------------------
  const logout = useCallback(() => {
    // Borramos el token del storage (ya no se enviará en futuras peticiones)
    sessionStorage.removeItem('jwt_token');
    sessionStorage.removeItem('usuario_data');
    
    // Limpiamos el estado de React
    setUsuario(null);
    
    // En un sistema real también haríamos una petición al backend para invalidar el token
    // (con tokens en una "blacklist" o usando refresh tokens de corta duración)
  }, []);
  
  // ---------------------------------------------------------------
  // VALORES DISPONIBLES EN EL CONTEXTO
  // ---------------------------------------------------------------
  const valor = {
    usuario,           // Datos del usuario logueado (o null)
    cargando,          // true mientras verificamos la sesión guardada
    login,             // Función para iniciar sesión
    logout,            // Función para cerrar sesión
    estaLogueado: !!usuario,         // true/false: ¿hay usuario logueado?
    esAdmin: usuario?.rol === 'admin' // true/false: ¿el usuario es admin?
  };
  
  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------
// HOOK PERSONALIZADO
// ---------------------------------------------------------------
// Este hook hace más fácil usar el contexto en cualquier componente.
// En lugar de: const { usuario } = useContext(AuthContext);
// Escribimos: const { usuario } = useAuth();
export const useAuth = () => {
  const contexto = useContext(AuthContext);
  
  // Si alguien usa useAuth() fuera del AuthProvider, le avisamos
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  
  return contexto;
};

// =============================================================================
// CLIENTE HTTP CON AXIOS Y MANEJO DE JWT
// =============================================================================
// Este módulo configura Axios para que TODAS las peticiones al backend
// incluyan automáticamente el token JWT y manejen la expiración de sesión.
//
// Es como un "mensajero inteligente" que sabe poner el token en cada carta
// que envía, y si le dicen "el token expiró", avisa al usuario.
// =============================================================================

import axios from 'axios';

// URL base del backend
// En desarrollo, Vite proxy redirige /api → http://localhost:3001/api
// En producción, sería la URL real del servidor
const BASE_URL = '/api';

// ---------------------------------------------------------------
// CREAR INSTANCIA DE AXIOS
// ---------------------------------------------------------------
// Creamos una instancia configurada en lugar de usar axios directamente.
// Así todas las peticiones heredan la configuración de seguridad.
const apiClient = axios.create({
  baseURL: BASE_URL,
  
  // Tiempo máximo de espera: si el servidor no responde en 10 segundos, cancelamos
  // Esto previene que la app se quede "colgada" indefinidamente
  timeout: 10000,
  
  headers: {
    'Content-Type': 'application/json',
    // No ponemos el token aquí porque es dinámico (se agrega en el interceptor)
  }
});

// ---------------------------------------------------------------
// INTERCEPTOR DE PETICIONES (Request Interceptor)
// ---------------------------------------------------------------
// Esta función se ejecuta ANTES de cada petición que hacemos al servidor.
// Es el lugar perfecto para agregar el token JWT a cada petición automáticamente.
//
// Sin esto, tendríamos que agregar el token manualmente en cada llamada.
apiClient.interceptors.request.use(
  (config) => {
    // Obtenemos el token del sessionStorage
    // Usamos sessionStorage (no localStorage) porque se borra al cerrar el tab.
    // localStorage persiste aunque cierres el navegador (más riesgo si el equipo es compartido).
    const token = sessionStorage.getItem('jwt_token');
    
    if (token) {
      // Agregamos el token en la cabecera Authorization con el formato "Bearer TOKEN"
      // El backend espera exactamente este formato para verificarlo
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config; // Devolvemos la configuración modificada
  },
  (error) => {
    // Si hay un error al preparar la petición, lo rechazamos
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------
// INTERCEPTOR DE RESPUESTAS (Response Interceptor)
// ---------------------------------------------------------------
// Esta función se ejecuta DESPUÉS de recibir cada respuesta del servidor.
// La usamos para manejar errores de autenticación de forma centralizada.
apiClient.interceptors.response.use(
  // Si la respuesta fue exitosa (2xx), la devolvemos tal cual
  (response) => response,
  
  // Si hubo un error en la respuesta...
  (error) => {
    
    if (error.response) {
      const { status, data } = error.response;
      
      // --- Manejo de Token Expirado (401) ---
      // Si el servidor dice "no autorizado" Y el código específico es TOKEN_EXPIRADO
      // significa que el JWT del usuario expiró (dura 15 minutos)
      if (status === 401 && data?.codigo === 'TOKEN_EXPIRADO') {
        // Limpiamos los datos de sesión del storage
        sessionStorage.removeItem('jwt_token');
        sessionStorage.removeItem('usuario_data');
        
        // Redirigimos al login con un mensaje informativo
        // Usamos window.location para hacer una redirección "dura" que limpia el estado
        window.location.href = '/?sesion_expirada=1';
        
        return Promise.reject(error);
      }
      
      // --- Otros 401: token inválido, no autenticado ---
      if (status === 401) {
        // Si hay token guardado pero el servidor lo rechaza, lo limpiamos
        const token = sessionStorage.getItem('jwt_token');
        if (token) {
          sessionStorage.removeItem('jwt_token');
          sessionStorage.removeItem('usuario_data');
          window.location.href = '/?sesion_invalida=1';
        }
      }
    }
    
    // Para cualquier otro error, lo dejamos pasar para que cada componente
    // pueda manejarlo según su contexto
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------
// FUNCIONES DE LA API (Abstracción de endpoints)
// ---------------------------------------------------------------
// Definimos funciones para cada endpoint del backend.
// Esto centraliza las llamadas y hace el código más limpio.

// --- AUTENTICACIÓN ---
export const authAPI = {
  
  // Iniciar sesión: envía email y contraseña, recibe JWT
  login: (email, password) => 
    apiClient.post('/auth/login', { email, password }),
  
  // Registrar nuevo usuario
  registrar: (nombre, email, password) => 
    apiClient.post('/auth/register', { nombre, email, password }),
  
  // Obtener datos del perfil actual (requiere JWT)
  obtenerPerfil: () => 
    apiClient.get('/auth/perfil')
};

// --- EXPEDIENTES MÉDICOS ---
export const expedientesAPI = {
  
  // Listar expedientes (admin: todos, user: solo los suyos)
  listar: () => 
    apiClient.get('/expedientes'),
  
  // Obtener un expediente específico por ID
  obtener: (id) => 
    apiClient.get(`/expedientes/${id}`),
  
  // Crear nuevo expediente (solo admin)
  crear: (datos) => 
    apiClient.post('/expedientes', datos),
  
  // Actualizar expediente existente (solo admin)
  actualizar: (id, datos) => 
    apiClient.put(`/expedientes/${id}`, datos),
  
  // Listar usuarios (solo admin, para asignar expedientes)
  listarUsuarios: () => 
    apiClient.get('/expedientes/admin/usuarios')
};

// Exportamos el cliente para uso directo si se necesita
export default apiClient;

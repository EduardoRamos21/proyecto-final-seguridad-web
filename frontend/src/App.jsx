// =============================================================================
// APP.JSX - COMPONENTE RAÍZ Y ENRUTADOR
// =============================================================================
// Aquí definimos todas las rutas de la aplicación y las protegemos según rol.
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';

function App() {
  return (
    // BrowserRouter: habilita el enrutamiento del lado del cliente
    <BrowserRouter>
      {/* AuthProvider: envuelve TODA la app para que cualquier componente
          pueda acceder al estado de autenticación */}
      <AuthProvider>
        <Routes>
          
          {/* ---- RUTAS PÚBLICAS ---- */}
          {/* Cualquiera puede acceder a login y registro */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* ---- RUTA RAÍZ ---- */}
          {/* Redirigimos al login por defecto */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* ---- RUTA PROTEGIDA: DASHBOARD (cualquier usuario autenticado) ---- */}
          {/* PrivateRoute verifica que el usuario esté logueado */}
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          
          {/* ---- RUTA PROTEGIDA: PANEL ADMIN (solo rol 'admin') ---- */}
          {/* rolRequerido="admin": además de estar logueado, debe ser admin */}
          <Route 
            path="/admin" 
            element={
              <PrivateRoute rolRequerido="admin">
                <AdminPanel />
              </PrivateRoute>
            } 
          />
          
          {/* ---- RUTA NO ENCONTRADA (404) ---- */}
          {/* Si nadie coincide con las rutas anteriores, mandamos al login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
          
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// =============================================================================
// CONFIGURACIÓN DE VITE (Bundler de React)
// =============================================================================
// Vite es el servidor de desarrollo y el empaquetador (bundler) del frontend.
// Aquí configuramos cómo se compila y sirve nuestra aplicación.
// =============================================================================

export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 5173, // Puerto del servidor de desarrollo
    
    // Proxy: redirige las peticiones de /api al backend
    // Esto evita problemas de CORS en desarrollo (las peticiones parecen del mismo origen)
    // En producción, se configura en el servidor web (Nginx, etc.)
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // URL del backend
        changeOrigin: true,
        // Si en algún momento el backend usa HTTPS con certificado local:
        // secure: false (solo para desarrollo)
      }
    }
  },
  
  build: {
    // En producción, el código se minifica (hace difícil leerlo para un atacante)
    minify: 'terser',
    
    // Separamos el código de las librerías del código de la app
    // para que la caché del navegador funcione mejor
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'axios': ['axios']
        }
      }
    }
  }
})

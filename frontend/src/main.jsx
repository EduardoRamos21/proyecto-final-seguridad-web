// =============================================================================
// MAIN.JSX - PUNTO DE ENTRADA DE REACT
// =============================================================================
// Este es el primer archivo que se ejecuta.
// Monta el componente App dentro del div#root del index.html.
// =============================================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'

// StrictMode: modo de desarrollo que ayuda a detectar problemas comunes en React.
// En producción se comporta igual que sin StrictMode.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

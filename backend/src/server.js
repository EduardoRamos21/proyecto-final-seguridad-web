// =============================================================================
// SERVIDOR PRINCIPAL - PUNTO DE ENTRADA DE LA APLICACIÓN
// =============================================================================
// Este archivo inicializa Express, configura TODOS los middlewares de seguridad
// y levanta el servidor.
//
// FILOSOFÍA: "Defense in Depth" (Defensa en profundidad)
// No confiamos en una sola capa de seguridad. Tenemos múltiples capas:
// HTTPS → Helmet → CORS → Rate Limit → Validación → JWT → RBAC → Consultas Parametrizadas
// Si un atacante supera una capa, todavía tiene que vencer las demás.
// =============================================================================

// Cargamos las variables de entorno PRIMERO, antes de importar otros módulos
// para que estén disponibles cuando se inicialicen
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
// Para HTTPS en producción/desarrollo con certificados locales
// const https = require('https');
// const fs = require('fs');

const logger = require('./utils/logger');
const authRoutes = require('./routes/authRoutes');
const expedientesRoutes = require('./routes/expedientesRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ---------------------------------------------------------------
// INICIALIZACIÓN DE EXPRESS
// ---------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------
// CAPA 1: HELMET - Cabeceras HTTP de Seguridad
// ---------------------------------------------------------------
// Helmet es como ponerle un "casco de seguridad" al servidor.
// Agrega automáticamente cabeceras HTTP que previenen ataques comunes.
app.use(helmet({
  
  // Content Security Policy: le dice al navegador de dónde puede cargar recursos.
  // 'self' = solo nuestro propio servidor. Bloquea scripts maliciosos externos.
  // Esto previene ataques XSS donde el atacante inyecta un script externo.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],         // Por defecto, solo recursos propios
      scriptSrc: ["'self'"],           // Scripts solo de nuestro servidor
      styleSrc: ["'self'", "'unsafe-inline'"], // Estilos inline (necesario para React)
      imgSrc: ["'self'", "data:"],     // Imágenes propias y data URIs
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173'], // Conexiones permitidas
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],           // Bloquea plugins Flash, etc.
      upgradeInsecureRequests: [],     // Fuerza HTTPS en navegadores
    },
  },
  
  // HSTS (HTTP Strict Transport Security): fuerza HTTPS por 1 año.
  // Después de visitar el sitio una vez, el navegador SIEMPRE usará HTTPS.
  // Esto previene ataques de downgrade (forzar HTTP en lugar de HTTPS).
  strictTransportSecurity: {
    maxAge: 31536000, // 1 año en segundos
    includeSubDomains: true,
  },
  
  // X-Frame-Options: DENY evita que nuestra app sea embebida en un iframe.
  // Esto previene "Clickjacking" (ocultar nuestra app bajo otro contenido).
  frameguard: { action: 'deny' },
  
  // X-Content-Type-Options: nosniff evita que el navegador "adivine" el tipo de archivo.
  // Sin esto, un atacante podría subir un archivo HTML disfrazado de imagen.
  noSniff: true,
  
  // Oculta la cabecera "X-Powered-By: Express" que revela tecnologías usadas.
  // Un atacante no debería saber qué framework usamos.
  hidePoweredBy: true,
  
  // Referrer Policy: controla cuánta información de URL se comparte al navegar.
  referrerPolicy: { policy: 'no-referrer' },
}));

// ---------------------------------------------------------------
// CAPA 2: CORS - Control de Orígenes Permitidos
// ---------------------------------------------------------------
// CORS define qué dominios pueden hacer peticiones a nuestra API.
// Sin esto, cualquier sitio web podría hacer peticiones en nombre del usuario.
// (Ataque CSRF - Cross-Site Request Forgery)
const corsOptions = {
  // Solo permitimos peticiones desde nuestro frontend
  // En producción, esto sería: 'https://mi-hospital.com'
  origin: (origin, callback) => {
    const origenPermitido = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Permitimos peticiones sin origen (Postman, apps móviles en desarrollo)
    // En producción estricta, deberíamos quitar esto
    if (!origin || origin === origenPermitido) {
      callback(null, true);
    } else {
      logger.warn(`CORS: Origen rechazado: ${origin}`);
      callback(new Error('No permitido por política CORS'));
    }
  },
  
  // Métodos HTTP permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  // Cabeceras que el cliente puede enviar
  allowedHeaders: ['Content-Type', 'Authorization'],
  
  // Permite que el cliente lea las cabeceras de la respuesta
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  
  // Necesario para que las cookies funcionen entre dominios (si usáramos cookies)
  credentials: true,
  
  // Cuánto tiempo el navegador guarda en caché la respuesta de preflight (OPTIONS)
  maxAge: 86400 // 24 horas
};

app.use(cors(corsOptions));

// ---------------------------------------------------------------
// CAPA 3: PARSEO DE DATOS
// ---------------------------------------------------------------
// Express necesita estos middlewares para leer el cuerpo (body) de las peticiones

// Parsea JSON: convierte el texto JSON del body en un objeto JavaScript
// limit: '10kb' evita que alguien envíe cuerpos enormes (ataque DoS)
app.use(express.json({ limit: '10kb' }));

// Parsea formularios HTML (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ---------------------------------------------------------------
// CAPA 4: RATE LIMITER GLOBAL
// ---------------------------------------------------------------
// Limita el número total de peticiones desde una IP para prevenir DoS
const limitadorGlobal = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,                  // Máximo 200 peticiones por IP en 15 minutos
  message: {
    exito: false,
    mensaje: 'Demasiadas peticiones desde esta IP. Intente más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limitadorGlobal);

// ---------------------------------------------------------------
// MIDDLEWARE DE LOG DE PETICIONES HTTP
// ---------------------------------------------------------------
// Registramos cada petición que llega al servidor (para auditoría y debugging)
// IMPORTANTE: No registramos el cuerpo de la petición (podría contener contraseñas)
app.use((req, res, next) => {
  // Solo registramos en ambientes que no son producción para no saturar logs
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`${req.method} ${req.path}`, {
      meta: { ip: req.ip, userAgent: req.get('User-Agent')?.substring(0, 100) }
    });
  }
  next();
});

// ---------------------------------------------------------------
// RUTAS DE LA API
// ---------------------------------------------------------------
// Aquí es donde "montamos" nuestras rutas en el servidor
// Todas las rutas de auth empiezan con /api/auth
app.use('/api/auth', authRoutes);

// Todas las rutas de expedientes empiezan con /api/expedientes
app.use('/api/expedientes', expedientesRoutes);

// Ruta de verificación de salud del servidor (útil para monitoreo)
// No devuelve información sensible
app.get('/api/health', (req, res) => {
  res.json({
    estado: 'ok',
    timestamp: new Date().toISOString()
    // No incluimos versión, nombre de servidor ni otras info técnicas
  });
});

// ---------------------------------------------------------------
// MANEJADOR DE RUTAS NO ENCONTRADAS (404)
// ---------------------------------------------------------------
// Si llegamos aquí, ninguna ruta coincidió con la petición
app.use(notFoundHandler);

// ---------------------------------------------------------------
// MANEJADOR DE ERRORES CENTRALIZADO
// ---------------------------------------------------------------
// DEBE ser el ÚLTIMO middleware (4 parámetros: err, req, res, next)
// Captura cualquier error lanzado en las rutas o middlewares anteriores
app.use(errorHandler);

// ---------------------------------------------------------------
// INICIO DEL SERVIDOR
// ---------------------------------------------------------------

// OPCIÓN A: HTTP (para desarrollo sin certificados)
// Para producción real, SIEMPRE usar OPCIÓN B (HTTPS)
const servidor = app.listen(PORT, () => {
  logger.info(`Servidor HTTP iniciado en http://localhost:${PORT}`);
  logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS habilitado para: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n========================================');
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log('   ADVERTENCIA: Usar HTTPS en producción!');
    console.log('========================================\n');
  }
});

// OPCIÓN B: HTTPS (para producción o desarrollo con mkcert)
// Descomenta este bloque y comenta el bloque de arriba para usar HTTPS:
/*
const SSL_CERT = process.env.SSL_CERT_PATH || './certs/localhost+1.pem';
const SSL_KEY  = process.env.SSL_KEY_PATH  || './certs/localhost+1-key.pem';

if (fs.existsSync(SSL_CERT) && fs.existsSync(SSL_KEY)) {
  const opciones = {
    cert: fs.readFileSync(SSL_CERT),
    key:  fs.readFileSync(SSL_KEY),
    // Solo TLS 1.2 y 1.3 (versiones antiguas tienen vulnerabilidades)
    minVersion: 'TLSv1.2'
  };
  
  const servidorHttps = https.createServer(opciones, app);
  servidorHttps.listen(PORT, () => {
    logger.info(`Servidor HTTPS iniciado en https://localhost:${PORT}`);
  });
  
} else {
  logger.warn('Certificados SSL no encontrados. Ejecutando en HTTP (solo desarrollo).');
  app.listen(PORT, () => logger.info(`Servidor HTTP en http://localhost:${PORT}`));
}
*/

// Manejamos el cierre limpio del servidor (Ctrl+C)
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor de forma limpia...');
  servidor.close(() => {
    logger.info('Servidor cerrado.');
    process.exit(0);
  });
});

// Capturamos errores no manejados para que el servidor no se caiga sin registrarlo
process.on('uncaughtException', (error) => {
  logger.error('Error no capturado (uncaughtException)', {
    meta: { error: error.message, stack: error.stack }
  });
  // En producción, terminamos el proceso (un process manager como PM2 lo reiniciará)
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promesa rechazada no manejada', {
    meta: { reason: String(reason) }
  });
});

module.exports = app;

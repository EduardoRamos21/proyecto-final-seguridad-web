# Arquitectura del Sistema: Gestión de Expedientes Médicos

## 1. Descripción General

Este sistema es una aplicación web de **dos capas** (front-end y back-end) diseñada para gestionar expedientes médicos de forma segura. La seguridad fue incorporada **desde el diseño** (Security by Design), no como un parche al final.

---

## 2. Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Navegador)                       │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              React + Vite (Puerto 5173)                   │  │
│   │                                                          │  │
│   │  ┌─────────────┐  ┌───────────────┐  ┌───────────────┐  │  │
│   │  │  Login /    │  │  Dashboard    │  │  Panel Admin  │  │  │
│   │  │  Registro   │  │  (rol: user)  │  │  (rol: admin) │  │  │
│   │  └─────────────┘  └───────────────┘  └───────────────┘  │  │
│   │                                                          │  │
│   │  [Validación de entrada en cliente antes de enviar]      │  │
│   │  [Token JWT almacenado en memoria / sessionStorage]      │  │
│   └────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────│────────────────────────────────────┘
                             │  HTTPS (TLS 1.2+)
                             │  Cabecera: Authorization: Bearer <JWT>
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVIDOR (Node.js + Express)                   │
│                       Puerto 3001 (HTTPS)                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  CAPAS DE SEGURIDAD                       │   │
│  │                                                          │   │
│  │  1. Helmet      → Cabeceras HTTP seguras (CSP, HSTS...)  │   │
│  │  2. CORS        → Solo permite origen del frontend       │   │
│  │  3. Rate Limit  → Máx 5 intentos de login por 15 min     │   │
│  │  4. Zod         → Valida y sanitiza TODA entrada         │   │
│  │  5. JWT MW      → Verifica token en rutas protegidas     │   │
│  │  6. RBAC MW     → Verifica rol (admin / user)            │   │
│  │  7. ErrorHandler→ Errores genéricos en producción        │   │
│  │  8. Winston     → Logs de auditoría (sin datos sensibles)│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Rutas:                                                          │
│  ├── POST /api/auth/login       → Autenticación (Rate-Limited)   │
│  ├── POST /api/auth/register    → Registro (Rate-Limited)        │
│  ├── GET  /api/expedientes      → Lista (solo admin)             │
│  ├── GET  /api/expedientes/:id  → Ver uno (IDOR protegido)       │
│  ├── POST /api/expedientes      → Crear (admin)                  │
│  └── PUT  /api/expedientes/:id  → Editar (admin)                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │  Consultas parametrizadas (no SQL crudo)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BASE DE DATOS (SQLite)                         │
│                    Archivo: database.db                           │
│                                                                  │
│  Tabla: usuarios                                                  │
│  ├── id (PK), nombre, email, password_hash, rol, created_at     │
│                                                                  │
│  Tabla: expedientes_medicos                                       │
│  ├── id (PK), usuario_id (FK), nombre_paciente, diagnostico,    │
│  │   tratamiento, fecha_consulta, medico_responsable            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Tecnologías Utilizadas

| Capa | Tecnología | Versión | Propósito de Seguridad |
|------|-----------|---------|------------------------|
| Frontend | React | ^18.x | Interfaz de usuario |
| Frontend | Vite | ^5.x | Bundler / Dev server |
| Frontend | Axios | ^1.x | Cliente HTTP con interceptores JWT |
| Backend | Node.js | ^20.x | Runtime del servidor |
| Backend | Express | ^4.x | Framework HTTP |
| Backend | Helmet | ^7.x | **Cabeceras HTTP de seguridad (CSP, HSTS, X-Frame-Options)** |
| Backend | CORS | ^2.x | **Restringe orígenes permitidos** |
| Backend | express-rate-limit | ^7.x | **Previene fuerza bruta en login** |
| Backend | bcrypt | ^5.x | **Hashing seguro de contraseñas (irreversible)** |
| Backend | jsonwebtoken | ^9.x | **Sesiones stateless con expiración** |
| Backend | Zod | ^3.x | **Validación y sanitización de entrada** |
| Backend | Winston | ^3.x | **Logs de auditoría seguros** |
| Base de datos | better-sqlite3 | ^9.x | **Consultas parametrizadas (anti SQLi)** |

---

## 4. Flujo de Datos: Login Seguro

```
Usuario escribe email + contraseña
        │
        ▼
[FRONTEND] Validación en cliente (Zod/regex: formato email, longitud contraseña)
        │
        ▼ HTTPS POST /api/auth/login
[BACKEND] Rate Limiter: ¿más de 5 intentos en 15 min? → 429 Too Many Requests
        │
        ▼
[BACKEND] Zod valida el cuerpo de la petición (tipos, longitudes)
        │
        ▼
[BACKEND] Consulta parametrizada: SELECT * FROM usuarios WHERE email = ?
        │
        ▼
[BACKEND] bcrypt.compare(contraseñaIngresada, hashGuardado)
        │
        ├─── Si falla → Log de auditoría (LOGIN_FALLIDO) + Mensaje GENÉRICO
        │              "Usuario o contraseña incorrectos" (no revela si el email existe)
        │
        └─── Si ok    → Log de auditoría (LOGIN_EXITOSO) + JWT firmado (expira en 15 min)
                               │
                               ▼
[FRONTEND] Guarda JWT en contexto/sessionStorage, redirige según rol
```

---

## 5. Flujo de Datos: Acceso a Expediente (Anti-IDOR)

```
Usuario autenticado solicita GET /api/expedientes/42
        │
        ▼
[BACKEND MW] verifyToken: ¿JWT válido y no expirado? Si no → 401
        │
        ▼
[BACKEND MW] verifyOwnership: ¿El expediente 42 pertenece a este usuario?
             Si rol = 'admin' → permitir cualquier expediente
             Si rol = 'user'  → comparar expediente.usuario_id === token.userId
             Si no coincide   → 403 Forbidden + Log de ACCESO_DENEGADO
        │
        ▼
[BACKEND] Consulta parametrizada → Devuelve datos
```

---

## 6. Cabeceras de Seguridad HTTP (Helmet)

| Cabecera | Valor configurado | Protección |
|----------|------------------|------------|
| `Content-Security-Policy` | `default-src 'self'` | Bloquea scripts externos (XSS) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Fuerza HTTPS por 1 año |
| `X-Frame-Options` | `DENY` | Previene Clickjacking |
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `Referrer-Policy` | `no-referrer` | No filtra URL al hacer requests |
| `X-XSS-Protection` | `1; mode=block` | Protección XSS en navegadores antiguos |

---

## 7. Consideraciones HTTPS (TLS)

Para desarrollo local con HTTPS real, se recomienda usar `mkcert`:

```bash
# Instalar mkcert (Windows)
choco install mkcert

# Crear certificado local de confianza
mkcert -install
mkcert localhost 127.0.0.1

# Los archivos generados se usan en server.js:
# localhost+1.pem  (certificado)
# localhost+1-key.pem (llave privada)
```

En producción, se debe usar un certificado real de una CA (Let's Encrypt, etc.) y configurar NGINX o un proxy reverso para terminar TLS.

---

## 8. Estructura de Carpetas del Proyecto

```
proyecto-final/
├── docs/
│   ├── arquitectura.md          ← Este archivo
│   ├── modelo_amenazas.md       ← DFD + Tabla STRIDE
│   └── reporte_auditoria.md     ← Plantilla SAST/DAST
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js            ← Punto de entrada del servidor
│       ├── database/
│       │   └── init.js          ← Inicialización de SQLite
│       ├── middleware/
│       │   ├── authMiddleware.js ← Verificación JWT + RBAC
│       │   └── errorHandler.js  ← Manejo centralizado de errores
│       ├── routes/
│       │   ├── authRoutes.js    ← Rutas de login/registro
│       │   └── expedientesRoutes.js
│       ├── controllers/
│       │   ├── authController.js
│       │   └── expedientesController.js
│       ├── validators/
│       │   └── schemas.js       ← Esquemas de validación Zod
│       └── utils/
│           └── logger.js        ← Configuración Winston
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/
        │   └── client.js        ← Axios con interceptores JWT
        ├── context/
        │   └── AuthContext.jsx  ← Estado global de autenticación
        └── components/
            ├── Login.jsx
            ├── Register.jsx
            ├── Dashboard.jsx
            ├── AdminPanel.jsx
            └── PrivateRoute.jsx
```

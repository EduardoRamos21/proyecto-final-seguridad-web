# README.md — Sistema de Gestión de Expedientes Médicos
# Proyecto Final: Seguridad en Aplicaciones Web

> **Ejercicio 5.2** — Proyecto integrador en parejas

---

## 📋 Descripción

Sistema web seguro para gestionar expedientes médicos, desarrollado como proyecto final del módulo de **Seguridad en Aplicaciones Web**. La seguridad fue incorporada **desde el diseño** (Security by Design), implementando múltiples capas de protección.

**Stack:** Node.js + Express (Backend) · React + Vite (Frontend) · SQLite (BD)

---

## 🏗️ Estructura del Proyecto

```
Proyecto Final/
├── docs/
│   ├── arquitectura.md        # Diagramas de arquitectura y flujo de datos
│   ├── modelo_amenazas.md     # DFD + Tabla STRIDE (12 amenazas)
│   └── reporte_auditoria.md  # Plantilla para SonarLint + OWASP ZAP
├── backend/
│   ├── package.json
│   ├── .env.example           # Variables de entorno (copiar como .env)
│   └── src/
│       ├── server.js          # Servidor principal con Helmet, CORS, Rate Limit
│       ├── database/
│       │   ├── init.js        # Script de inicialización de SQLite
│       │   └── db.js          # Conexión singleton a la BD
│       ├── middleware/
│       │   ├── authMiddleware.js  # JWT + RBAC + Anti-IDOR
│       │   └── errorHandler.js   # Errores centralizados
│       ├── routes/
│       │   ├── authRoutes.js
│       │   └── expedientesRoutes.js
│       ├── controllers/
│       │   ├── authController.js
│       │   └── expedientesController.js
│       ├── validators/
│       │   └── schemas.js     # Esquemas Zod
│       └── utils/
│           └── logger.js      # Winston con censura de datos sensibles
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx            # Rutas protegidas
        ├── main.jsx
        ├── api/client.js      # Axios + interceptores JWT
        ├── context/AuthContext.jsx
        ├── components/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── Dashboard.jsx  # Rol: user
        │   ├── AdminPanel.jsx # Rol: admin
        │   └── PrivateRoute.jsx
        └── styles/index.css
```

---

## 🚀 Instalación y Ejecución

### Requisitos Previos
- Node.js >= 18.0
- npm >= 9.0

### 1. Clonar / Descomprimir el proyecto

### 2. Configurar el Backend

```bash
# Entrar a la carpeta del backend
cd backend

# Instalar dependencias
npm install

# Copiar el archivo de variables de entorno
copy .env.example .env       # Windows
# cp .env.example .env        # Linux/Mac

# ⚠️ EDITAR el archivo .env y cambiar JWT_SECRET por una cadena aleatoria larga
# Puedes generar una con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Inicializar la base de datos (crea las tablas y datos de prueba)
npm run init-db

# Iniciar el servidor de desarrollo
npm run dev
```

El backend estará en: `http://localhost:3001`

### 3. Configurar el Frontend

```bash
# En otra terminal, entrar a la carpeta del frontend
cd frontend

# Instalar dependencias
npm install

# Iniciar el servidor de desarrollo
npm run dev
```

El frontend estará en: `http://localhost:5173`

### 4. Abrir en el navegador

Ir a: **http://localhost:5173**

---

## 🔑 Credenciales de Prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| 👑 Administrador | admin@hospital.com | Admin@123456 |
| 👤 Paciente 1 | juan.perez@email.com | User@123456 |
| 👤 Paciente 2 | maria.lopez@email.com | User@123456 |

---

## 🛡️ Controles de Seguridad Implementados

| # | Control | Capa | Implementación |
|---|---------|------|---------------|
| 1 | **Hashing de contraseñas** | Backend | bcrypt con 12 rondas de sal |
| 2 | **JWT con expiración corta** | Backend | Tokens de 15 minutos |
| 3 | **Rate Limiting** | Backend | 5 intentos de login / 15 min por IP |
| 4 | **Mensajes de error genéricos** | Backend | "Usuario o contraseña incorrectos" sin revelar si el email existe |
| 5 | **Validación de entrada (Zod)** | Backend | Esquemas estrictos en todos los endpoints |
| 6 | **Consultas parametrizadas** | Backend | `better-sqlite3` con `?` en todas las consultas |
| 7 | **Anti-IDOR** | Backend | Middleware `verificarPropietario` compara `usuario_id` |
| 8 | **Control de acceso por rol (RBAC)** | Backend | Middleware `requireRole('admin')` |
| 9 | **Cabeceras HTTP seguras** | Backend | Helmet: CSP, HSTS, X-Frame-Options, noSniff |
| 10 | **CORS restringido** | Backend | Solo origen del frontend permitido |
| 11 | **Errores genéricos en producción** | Backend | `errorHandler` oculta stack traces en `NODE_ENV=production` |
| 12 | **Logs de auditoría seguros** | Backend | Winston sin contraseñas ni datos médicos en logs |
| 13 | **Secrets en `.env`** | Backend | Clave JWT y configuración fuera del código |
| 14 | **Validación en cliente** | Frontend | Regex, longitud y complejidad de contraseña |
| 15 | **JWT en sessionStorage** | Frontend | No se usa localStorage (se borra al cerrar tab) |
| 16 | **Rutas protegidas** | Frontend | `PrivateRoute` verifica autenticación y rol |
| 17 | **Interceptores Axios** | Frontend | Manejo automático de token expirado (401) |

---

## 📊 Puntos del Ejercicio 5.2 Cubiertos

- [x] **1. Registro/Login** + módulo de búsqueda + panel de admin con roles
- [x] **2. DFD + Tabla STRIDE** (≥8 amenazas) → `docs/modelo_amenazas.md`
- [x] **3. Prevención SQLi** + validación cliente/servidor (Zod + consultas parametrizadas)
- [x] **4. Autenticación segura**: bcrypt, JWT corto, RBAC, mensajes genéricos
- [x] **5. Manejo de errores** + Helmet (CSP, HSTS, X-Content-Type, X-Frame, Referrer)
- [x] **6. CORS restringido** + Rate Limiting en endpoints sensibles + JWT en API
- [x] **7. Logs de auditoría** (login exitoso/fallido, acceso denegado, cambios) sin datos sensibles
- [x] **8. Plantilla SAST/DAST** lista para llenar → `docs/reporte_auditoria.md`

---

## 🔍 Cómo Ejecutar el Análisis de Seguridad

### SAST con SonarLint
1. Instalar la extensión **SonarLint** en VS Code
2. Abrir el proyecto
3. Ver el panel "SonarLint" y revisar alertas
4. Llenar la sección SAST del `docs/reporte_auditoria.md`

### DAST con OWASP ZAP
1. Descargar [OWASP ZAP](https://www.zaproxy.org/download/)
2. Con el servidor corriendo: `Automated Scan` → URL: `http://localhost:3001`
3. Clic en "Attack" y esperar el escaneo
4. Exportar reporte HTML
5. Llenar la sección DAST del `docs/reporte_auditoria.md`

---

## 👥 Equipo

- ___________________________
- ___________________________

**Institución:** UNACH  
**Módulo:** Seguridad en Aplicaciones Web  
**Fecha:** ___________________________

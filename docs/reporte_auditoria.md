# Reporte de Auditoría de Seguridad
## Sistema de Gestión de Expedientes Médicos

**Proyecto:** Sistema de Gestión de Expedientes Médicos  
**Equipo:** ___________________________  
**Fecha de Análisis:** ___________________________  
**Versión del Código Auditado:** ___________________________  

---

## PARTE 1: Análisis Estático de Código (SAST) con SonarLint

> **¿Qué es SAST?** El análisis estático examina el código fuente sin ejecutarlo, buscando patrones peligrosos como variables sin sanitizar, contraseñas hardcodeadas, etc.
>
> **Herramienta utilizada:** SonarLint (extensión de VS Code / IntelliJ)  
> **Cómo ejecutarlo:** Instalar la extensión SonarLint, abrir el proyecto y revisar el panel "SonarLint" en el IDE.

---

### 1.1 Hallazgos SAST - ANTES de correcciones

| # | Archivo | Línea | Tipo de Vulnerabilidad | Severidad | Descripción del Hallazgo |
|---|---------|-------|----------------------|-----------|--------------------------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |

> 💡 **Instrucciones:** Llena esta tabla con los hallazgos reales de SonarLint. Las categorías más comunes que busca SonarLint en Node.js son:
> - `javascript:S2068` → Contraseñas hardcodeadas
> - `javascript:S4790` → Algoritmos de hash débiles (MD5, SHA1)
> - `javascript:S2076` → Inyección de comandos OS
> - `javascript:S6096` → Path traversal
> - `javascript:S5734` → Cabeceras HTTP de seguridad faltantes
> - `typescript:S4524` → Casos no manejados en switch

---

### 1.2 Correcciones Aplicadas - DESPUÉS

| # | Hallazgo (ref. tabla anterior) | Corrección Aplicada | Archivo(s) Modificado(s) | Estado |
|---|-------------------------------|--------------------|--------------------------|----|
| 1 | | | | ✅ / ⏳ |
| 2 | | | | ✅ / ⏳ |
| 3 | | | | ✅ / ⏳ |
| 4 | | | | ✅ / ⏳ |
| 5 | | | | ✅ / ⏳ |

---

### 1.3 Captura de Pantalla - SonarLint ANTES

> 📸 **Insertar aquí captura de pantalla del panel de SonarLint mostrando los errores encontrados.**

```
[INSERTAR IMAGEN AQUÍ]
```

---

### 1.4 Captura de Pantalla - SonarLint DESPUÉS

> 📸 **Insertar aquí captura de pantalla del panel de SonarLint mostrando 0 errores o los errores corregidos.**

```
[INSERTAR IMAGEN AQUÍ]
```

---

## PARTE 2: Análisis Dinámico de Aplicación (DAST) con OWASP ZAP

> **¿Qué es DAST?** El análisis dinámico ataca la aplicación **en ejecución** (como lo haría un hacker) para encontrar vulnerabilidades que solo aparecen en tiempo de ejecución.
>
> **Herramienta utilizada:** OWASP ZAP (Zed Attack Proxy)  
> **Versión:** ___________________________
>
> ### Pasos para ejecutar OWASP ZAP:
> 1. Descargar ZAP desde: https://www.zaproxy.org/download/
> 2. Iniciar la aplicación (backend en `http://localhost:3001` y frontend en `http://localhost:5173`)
> 3. En ZAP: `Automated Scan` → Ingresar URL: `http://localhost:3001`
> 4. Hacer clic en `Attack`
> 5. Esperar a que finalice el escaneo (5-15 minutos)
> 6. Exportar reporte: `Report` → `Generate HTML Report`

---

### 2.1 Configuración del Escaneo

| Parámetro | Valor |
|-----------|-------|
| URL objetivo | `http://localhost:3001` |
| Tipo de escaneo | Automated Scan (Spider + Active Scan) |
| Políticas de escaneo | Default Attack Policy |
| Duración del escaneo | _______________ minutos |
| Fecha del escaneo | _______________ |
| Usuario ZAP autenticado | Sí / No |

---

### 2.2 Resumen de Alertas DAST - ANTES de correcciones

| Nivel | Cantidad encontrada |
|-------|-------------------|
| 🔴 Alto (High) | |
| 🟠 Medio (Medium) | |
| 🟡 Bajo (Low) | |
| ℹ️ Informacional | |
| **TOTAL** | |

---

### 2.3 Detalle de Hallazgos DAST - ANTES

| # | Nombre de la Alerta (ZAP) | URL Afectada | Método HTTP | Nivel | Descripción / Evidencia | CWE / OWASP ID |
|---|--------------------------|-------------|------------|-------|------------------------|---------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |

> 💡 **Alertas comunes que ZAP encontrará en este proyecto (según configuración):**
> - `X-Content-Type-Options Header Missing` → Corregido con Helmet
> - `Content Security Policy (CSP) Header Not Set` → Corregido con Helmet
> - `Cookie Without SameSite Attribute` → Revisar cookies de sesión
> - `SQL Injection` → Verificar si las consultas parametrizadas funcionan
> - `Cross-Site Request Forgery (CSRF)` → Considerar agregar token CSRF
> - `Server Leaks Version Information via "Server" HTTP Response Header` → Corregir con Helmet

---

### 2.4 Correcciones Aplicadas - DESPUÉS

| # | Hallazgo ZAP | Corrección Aplicada | Archivo Modificado | Verificado |
|---|-------------|--------------------|--------------------|-----------|
| 1 | | | | ✅ / ⏳ |
| 2 | | | | ✅ / ⏳ |
| 3 | | | | ✅ / ⏳ |
| 4 | | | | ✅ / ⏳ |
| 5 | | | | ✅ / ⏳ |

---

### 2.5 Resumen de Alertas DAST - DESPUÉS de correcciones

| Nivel | Antes | Después | Reducción |
|-------|-------|---------|-----------|
| 🔴 Alto (High) | | | |
| 🟠 Medio (Medium) | | | |
| 🟡 Bajo (Low) | | | |
| ℹ️ Informacional | | | |
| **TOTAL** | | | |

---

### 2.6 Captura de Pantalla - OWASP ZAP ANTES

> 📸 **Insertar aquí captura de pantalla del reporte ZAP mostrando las alertas encontradas.**

```
[INSERTAR IMAGEN AQUÍ]
```

---

### 2.7 Captura de Pantalla - OWASP ZAP DESPUÉS

> 📸 **Insertar aquí captura de pantalla del reporte ZAP mostrando las alertas corregidas.**

```
[INSERTAR IMAGEN AQUÍ]
```

---

## PARTE 3: Verificación Manual de Controles de Seguridad

> Esta sección verifica manualmente los controles de seguridad que deben estar implementados según los requerimientos del Ejercicio 5.2.

| # | Control de Seguridad | ¿Implementado? | Evidencia / Archivo | Notas |
|---|---------------------|---------------|---------------------|-------|
| 1 | Contraseñas hasheadas con bcrypt/Argon2id | ✅ / ❌ | `backend/src/controllers/authController.js` | |
| 2 | JWT con expiración corta (≤30 min) | ✅ / ❌ | `backend/src/server.js` | |
| 3 | Rate limiting en endpoint de login | ✅ / ❌ | `backend/src/server.js` | |
| 4 | Mensajes de error genéricos en auth | ✅ / ❌ | `backend/src/controllers/authController.js` | |
| 5 | Validación de entrada con Zod en backend | ✅ / ❌ | `backend/src/validators/schemas.js` | |
| 6 | Consultas SQL parametrizadas (no concatenadas) | ✅ / ❌ | `backend/src/controllers/` | |
| 7 | Protección IDOR verificando propietario | ✅ / ❌ | `backend/src/middleware/authMiddleware.js` | |
| 8 | Control de acceso por rol (RBAC) | ✅ / ❌ | `backend/src/middleware/authMiddleware.js` | |
| 9 | Cabeceras HTTP con Helmet (CSP, HSTS, etc.) | ✅ / ❌ | `backend/src/server.js` | |
| 10 | CORS restringido al origen del frontend | ✅ / ❌ | `backend/src/server.js` | |
| 11 | Errores genéricos en producción (sin stack trace) | ✅ / ❌ | `backend/src/middleware/errorHandler.js` | |
| 12 | Logs de auditoría (login/logout/errores) | ✅ / ❌ | `backend/src/utils/logger.js` | |
| 13 | Logs NO contienen contraseñas ni datos médicos | ✅ / ❌ | `backend/src/utils/logger.js` | |
| 14 | Secrets en .env (no hardcodeados) | ✅ / ❌ | `backend/.env` | |
| 15 | HTTPS configurado o documentado | ✅ / ❌ | `docs/arquitectura.md` | |

---

## PARTE 4: Conclusiones y Lecciones Aprendidas

### 4.1 Resumen Ejecutivo

> Escribir aquí un párrafo resumiendo: cuántas vulnerabilidades se encontraron, cuáles eran las más críticas, y qué porcentaje se corrigió.

_[COMPLETAR DESPUÉS DEL ANÁLISIS]_

---

### 4.2 Vulnerabilidades Críticas y Cómo se Corrigieron

> Describir con detalle las 2-3 vulnerabilidades más importantes encontradas y el proceso de corrección.

**Vulnerabilidad 1:**
- **Descripción:** _[Completar]_
- **Código antes:** _(opcional: pegar snippet)_
- **Código después:** _(opcional: pegar snippet)_
- **Impacto si no se hubiera corregido:** _[Completar]_

**Vulnerabilidad 2:**
- **Descripción:** _[Completar]_
- **Corrección:** _[Completar]_

---

### 4.3 Lecciones Aprendidas

> Completar con reflexiones del equipo sobre el proceso de desarrollo seguro.

1. _[Completar]_
2. _[Completar]_
3. _[Completar]_

---

### 4.4 Recomendaciones Futuras (trabajo pendiente)

| Recomendación | Prioridad | Esfuerzo estimado |
|--------------|-----------|------------------|
| Implementar autenticación de dos factores (2FA) | Alta | Media |
| Agregar protección CSRF con tokens | Alta | Baja |
| Cifrar datos médicos en reposo (campo a campo) | Alta | Alta |
| Implementar refresh tokens para sesiones más largas | Media | Media |
| Agregar WAF (Web Application Firewall) en producción | Media | Alta |
| Auditoría de dependencias con `npm audit` automatizado en CI/CD | Baja | Baja |

---

*Reporte generado el: ___________________________*  
*Firmado por: ___________________________*

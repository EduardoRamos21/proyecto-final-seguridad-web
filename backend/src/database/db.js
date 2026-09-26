// =============================================================================
// MÓDULO DE CONEXIÓN A LA BASE DE DATOS
// =============================================================================
// Este módulo crea UNA SOLA conexión a SQLite y la reutiliza en toda la app.
// Esto se llama patrón "Singleton" - evita abrir 100 conexiones innecesarias.
// =============================================================================

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

// Ruta al archivo de base de datos (configurable por variable de entorno)
const DB_PATH = process.env.DB_PATH || './database.db';

// Creamos la conexión a la base de datos
// Si el archivo no existe, SQLite lo crea automáticamente
const db = new Database(path.resolve(DB_PATH));

// Activamos claves foráneas para mantener integridad referencial
// (que no se puedan crear expedientes de usuarios que no existen)
db.pragma('foreign_keys = ON');

// Modo WAL: más eficiente para múltiples lecturas simultáneas
db.pragma('journal_mode = WAL');

// Exportamos la conexión para que otros módulos la usen
// Gracias a cómo funciona Node.js, esta conexión se crea solo una vez
module.exports = db;

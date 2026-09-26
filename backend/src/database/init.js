// =============================================================================
// INICIALIZACIÓN DE LA BASE DE DATOS SQLITE
// =============================================================================
// Este script crea las tablas necesarias y agrega datos de prueba.
// Ejecutar UNA VEZ con: node src/database/init.js
// =============================================================================

// Cargamos las variables de entorno ANTES de todo, para poder usarlas
require('dotenv').config();

// Importamos bcrypt para hashear las contraseñas de los usuarios de prueba
// Nunca guardamos contraseñas en texto plano, ni siquiera en los datos de prueba
const bcrypt = require('bcrypt');

// Importamos el módulo para conectar con SQLite
const Database = require('better-sqlite3');

// Importamos el logger para registrar qué pasó durante la inicialización
const path = require('path');

// ---------------------------------------------------------------
// CONEXIÓN A LA BASE DE DATOS
// ---------------------------------------------------------------
// Creamos (o abrimos si ya existe) el archivo de base de datos
// La ruta viene del archivo .env para que sea configurable
const DB_PATH = process.env.DB_PATH || './database.db';

console.log(`[DB Init] Conectando a la base de datos en: ${DB_PATH}`);

// { verbose: ... } hace que SQLite imprima las consultas en consola durante desarrollo
// En producción lo quitaríamos para no llenar los logs
const db = new Database(DB_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : null
});

// ---------------------------------------------------------------
// PRAGMA DE SEGURIDAD
// ---------------------------------------------------------------
// Activamos claves foráneas para que SQLite verifique relaciones entre tablas
// Por ejemplo, no permitir crear un expediente para un usuario que no existe
db.pragma('foreign_keys = ON');

// WAL mode hace que las escrituras sean más eficientes y seguras
db.pragma('journal_mode = WAL');

// ---------------------------------------------------------------
// CREACIÓN DE TABLAS
// ---------------------------------------------------------------
// Usamos una "transacción" para que si algo falla, se deshacen todos los cambios
// Esto evita que la base de datos quede en un estado inconsistente (a medias)
const inicializarTablas = db.transaction(() => {

  console.log('[DB Init] Creando tabla de usuarios...');

  // TABLA DE USUARIOS
  // Guardamos el hash de la contraseña, NUNCA la contraseña real
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      -- password_hash: aquí va el resultado de bcrypt, no la contraseña real
      -- Si alguien roba la base de datos, solo verá un hash irreversible
      password_hash TEXT  NOT NULL,
      -- rol define lo que puede hacer el usuario: 'admin' puede todo, 'user' solo lo suyo
      rol         TEXT    NOT NULL DEFAULT 'user' CHECK(rol IN ('admin', 'user')),
      -- Guardamos cuándo se creó la cuenta para auditoría
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('[DB Init] Creando tabla de expedientes médicos...');

  // TABLA DE EXPEDIENTES MÉDICOS (datos sensibles)
  // La columna usuario_id es una CLAVE FORÁNEA que apunta a la tabla usuarios
  // Esto garantiza integridad referencial: no puede haber expediente sin usuario
  db.exec(`
    CREATE TABLE IF NOT EXISTS expedientes_medicos (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      -- usuario_id relaciona el expediente con el paciente (dueño del expediente)
      -- REFERENCIAS: si el usuario se borra, CASCADE borra sus expedientes también
      usuario_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nombre_paciente     TEXT    NOT NULL,
      -- Los campos médicos son datos sensibles (PHI - Protected Health Information)
      diagnostico         TEXT    NOT NULL,
      tratamiento         TEXT    NOT NULL,
      medicamentos        TEXT,
      -- Notas adicionales que solo debe ver el médico o el propio paciente
      notas_medico        TEXT,
      medico_responsable  TEXT    NOT NULL,
      fecha_consulta      DATE    NOT NULL,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Índice para acelerar búsquedas por usuario_id (muy frecuente)
  // Sin índice, SQLite haría un "full scan" lento en tablas grandes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expedientes_usuario 
    ON expedientes_medicos(usuario_id)
  `);

  console.log('[DB Init] Tablas creadas exitosamente.');
});

// ---------------------------------------------------------------
// DATOS DE PRUEBA (SEED DATA)
// ---------------------------------------------------------------
// Esta función agrega usuarios y expedientes de prueba.
// En producción NO se ejecutaría esto.
// NOTA: better-sqlite3 es SÍNCRONO, así que hasheamos las contraseñas
// ANTES de pasarlas a la transacción.
const agregarDatosDePrueba = async () => {

  // Primero verificamos si ya hay usuarios para no duplicar (fuera de transacción)
  const usuariosExistentes = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
  
  if (usuariosExistentes.count > 0) {
    console.log('[DB Init] Ya existen datos de prueba, omitiendo seed.');
    return;
  }

  console.log('[DB Init] Hasheando contraseñas (esto puede tardar unos segundos)...');

  // Hasheamos las contraseñas ANTES de la transacción (bcrypt es asíncrono)
  // saltRounds=12 significa 2^12 = 4096 iteraciones, hace brute force muy lento
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  const hashAdmin    = await bcrypt.hash('Admin@123456', saltRounds);
  const hashUsuario1 = await bcrypt.hash('User@123456',  saltRounds);
  const hashUsuario2 = await bcrypt.hash('User@123456',  saltRounds);

  // Ahora usamos una transacción SÍNCRONA para insertar todo de golpe
  // Si algo falla, se hace rollback y la BD queda limpia
  const insertarTodo = db.transaction(() => {
    console.log('[DB Init] Agregando usuarios de prueba...');

    // Insertamos con consultas PARAMETRIZADAS (los ? son parámetros seguros)
    const insertUsuario = db.prepare(`
      INSERT INTO usuarios (nombre, email, password_hash, rol) 
      VALUES (?, ?, ?, ?)
    `);

    const adminResult  = insertUsuario.run('Administrador Sistema', 'admin@hospital.com',    hashAdmin,    'admin');
    const user1Result  = insertUsuario.run('Juan Pérez García',    'juan.perez@email.com',   hashUsuario1, 'user');
    const user2Result  = insertUsuario.run('María López Torres',   'maria.lopez@email.com',  hashUsuario2, 'user');

    console.log('[DB Init] Usuarios creados:', {
      admin: adminResult.lastInsertRowid,
      usuario1: user1Result.lastInsertRowid,
      usuario2: user2Result.lastInsertRowid
    });

    console.log('[DB Init] Agregando expedientes médicos de prueba...');

    const insertExpediente = db.prepare(`
      INSERT INTO expedientes_medicos 
      (usuario_id, nombre_paciente, diagnostico, tratamiento, medicamentos, notas_medico, medico_responsable, fecha_consulta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Expedientes del primer paciente
    insertExpediente.run(
      user1Result.lastInsertRowid, 'Juan Pérez García',
      'Hipertensión arterial grado 1',
      'Cambios en estilo de vida, dieta baja en sodio, ejercicio moderado',
      'Losartán 50mg - 1 tableta diaria',
      'Paciente controlado. Revisión en 3 meses.',
      'Dr. Carlos Mendoza', '2024-01-15'
    );

    insertExpediente.run(
      user1Result.lastInsertRowid, 'Juan Pérez García',
      'Gripe estacional',
      'Reposo relativo, hidratación abundante',
      'Paracetamol 500mg cada 8h por 3 días',
      'Cuadro leve. Alta médica.',
      'Dra. Ana Rivas', '2024-03-22'
    );

    // Expediente de la segunda paciente
    insertExpediente.run(
      user2Result.lastInsertRowid, 'María López Torres',
      'Diabetes mellitus tipo 2',
      'Control glucémico, dieta diabética, ejercicio aeróbico',
      'Metformina 850mg - 2 veces al día con comidas',
      'Glucosa en ayunas: 145 mg/dL. Control en 1 mes con HbA1c.',
      'Dr. Roberto Silva', '2024-02-10'
    );

    console.log('[DB Init] Expedientes de prueba creados exitosamente.');
  });

  // Ejecutamos la transacción síncrona
  insertarTodo();

  console.log('\n========================================');
  console.log('✅ Base de datos inicializada correctamente');
  console.log('========================================');
  console.log('Credenciales de prueba:');
  console.log('  ADMIN:   admin@hospital.com     / Admin@123456');
  console.log('  USUARIO: juan.perez@email.com   / User@123456');
  console.log('  USUARIO: maria.lopez@email.com  / User@123456');
  console.log('========================================\n');
};

// ---------------------------------------------------------------
// EJECUTAR LA INICIALIZACIÓN
// ---------------------------------------------------------------
(async () => {
  try {
    // Primero creamos las tablas (sincrónico)
    inicializarTablas();
    
    // Luego agregamos los datos de prueba (asíncrono por bcrypt)
    await agregarDatosDePrueba();
    
    // Cerramos la conexión de forma limpia
    db.close();
    
    console.log('[DB Init] Proceso completado. Conexión cerrada.');
    
  } catch (error) {
    console.error('[DB Init] ERROR durante la inicialización:', error.message);
    try { db.close(); } catch(e) {}
    process.exit(1);
  }
})();

// Exportamos la función para poder llamarla desde otros módulos si es necesario
module.exports = { inicializarTablas };

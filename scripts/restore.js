import { readFileSync } from 'node:fs';
import { openDatabase, migrate } from '../server/db.js';
const path = process.argv[2];
if (!path)
  throw new Error('Uso: node --env-file-if-exists=.env scripts/restore.js backups/archivo.json');
const backup = JSON.parse(readFileSync(path, 'utf8'));
if (backup.tables && backup.tables.notifications === undefined) backup.tables.notifications = [];
if (backup.tables && backup.tables.professional_supplies === undefined) backup.tables.professional_supplies = [];
const tables = [
  'users',
  'services',
  'appointments',
  'notifications',
  'payments',
  'products',
  'stock_movements',
  'professional_supplies',
  'availability',
  'settings',
];
if (backup.version !== 1 || !backup.tables || !tables.every((t) => Array.isArray(backup.tables[t])))
  throw new Error('El archivo no es una copia compatible de SALONEY.');
const db = await openDatabase();
await migrate(db);
try {
  for (const table of tables)
    if ((await db.all(`SELECT COUNT(*) n FROM ${table}`))[0].n)
      throw new Error(
        'La restauración requiere una base vacía. No se reemplazarán datos existentes.',
      );
  await db.run(db.kind === 'mysql' ? 'START TRANSACTION' : 'BEGIN IMMEDIATE');
  try {
    for (const table of tables) {
      const columns = (
        db.kind === 'mysql'
          ? await db.all(`SHOW COLUMNS FROM ${table}`)
          : await db.all(`PRAGMA table_info(${table})`)
      ).map((r) => r.Field || r.name);
      for (const row of backup.tables[table]) {
        const keys = Object.keys(row);
        if (keys.some((k) => !columns.includes(k)))
          throw new Error('Columnas inválidas en ' + table);
        await db.run(
          `INSERT INTO ${table} (${keys.map((k) => '`' + k + '`').join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
          keys.map((k) => row[k]),
        );
      }
    }
    await db.run('COMMIT');
    console.log('Copia restaurada. Las sesiones anteriores no se recuperan.');
  } catch (e) {
    await db.run('ROLLBACK');
    throw e;
  }
} finally {
  await db.close();
}

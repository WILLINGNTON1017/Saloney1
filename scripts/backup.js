import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from '../server/db.js';
const db = await openDatabase();
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
await db.run(db.kind === 'mysql' ? 'START TRANSACTION WITH CONSISTENT SNAPSHOT' : 'BEGIN');
try {
  const snapshot = {
    version: 1,
    created_at: new Date().toISOString(),
    driver: db.kind,
    tables: {},
  };
  for (const table of tables) snapshot.tables[table] = await db.all(`SELECT * FROM ${table}`);
  await db.run('COMMIT');
  mkdirSync('backups', { recursive: true });
  const path = resolve('backups', `saloney-${new Date().toISOString().replaceAll(':', '-')}.json`);
  writeFileSync(path, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  console.log('Copia de seguridad creada: ' + path);
} catch (e) {
  await db.run('ROLLBACK');
  throw e;
} finally {
  await db.close();
}

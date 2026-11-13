import { mkdirSync, writeFileSync } from 'node:fs';
import { openDatabase } from '../server/db.js';

if (!process.argv.includes('--confirm'))
  throw new Error('Usa --confirm solo para vaciar el inventario con respaldo.');
const db = await openDatabase();
try {
  await db.run(db.kind === 'mysql' ? 'START TRANSACTION' : 'BEGIN IMMEDIATE');
  if (db.kind === 'mysql') await db.all('SELECT id FROM app_lock WHERE id=1 FOR UPDATE');
  const tables = {};
  for (const name of ['users', 'services', 'appointments', 'notifications', 'payments',
    'products', 'stock_movements', 'professional_supplies', 'availability', 'settings'])
    tables[name] = await db.all(`SELECT * FROM ${name}`);
  mkdirSync('backups', { recursive: true });
  const path = 'backups/antes-reinicio-inventario-' + new Date().toISOString().replaceAll(':', '-') + '.json';
  writeFileSync(path, JSON.stringify({ version: 1, created_at: new Date().toISOString(), driver: db.kind, tables }, null, 2), { flag: 'wx', mode: 0o600 });
  const remaining = {};
  for (const name of ['professional_supplies', 'stock_movements', 'products']) {
    await db.run(`DELETE FROM ${name}`);
    remaining[name] = (await db.all(`SELECT COUNT(*) n FROM ${name}`))[0].n;
    if (Number(remaining[name]) !== 0) throw new Error('No se pudo vaciar ' + name);
  }
  for (const name of ['users', 'appointments', 'payments']) {
    if (Number((await db.all(`SELECT COUNT(*) n FROM ${name}`))[0].n) !== tables[name].length)
      throw new Error('Cambió un registro fuera del inventario.');
  }
  await db.run('COMMIT');
  console.log(JSON.stringify({ backup: path, inventario: remaining, conservados: {
    usuarios: tables.users.length, citas: tables.appointments.length, pagos: tables.payments.length,
  } }));
} catch (error) {
  await db.run('ROLLBACK');
  throw error;
} finally {
  await db.close();
}

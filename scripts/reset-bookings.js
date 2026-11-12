import { mkdirSync, writeFileSync } from 'node:fs';
import { openDatabase } from '../server/db.js';
if (!process.argv.includes('--confirm'))
  throw Error('Usar --confirm solo para reiniciar citas y pagos con respaldo.');
const db = await openDatabase();
try {
  await db.run(db.kind === 'mysql' ? 'START TRANSACTION' : 'BEGIN IMMEDIATE');
  if (db.kind === 'mysql') await db.all('SELECT id FROM app_lock WHERE id=1 FOR UPDATE');
  const tables = {};
  for (const name of [
    'users',
    'services',
    'appointments',
    'notifications',
    'payments',
    'products',
    'stock_movements',
    'availability',
    'settings',
  ])
    tables[name] = await db.all(`SELECT * FROM ${name}`);
  mkdirSync('backups', { recursive: true });
  const path = 'backups/antes-reinicio-' + new Date().toISOString().replaceAll(':', '-') + '.json';
  writeFileSync(
    path,
    JSON.stringify(
      { version: 1, created_at: new Date().toISOString(), driver: db.kind, tables },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  );
  for (const name of ['notifications', 'payments', 'appointments'])
    await db.run(`DELETE FROM ${name}`);
  await db.run('COMMIT');
  console.log(
    JSON.stringify({
      backup: path,
      eliminados: {
        citas: tables.appointments.length,
        pagos: tables.payments.length,
        avisos: tables.notifications.length,
      },
      citas: (await db.all('SELECT COUNT(*) n FROM appointments'))[0].n,
      pagos: (await db.all('SELECT COUNT(*) n FROM payments'))[0].n,
    }),
  );
} catch (e) {
  await db.run('ROLLBACK');
  throw e;
} finally {
  await db.close();
}

import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
if (existsSync('.env')) throw new Error('.env ya existe. No se reemplazará.');
const c = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: '',
});
const appPassword = randomBytes(24).toString('hex'),
  rootPassword = randomBytes(32).toString('hex');
try {
  await c.query(
    'CREATE DATABASE IF NOT EXISTS saloney CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  await c.query("CREATE USER 'saloney'@'localhost' IDENTIFIED BY ?", [appPassword]);
  await c.query(
    "GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES ON saloney.* TO 'saloney'@'localhost'",
  );
  await c.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [rootPassword]);
  writeFileSync(
    '.env',
    `PORT=3000\nHOST=127.0.0.1\nDB_DRIVER=mysql\nMYSQL_HOST=127.0.0.1\nMYSQL_PORT=3307\nMYSQL_USER=saloney\nMYSQL_PASSWORD=${appPassword}\nMYSQL_DATABASE=saloney\nMYSQL_ROOT_PASSWORD=${rootPassword}\nDEMO_SEED=true\nNODE_ENV=development\n`,
    { mode: 0o600 },
  );
  console.log('MySQL de SALONEY configurado en el puerto 3307. Credenciales guardadas en .env.');
} finally {
  await c.end();
}

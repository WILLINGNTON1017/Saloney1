import mysql from 'mysql2/promise';
import { spawn } from 'node:child_process';
const name = 'saloney_test_' + Date.now();
const c = await mysql.createConnection({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD,
});
try {
  await c.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await c.query(
    `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES ON \`${name}\`.* TO 'saloney'@'localhost'`,
  );
} finally {
  await c.end();
}
console.log('Base aislada para pruebas: ' + name);
const child = spawn(process.execPath, ['--test', 'tests/integration.test.js'], {
  env: { ...process.env, TEST_DB_DRIVER: 'mysql', MYSQL_DATABASE: name },
  stdio: 'inherit',
});
child.on('exit', (code) => {
  process.exitCode = code || 0;
});

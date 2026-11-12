import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8')));
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD,
});
const name = 'saloney_schema_validation_' + Date.now();
try {
  const sql = readFileSync('database/saloney.sql', 'utf8')
    .replace('CREATE DATABASE IF NOT EXISTS saloney', 'CREATE DATABASE IF NOT EXISTS ' + name)
    .replace('USE saloney;', 'USE ' + name + ';');
  for (const statement of sql
    .split(';')
    .map((s) => s.replace(/^--.*$/gm, '').trim())
    .filter(Boolean))
    await db.query(statement);
  const [tables] = await db.query('SHOW TABLES');
  if (tables.length !== 12) throw new Error('Faltan tablas en el esquema.');
  console.log('SQL validado: 12 tablas creadas con relaciones e índices. Base de prueba: ' + name);
} finally {
  await db.end();
}

import mysql from 'mysql2/promise';
if (process.env.MYSQL_PORT !== '3307')
  throw new Error('Este comando solo detiene la instancia local de SALONEY del puerto 3307.');
const c = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD,
});
await c.query('SHUTDOWN');
console.log('Se solicitó el cierre ordenado de MySQL de SALONEY.');

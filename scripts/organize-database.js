import mysql from 'mysql2/promise';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8')));
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});
const tables = [
  ['users', 'USUARIOS Y ROLES', 'Cuentas de clientes, manicuristas y administradores.'],
  ['services', 'SERVICIOS', 'Catálogo, precio en COP y duración en minutos.'],
  [
    'appointments',
    'CITAS',
    'La cliente elige la manicurista. Las reservas sin cuenta guardan nombre y teléfono.',
  ],
  [
    'notifications',
    'NOTIFICACIONES',
    'Avisos de citas para cada manicurista y su estado de lectura.',
  ],
  ['payments', 'PAGOS', 'Un pago por cita. El importe corresponde al precio guardado al reservar.'],
  ['products', 'PRODUCTOS', 'Existencias y stock mínimo.'],
  [
    'stock_movements',
    'MOVIMIENTOS DE INVENTARIO',
    'Cantidad positiva para entrada, negativa para salida.',
  ],
  ['professional_supplies', 'PRODUCTOS EN USO', 'Asignaciones a manicuristas y registro de agotamiento.'],
  ['availability', 'DISPONIBILIDAD', 'Bloqueos de horario de cada manicurista.'],
  ['settings', 'CONFIGURACIÓN DEL SALÓN', 'Horario, contacto y reglas de reserva.'],
  ['sessions', 'SESIONES', 'Tokens guardados como hash, con vencimiento.'],
  [
    'app_lock',
    'CONTROL DE TRANSACCIONES',
    'Fila utilizada para coordinar operaciones simultáneas.',
  ],
];
const indexes = [
  ['appointments', 'idx_citas_profesional_fecha', ['professional_id', 'date', 'status']],
  ['appointments', 'idx_citas_cliente_fecha', ['client_id', 'date']],
  ['payments', 'idx_pagos_fecha_estado', ['date', 'status']],
  ['professional_supplies', 'idx_insumos_profesional', ['professional_id', 'exhausted_at']],
  ['availability', 'idx_disponibilidad_profesional_fecha', ['user_id', 'date']],
  ['sessions', 'idx_sesion_usuario', ['user_id']],
  ['sessions', 'idx_sesion_vencimiento', ['expires_at']],
  ['stock_movements', 'idx_movimientos_fecha', ['created_at']],
  ['users', 'idx_usuarios_rol_estado', ['role', 'active']],
];
try {
  for (const [table, name, columns] of indexes) {
    const [existing] = await db.execute(
      'SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?',
      [table, name],
    );
    if (!existing.length)
      await db.query(
        `ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${columns.map((c) => '`' + c + '`').join(',')})`,
      );
  }
  let sql = `-- =========================================================\n-- BASE DE DATOS: saloney\n-- Sistema de gestión para salón de uñas\n-- Estructura real del proyecto, ordenada por dependencias\n-- MySQL 8.0 / InnoDB / utf8mb4\n-- No elimina la base ni los registros existentes.\n-- Las tablas conservan sus nombres para que la aplicación siga funcionando.\n-- =========================================================\n\nCREATE DATABASE IF NOT EXISTS saloney\n    CHARACTER SET utf8mb4\n    COLLATE utf8mb4_unicode_ci;\n\nUSE saloney;\n\n`;
  for (const [i, [table, label, description]] of tables.entries()) {
    const [rows] = await db.query(`SHOW CREATE TABLE \`${table}\``);
    const ddl = rows[0]['Create Table']
      .replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS')
      .replace(/ AUTO_INCREMENT=\d+/, '');
    sql += `-- =========================================================\n-- ${i + 1}. ${label} (${table})\n-- ${description}\n-- =========================================================\n\n${ddl};\n\n`;
  }
  sql += `-- =========================================================\n-- 12. FILA DE CONTROL\n-- =========================================================\n\nINSERT INTO app_lock (id)\nSELECT 1 WHERE NOT EXISTS (SELECT 1 FROM app_lock WHERE id = 1);\n\n-- El catálogo y las cuentas se crean desde server/seed.js.\n-- No se incluyen contraseñas, sesiones ni datos personales en este archivo.\n`;
  writeFileSync('database/saloney.sql', sql, 'utf8');
  const counts = [];
  for (const [t] of tables) {
    const [[r]] = await db.query(`SELECT COUNT(*) AS total FROM \`${t}\``);
    counts.push({ tabla: t, registros: r.total });
  }
  console.log(
    JSON.stringify(
      { database: process.env.MYSQL_DATABASE, file: 'database/saloney.sql', tables: counts },
      null,
      2,
    ),
  );
} finally {
  await db.end();
}

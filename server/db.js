import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Adaptador de base de datos: ofrece las mismas operaciones para MySQL y las pruebas con SQLite.
export async function openDatabase() {
  if (process.env.DB_DRIVER === 'mysql') {
    const { default: mysql } = await import('mysql2/promise');
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || 'saloney',
      dateStrings: true,
      connectionLimit: 5,
      connectTimeout: 5000,
      enableKeepAlive: true,
    });
    let transaction = null;
    return {
      kind: 'mysql',
      all: async (q, p = []) => (await (transaction || pool).execute(q, p))[0],
      run: async (q, p = []) => {
        const begin = /^START TRANSACTION/i.test(q),
          end = /^(COMMIT|ROLLBACK)$/i.test(q);
        if (begin) {
          if (transaction) throw new Error('Ya hay una transacción activa.');
          transaction = await pool.getConnection();
        }
        try {
          const connection = transaction || pool;
          const [r] = await (p.length ? connection.execute(q, p) : connection.query(q));
          return { lastInsertRowid: r.insertId, changes: r.affectedRows };
        } catch (e) {
          if (begin && transaction) {
            transaction.release();
            transaction = null;
          }
          throw e;
        } finally {
          if (end && transaction) {
            transaction.release();
            transaction = null;
          }
        }
      },
      close: async () => {
        if (transaction) {
          transaction.release();
          transaction = null;
        }
        await pool.end();
      },
    };
  }
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync('data', { recursive: true });
  const c = new DatabaseSync(resolve(process.env.SQLITE_PATH || 'data/saloney.db'));
  c.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  return {
    kind: 'sqlite',
    all: async (q, p = []) => c.prepare(q).all(...p),
    run: async (q, p = []) => c.prepare(q).run(...p),
    close: () => c.close(),
  };
}
export async function migrate(db) {
  let sql = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8');
  if (db.kind === 'sqlite')
    sql = sql
      .replaceAll('BIGINT PRIMARY KEY AUTO_INCREMENT', 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replaceAll('ENGINE=InnoDB', '');
  for (const statement of sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await db.run(statement);
  if (!(await db.all('SELECT id FROM app_lock')).length)
    await db.run('INSERT INTO app_lock (id) VALUES (1)');
  const columns = (
    db.kind === 'mysql'
      ? await db.all('SHOW COLUMNS FROM settings')
      : await db.all('PRAGMA table_info(settings)')
  ).map((c) => c.Field || c.name);
  if (!columns.includes('catalog_loaded'))
    await db.run('ALTER TABLE settings ADD COLUMN catalog_loaded INTEGER NOT NULL DEFAULT 0');
  if (!columns.includes('lead_minutes'))
    await db.run('ALTER TABLE settings ADD COLUMN lead_minutes INTEGER');
  for (const column of ['instagram_url', 'facebook_url'])
    if (!columns.includes(column))
      await db.run(`ALTER TABLE settings ADD COLUMN ${column} VARCHAR(500) NOT NULL DEFAULT ''`);
  for (const [table, additions] of Object.entries({
    products: {
      box_size: 'INTEGER NOT NULL DEFAULT 0',
      created_at: 'VARCHAR(30)',
      unit_cost: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
      unit: "VARCHAR(30) NOT NULL DEFAULT 'unidad'",
    },
    stock_movements: {
      unit_cost: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
      tipo_movimiento: 'VARCHAR(30)',
      existencias_antes: 'INTEGER',
      existencias_despues: 'INTEGER',
      id_entrega: 'BIGINT',
    },
    professional_supplies: { piece_counted: 'INTEGER NOT NULL DEFAULT 0' },
    users: {
      profile_photo: 'TEXT',
      deleted: 'INTEGER NOT NULL DEFAULT 0',
      theme: "VARCHAR(10) NOT NULL DEFAULT 'light'",
    },
    sessions: { last_seen: "VARCHAR(30) NOT NULL DEFAULT ''" },
    payments: { confirmed_by: 'BIGINT', confirmed_at: "VARCHAR(30) NOT NULL DEFAULT ''" },
    appointments: {
      whatsapp_phone: "VARCHAR(20) NOT NULL DEFAULT ''",
      whatsapp_since: "VARCHAR(30) NOT NULL DEFAULT ''",
      whatsapp_2h: "INTEGER NOT NULL DEFAULT 0",
      whatsapp_30m: "INTEGER NOT NULL DEFAULT 0",
      payment_method: "VARCHAR(30) NOT NULL DEFAULT ''",
      payment_destination: "VARCHAR(30) NOT NULL DEFAULT ''",
    },
  })) {
    const existing = (
      db.kind === 'mysql'
        ? await db.all(`SHOW COLUMNS FROM ${table}`)
        : await db.all(`PRAGMA table_info(${table})`)
    ).map((c) => c.Field || c.name);
    for (const [name, definition] of Object.entries(additions)) {
      if (!existing.includes(name))
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}

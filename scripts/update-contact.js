import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { openDatabase, migrate } from '../server/db.js';
Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8')));
const db = await openDatabase();
try {
  await migrate(db);
  await db.run('UPDATE settings SET phone=? WHERE id=1', ['3132887785']);
  console.log(
    await db.all('SELECT name,phone,instagram_url,facebook_url FROM settings WHERE id=1'),
  );
} finally {
  await db.close();
}

// Enlaces oficiales proporcionados por la usuaria; solo modifica estos dos ajustes.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { openDatabase } from '../server/db.js';
import { socialUrl } from '../server/social.js';
Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8')));
const db = await openDatabase();
try {
  await db.run('UPDATE settings SET instagram_url=?,facebook_url=? WHERE id=1', [
    socialUrl('https://www.instagram.com/vanessa.quintana.79025/', 'instagram'),
    socialUrl('https://www.facebook.com/share/19LpgW9DNd/?mibextid=wwXIfr', 'facebook'),
  ]);
  console.log('Facebook e Instagram guardados en SALONEY.');
} finally {
  await db.close();
}

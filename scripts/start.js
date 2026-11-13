import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { openChrome } from './open-chrome.js';
// Usa la carpeta del proyecto aunque el programa se abra desde otro directorio.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
if (existsSync('.env')) Object.assign(process.env, parseEnv(readFileSync('.env', 'utf8')));
if (process.argv.includes('--open'))
  void openChrome('http://127.0.0.1:' + (process.env.PORT || 3000));
const listening = (port) =>
  new Promise((resolve) => {
    const s = net.createConnection({ host: '127.0.0.1', port });
    s.setTimeout(800);
    s.on('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => resolve(false));
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
  });
if (await listening(Number(process.env.PORT || 3000))) {
  console.log(
    'Ya hay un servidor en http://127.0.0.1:' +
      (process.env.PORT || 3000) +
      '. Abre esa dirección.',
  );
} else {
  if (
    process.env.DB_DRIVER === 'mysql' &&
    process.env.MYSQL_PORT === '3307' &&
    ['localhost', '127.0.0.1'].includes(process.env.MYSQL_HOST) &&
    existsSync('data/mysql') &&
    !(await listening(3307))
  ) {
    const executable =
      process.env.MYSQL_BIN || 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe';
    if (!existsSync(executable))
      throw new Error('No se encuentra MySQL. Configura MYSQL_BIN o consulta README.md.');
    const child = spawn(
      executable,
      [
        '--no-defaults',
        '--basedir=' + resolve(executable, '../..'),
        '--datadir=' + resolve('data/mysql'),
        '--port=3307',
        '--bind-address=127.0.0.1',
        '--mysqlx=OFF',
        '--skip-log-bin',
        '--console',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', (e) => console.error('No se pudo iniciar MySQL:', e.message));
    child.on('exit', (code) => {
      console.error('MySQL se detuvo. Vuelve a abrir iniciar.cmd. Código:', code);
      process.exitCode = 1;
    });
    let ready = false;
    for (let i = 0; i < 30; i++) {
      if (await listening(3307)) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) throw new Error('MySQL no respondió. Consulta el archivo .err de data/mysql.');
  }
  await import('../server/index.js');
}

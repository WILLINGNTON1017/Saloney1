import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

// Abre Chrome únicamente después de comprobar que la aplicación responde.
export async function openChrome(url) {
  const executable = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ]
    .filter(Boolean)
    .map((root) => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    .find((path) => existsSync(path));
  if (!executable) {
    console.log(`No se encontró Google Chrome. Instálalo o abre ${url} en tu navegador.`);
    return;
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(url + '/api/settings', { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const browser = spawn(executable, [url], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        browser.on('error', (error) => console.error('No se pudo abrir Chrome:', error.message));
        browser.unref();
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log(
    `El servidor aún no responde. Consulta los errores de esta terminal antes de abrir ${url}.`,
  );
}

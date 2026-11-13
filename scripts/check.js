// Revisa la sintaxis del código sin iniciar la aplicación ni modificar la base de datos.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : path.endsWith('.js') ? [path] : [];
  });
}

const files = ['public', 'server', 'scripts', 'tests'].flatMap(filesIn);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) failed = true;
}
console.log(
  `${files.length} archivos revisados. ${failed ? 'Hay errores.' : 'Sintaxis correcta.'}`,
);
process.exitCode = failed ? 1 : 0;

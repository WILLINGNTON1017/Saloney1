import { fail } from './security.js';
export function socialUrl(value, platform) {
  if (value === undefined) return undefined;
  if (value === '') return '';
  if (typeof value !== 'string' || value.length > 500)
    fail('El enlace de ' + platform + ' no es válido.');
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    fail('Ingresa el enlace completo de ' + platform + '.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !['www.' + platform + '.com', platform + '.com', 'm.' + platform + '.com'].includes(
      url.hostname,
    )
  )
    fail('Usa un enlace HTTPS de ' + platform + '.com.');
  return url.href;
}

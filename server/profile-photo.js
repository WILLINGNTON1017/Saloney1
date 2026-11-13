import { fail } from './security.js';
export function validateProfilePhoto(photo) {
  if (photo === null) return null;
  if (
    typeof photo !== 'string' ||
    photo.length > 60000 ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)
  )
    fail('Selecciona una foto JPEG válida de hasta 45 KB después de ajustarla.');
  const bytes = Buffer.from(photo.split(',')[1], 'base64');
  if (
    bytes.length < 20 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes[2] !== 255 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    fail('La foto no tiene un formato JPEG válido.');
  return photo;
}

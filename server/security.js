import { randomBytes, scrypt as sc, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(sc);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
export async function checkPassword(password, stored) {
  const [salt, key] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(key || '', 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const token = () => randomBytes(32).toString('hex');
export const digest = (s) => createHash('sha256').update(s).digest('hex');
export const cleanUser = ({ password_hash, ...u }) => u;
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function text(value, label, max = 200, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    fail(`${label}: revisa el contenido (${min}–${max} caracteres).`);
  return value.trim();
}
export function integer(value, label, min = 0, max = 100000000) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    fail(`${label}: ingresa un número entre ${min} y ${max}.`);
  return n;
}
export function password(value) {
  return text(value, 'Contraseña', 128, 8);
}
export function email(value) {
  const v = text(value, 'Correo', 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('Ingresa un correo válido.');
  return v;
}
export function phone(value) {
  const v = text(value, 'Teléfono', 30);
  if (!/^\+?[\d\s()-]{7,25}$/.test(v)) fail('Ingresa un teléfono válido.');
  return v;
}
export const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
export const minute = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export function validDate(v) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) !== v
  )
    fail('Fecha inválida.');
  return v;
}
export function validTime(v) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail('Hora inválida.');
  return v;
}

// Una sola sesión HttpOnly para todas las pestañas del mismo navegador.
// Los identificadores y las cookies antiguas por pestaña ya no se utilizan.
export function readSessionToken(req) {
  return req.headers.cookie?.split(';').map(c => c.trim())
    .find(c => c.startsWith('saloney='))?.slice('saloney='.length);
}
export function sessionCookie(value, age, req) {
  return `saloney=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

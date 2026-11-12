// Las citas se expresan en la hora local del salón (Colombia).
export const SALON_TIME_ZONE = 'America/Bogota';
export function overlapsLunch(start, duration) {
  return start < 12 * 60 + 30 && start + Number(duration) > 11 * 60 + 30;
}
export function timeLabel(time) {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a. m.' : 'p. m.'}`;
}
export function timeRange(time, duration) {
  const [hour, minute] = time.split(':').map(Number);
  const end = hour * 60 + minute + Number(duration);
  return `${timeLabel(time)} – ${timeLabel(`${Math.floor(end / 60) % 24}:${end % 60}`)}`;
}

function appointmentStart(a) {
  return Date.parse(a.date + 'T' + a.time + ':00-05:00');
}
export function withinChangeWindow(a, hours, now = Date.now()) {
  return appointmentStart(a) - now >= hours * 3600000;
}
export function appointmentTab(a, now = Date.now()) {
  if (['Cancelada', 'Rechazada'].includes(a.status)) return 'Canceladas';
  if (['Finalizada', 'No asistió'].includes(a.status)) return 'Pasadas';
  const end = appointmentStart(a) + a.duration * 60000;
  return now < end ? 'Próximas' : 'Pasadas';
}

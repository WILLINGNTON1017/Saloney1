import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeRange, overlapsLunch, appointmentTab, withinChangeWindow } from '../public/schedule.js';

test('horarios con duración y límites exactos del almuerzo', () => {
  assert.equal(timeRange('10:00', 90), '10:00 a. m. – 11:30 a. m.');
  assert.equal(timeRange('12:30', 75), '12:30 p. m. – 1:45 p. m.');
  assert.equal(overlapsLunch(600, 90), false);
  assert.equal(overlapsLunch(600, 120), true);
  assert.equal(overlapsLunch(690, 15), true);
  assert.equal(overlapsLunch(720, 60), true);
  assert.equal(overlapsLunch(750, 60), false);
});

test('plazos y pestañas en hora de Colombia al cambiar el día UTC', () => {
  const cita = { date: '2026-11-10', time: '19:30', duration: 60, status: 'Confirmada' };
  const limite = Date.parse('2026-11-10T22:30:00Z');
  assert.equal(withinChangeWindow(cita, 2, limite), true);
  assert.equal(withinChangeWindow(cita, 2, limite + 1), false);
  const fin = Date.parse('2026-11-11T01:30:00Z');
  assert.equal(appointmentTab(cita, fin - 1), 'Próximas');
  assert.equal(appointmentTab(cita, fin), 'Pasadas');
  assert.equal(appointmentTab({ ...cita, status: 'Cancelada' }, fin), 'Canceladas');
});

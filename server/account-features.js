// Funciones compartidas de presencia, eliminación lógica y preferencias de pago.
import { fail, today } from './security.js';

export async function onlineUsers(db) {
  return new Set(
    (
      await db.all('SELECT DISTINCT user_id FROM sessions WHERE expires_at>? AND last_seen>?', [
        new Date().toISOString(),
        new Date(Date.now() - 90000).toISOString(),
      ])
    ).map((row) => row.user_id),
  );
}

export async function deleteAccount(db, id, administrator) {
  if (id === administrator.id) fail('No puedes eliminar tu propia cuenta.');
  const target = (await db.all('SELECT id FROM users WHERE id=? AND deleted=0', [id]))[0];
  if (!target) fail('Usuario no encontrado.', 404);
  const pending = await db.all(
    "SELECT id FROM appointments WHERE (client_id=? OR professional_id=?) AND status IN ('Pendiente','Confirmada','En proceso') LIMIT 1",
    [id, id],
  );
  if (pending.length)
    fail('Gestiona las citas pendientes de esta persona antes de eliminar su cuenta.');
  await db.run('DELETE FROM sessions WHERE user_id=?', [id]);
  await db.run('UPDATE users SET active=0,deleted=1 WHERE id=?', [id]);
  return { ok: true };
}

export async function savePaymentChoice(db, appointment, body, role = 'cliente') {
  if (role === 'cliente' && appointment.status === 'Finalizada')
    fail('La cita ya finalizó. Contacta al salón si necesitas corregir el pago.');
  if (['Cancelada', 'Rechazada', 'No asistió'].includes(appointment.status))
    fail('Esta cita no admite un método de pago.');
  if (
    (
      await db.all("SELECT id FROM payments WHERE appointment_id=? AND status='Pagado'", [
        appointment.id,
      ])
    ).length &&
    role === 'cliente'
  )
    fail('El pago ya fue confirmado por el salón.');
  if (!['Efectivo', 'Transferencia'].includes(body.method)) fail('Elige Efectivo o Transferencia.');
  const destination = body.method === 'Transferencia' ? (body.destination ?? '') : '';
  if (body.method === 'Transferencia' && destination !== '' && !['Nequi', 'Bancolombia'].includes(destination))
    fail('Destino de transferencia inválido.');
  await db.run('UPDATE appointments SET payment_method=?,payment_destination=? WHERE id=?', [
    body.method,
    destination,
    appointment.id,
  ]);
  // El personal puede corregir el método recibido, conservando importe y estado del pago.
  if (role === 'admin' || role === 'manicurista')
    await db.run('UPDATE payments SET method=? WHERE appointment_id=?', [
      destination || body.method,
      appointment.id,
    ]);
  return { ok: true };
}

export async function confirmPayment(db, appointment, body, user) {
  if (body.received !== true) fail('Confirma que recibiste el dinero.');
  const existing = (
    await db.all('SELECT * FROM payments WHERE appointment_id=?', [appointment.id])
  )[0];
  if (existing?.status === 'Pagado') return { ok: true, alreadyPaid: true };
  await savePaymentChoice(db, appointment, body, user.role);
  const method = body.method === 'Transferencia' ? (body.destination || 'Transferencia') : 'Efectivo';
  const at = new Date().toISOString();
  if (existing)
    await db.run(
      "UPDATE payments SET amount=?,method=?,status='Pagado',date=?,confirmed_by=?,confirmed_at=? WHERE id=?",
      [appointment.price, method, today(), user.id, at, existing.id],
    );
  else
    await db.run(
      "INSERT INTO payments (appointment_id,amount,method,status,date,confirmed_by,confirmed_at) VALUES (?,?,?,'Pagado',?,?,?)",
      [appointment.id, appointment.price, method, today(), user.id, at],
    );
  return { ok: true };
}

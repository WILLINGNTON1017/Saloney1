export async function createReminders(db, userId, now = Date.now()) {
  const appointments = await db.all(
    "SELECT a.*,s.name service_name FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.client_id=? AND a.status IN ('Pendiente','Confirmada')",
    [userId],
  );
  for (const a of appointments) {
    const hours = (new Date(a.date + 'T' + a.time + ':00-05:00').getTime() - now) / 3600000;
    if (hours <= 0 || hours > 24) continue;
    const message =
      'Recordatorio: ' +
      (hours <= 3 ? 'tu cita es en menos de 3 horas' : 'tu cita es en las próximas 24 horas') +
      ' · ' +
      a.service_name +
      ' · ' +
      a.date +
      ' a las ' +
      a.time;
    if (
      (
        await db.all(
          'SELECT id FROM notifications WHERE user_id=? AND appointment_id=? AND message=?',
          [userId, a.id, message],
        )
      ).length
    )
      continue;
    await db.run(
      'INSERT INTO notifications (user_id,appointment_id,message,created_at) VALUES (?,?,?,?)',
      [userId, a.id, message, new Date(now).toISOString()],
    );
  }
}

import { timeLabel } from '../public/schedule.js';

export function whatsappNumber(value) {
  const digits = String(value || '').replace(/[\s()-]/g, '');
  if (/^3\d{9}$/.test(digits)) return '+57' + digits;
  if (/^573\d{9}$/.test(digits)) return '+' + digits;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

export function twilioSender(env) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from,
    TWILIO_REMINDER_CONTENT_SID: template } = env;
  if (!sid || !token || !whatsappNumber(from) || !template) return null;
  return async (a) => {
    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') },
      body: new URLSearchParams({
        From: 'whatsapp:' + whatsappNumber(from), To: 'whatsapp:' + a.whatsapp_phone,
        ContentSid: template, ContentVariables: JSON.stringify({ 1: a.date, 2: timeLabel(a.time) }),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Object.assign(new Error('Twilio HTTP ' + response.status), { status: response.status });
  };
}

export async function sendDueReminders(db, send, now = Date.now()) {
  const salonDate = (ms) => new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
  const appointments = await db.all(
    "SELECT id,date,time,whatsapp_phone,whatsapp_since FROM appointments WHERE whatsapp_phone<>'' AND date BETWEEN ? AND ? AND status IN ('Pendiente','Confirmada')",
    [salonDate(now), salonDate(now + 7200000)],
  );
  for (const a of appointments) {
    const start = Date.parse(a.date + 'T' + a.time + ':00-05:00');
    for (const minutes of [120, 30]) {
      const due = start - minutes * 60000;
      if (now < due || now >= due + 5 * 60000 || Date.parse(a.whatsapp_since) >= due) continue;
      const field = minutes === 120 ? 'whatsapp_2h' : 'whatsapp_30m';
      const where = " WHERE id=? AND date=? AND time=? AND whatsapp_since=? AND whatsapp_phone=? AND status IN ('Pendiente','Confirmada')";
      const args = [a.id, a.date, a.time, a.whatsapp_since, a.whatsapp_phone];
      const claim = await db.run('UPDATE appointments SET ' + field + '=1' + where + ' AND ' + field + '=0', args);
      if (!claim.changes) continue;
      try {
        await send(a);
      } catch (error) {
        // Only retry a known rejection. An interrupted response may already have sent a message.
        if (error.status === 429)
          await db.run('UPDATE appointments SET ' + field + '=0' + where, args);
        console.error('Recordatorio WhatsApp, cita ' + a.id + ': ' + error.message);
      }
    }
  }
}

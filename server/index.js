import { loadInventoryCatalog } from './inventory-catalog.js';
import { sendDueReminders, twilioSender, whatsappNumber } from './whatsapp.js';
import { suppliesApi } from './supplies.js';
import { overlapsLunch, withinChangeWindow } from '../public/schedule.js';
import { validateProfilePhoto } from './profile-photo.js';
import { createReminders } from './reminders.js';
import { readSessionToken, sessionCookie } from './session-cookie.js';
import { socialUrl } from './social.js';
import { paymentPdf, reportPdf } from './pdf.js';
import {
  onlineUsers,
  deleteAccount,
  savePaymentChoice,
  confirmPayment,
} from './account-features.js';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { openDatabase, migrate } from './db.js';
import { seed } from './seed.js';
import {
  cleanUser,
  hashPassword,
  checkPassword,
  token,
  digest,
  fail,
  text,
  integer,
  email,
  phone,
  password,
  today,
  minute,
  validDate,
  validTime,
} from './security.js';

// Inicio del servidor: conexión, estructura de tablas y datos iniciales.
const sendWhatsApp = twilioSender(process.env);
const db = await openDatabase();
await migrate(db);
await seed(db);
await loadInventoryCatalog(db);
function purchaseCost(value) {
  const cost = Number(value);
  if (!Number.isFinite(cost) || cost < 0 || cost > 100000000) fail('El costo de compra no es válido.');
  return Math.round(cost * 100) / 100;
}
const one = async (q, p = []) => (await db.all(q, p))[0];
const publicRoot = resolve('public');
const roles = ['cliente', 'manicurista', 'admin'];
const statuses = [
  'Pendiente',
  'Confirmada',
  'En proceso',
  'Finalizada',
  'Cancelada',
  'Rechazada',
  'No asistió',
];
const alive = ['Pendiente', 'Confirmada', 'En proceso'];
const appointmentQuery = `SELECT a.*, s.name service_name, u.name professional_name, COALESCE(c.name,a.guest_name) client_name, COALESCE(c.phone,a.guest_phone) client_phone, c.profile_photo client_photo, p.status payment_status, p.amount payment_amount, p.date payment_date, p.method received_method, p.confirmed_at, verifier.name confirmed_by_name FROM appointments a JOIN services s ON a.service_id=s.id JOIN users u ON a.professional_id=u.id LEFT JOIN users c ON a.client_id=c.id LEFT JOIN payments p ON p.appointment_id=a.id LEFT JOIN users verifier ON verifier.id=p.confirmed_by`;
const authorize = (user, ...allowed) => {
  if (!user) fail('Inicia sesión para continuar.', 401);
  if (allowed.length && !allowed.includes(user.role))
    fail('No tienes permiso para esta acción.', 403);
};
async function session(req) {
  const raw = readSessionToken(req);
  if (!raw) return null;
  return (
    (await one(
      'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1',
      [digest(raw), new Date().toISOString()],
    )) || null
  );
}
async function loginSession(res, u, req) {
  const t = token();
  await db.run('INSERT INTO sessions (token,user_id,expires_at,last_seen) VALUES (?,?,?,?)', [
    digest(t),
    u.id,
    new Date(Date.now() + 86400000).toISOString(),
    new Date().toISOString(),
  ]);
  res.setHeader('Set-Cookie', sessionCookie(t, 86400, req));
  return cleanUser(u);
}
const attempts = new Map();
function rate(req, key, limit = 12) {
  const k = key + req.socket.remoteAddress;
  const now = Date.now();
  let a = attempts.get(k);
  if (!a || now - a.at > 900000) a = { at: now, count: 0 };
  attempts.set(k, a);
  if (++a.count > limit) fail('Demasiados intentos. Intenta de nuevo en 15 minutos.', 429);
}
setInterval(() => {
  for (const [k, v] of attempts) if (Date.now() - v.at > 900000) attempts.delete(k);
}, 600000).unref();
async function availability(sid, pid, date, ignore = 0) {
  validDate(date);
  const s = await one('SELECT * FROM services WHERE id=? AND active=1', [sid]);
  const pro = await one("SELECT id FROM users WHERE id=? AND role='manicurista' AND active=1", [
    pid,
  ]);
  if (!s || !pro) fail('Selecciona un servicio y una manicurista activos.');
  const cfg = await one('SELECT * FROM settings WHERE id=1');
  const apps = await db.all(
    "SELECT * FROM appointments WHERE professional_id=? AND date=? AND id<>? AND status IN ('Pendiente','Confirmada','En proceso')",
    [pid, date, ignore],
  );
  const blocks = await db.all('SELECT * FROM availability WHERE user_id=? AND date=?', [pid, date]);
  const result = [];
  for (let m = minute(cfg.opens); m + s.duration <= minute(cfg.closes); m += 30) {
    if (overlapsLunch(m, s.duration)) continue;
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    if (new Date(`${date}T${t}:00-05:00`).getTime() < Date.now() + (cfg.lead_minutes ?? cfg.lead_hours * 60) * 60000)
      continue;
    if (apps.some((a) => m < minute(a.time) + a.duration && m + s.duration > minute(a.time)))
      continue;
    if (blocks.some((a) => m < minute(a.end_time) && m + s.duration > minute(a.start_time)))
      continue;
    result.push(t);
  }
  return result;
}
async function ownedAppointment(id, u) {
  authorize(u);
  const a = await one(appointmentQuery + ' WHERE a.id=?', [id]);
  if (!a) fail('Cita no encontrada.', 404);
  if (
    (u.role === 'cliente' && a.client_id !== u.id) ||
    (u.role === 'manicurista' && a.professional_id !== u.id)
  )
    fail('No tienes acceso a esta cita.', 403);
  return a;
}
function editableByClient(a, cfg) {
  if (!['Pendiente', 'Confirmada'].includes(a.status)) fail('Esta cita ya no se puede modificar.');
  if (!withinChangeWindow(a, cfg.cancellation_hours))
    fail(`Puedes modificar o cancelar hasta ${cfg.cancellation_hours} horas antes de la cita.`);
}
// Rutas de la API: cada operación valida la sesión, los permisos y los datos.
async function api(req, res, path, q, b, u) {
  const method = req.method;
  if (path === '/api/notifications' && method === 'GET') {
    authorize(u);
    if (u.role === 'cliente') await createReminders(db, u.id);
    return {
      items: await db.all(
        'SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100',
        [u.id],
      ),
      unread: Number(
        (
          await one(
            'SELECT COUNT(*) total FROM notifications WHERE user_id=? AND read_at IS NULL',
            [u.id],
          )
        ).total,
      ),
    };
  }
  if (/^\/api\/notifications\/\d+\/respond$/.test(path) && method === 'POST') {
    authorize(u, 'cliente');
    const notification = await one('SELECT * FROM notifications WHERE id=? AND user_id=?', [
      Number(path.split('/')[3]),
      u.id,
    ]);
    if (!notification || !notification.message.startsWith('Recordatorio:'))
      fail('Recordatorio no encontrado.', 404);
    const a = await ownedAppointment(notification.appointment_id, u);
    if (
      !['Pendiente', 'Confirmada'].includes(a.status) ||
      new Date(a.date + 'T' + a.time + ':00-05:00').getTime() <= Date.now()
    )
      fail('Esta cita ya no admite confirmación o cancelación.');
    if (!notification.message.includes(a.date + ' a las ' + a.time))
      fail('La cita cambió de horario. Consulta el recordatorio actualizado.');
    if (!['Confirmada', 'Cancelada'].includes(b.status)) fail('Respuesta inválida.');
    await db.run('UPDATE appointments SET status=? WHERE id=?', [b.status, a.id]);
    await db.run('UPDATE notifications SET read_at=? WHERE id=?', [
      new Date().toISOString(),
      notification.id,
    ]);
    await db.run(
      'INSERT INTO notifications (user_id,appointment_id,message,created_at) VALUES (?,?,?,?)',
      [
        a.professional_id,
        a.id,
        'La clienta respondió: ' +
          b.status +
          ' · ' +
          a.client_name +
          ' · ' +
          a.date +
          ' a las ' +
          a.time,
        new Date().toISOString(),
      ],
    );
    return { ok: true };
  }
  if (/^\/api\/notifications\/\d+\/read$/.test(path) && method === 'POST') {
    authorize(u);
    const id = Number(path.split('/')[3]);
    if (!(await one('SELECT id FROM notifications WHERE id=? AND user_id=?', [id, u.id])))
      fail('Notificación no encontrada.', 404);
    await db.run(
      'UPDATE notifications SET read_at=? WHERE id=? AND user_id=? AND read_at IS NULL',
      [new Date().toISOString(), id, u.id],
    );
    return { ok: true };
  }
  if (/^\/api\/appointments\/\d+\/invoice.pdf$/.test(path) && method === 'GET') {
    const appointment = await ownedAppointment(Number(path.split('/')[3]), u);
    const payment = await one("SELECT * FROM payments WHERE appointment_id=? AND status='Pagado'", [
      appointment.id,
    ]);
    if (!payment) fail('El pago debe estar confirmado para descargar el comprobante.', 409);
    return {
      pdf: await paymentPdf(await one('SELECT * FROM settings WHERE id=1'), appointment, payment),
      filename: `SALONEY-comprobante-${payment.id}.pdf`,
    };
  }
  if (path === '/api/reports.pdf' && method === 'GET') {
    authorize(u, 'admin', 'manicurista');
    const from = validDate(q.get('from')),
      to = validDate(q.get('to'));
    if (from > to) fail('El período no es válido.');
    const apps = await db.all(
      appointmentQuery +
        ' WHERE a.date>=? AND a.date<=?' +
        (u.role === 'manicurista' ? ' AND a.professional_id=?' : '') +
        ' ORDER BY a.date,a.time,a.id',
      u.role === 'manicurista' ? [from, to, u.id] : [from, to],
    );
    const payments = await db.all(
      "SELECT p.*,COALESCE(c.name,a.guest_name) client_name FROM payments p JOIN appointments a ON a.id=p.appointment_id LEFT JOIN users c ON c.id=a.client_id WHERE p.status='Pagado' AND p.date>=? AND p.date<=?" +
        (u.role === 'manicurista' ? ' AND a.professional_id=?' : '') +
        ' ORDER BY p.date,p.id',
      u.role === 'manicurista' ? [from, to, u.id] : [from, to],
    );
    return {
      pdf: await reportPdf(
        await one('SELECT * FROM settings WHERE id=1'),
        apps,
        payments,
        from,
        to,
        u,
      ),
      filename: `SALONEY-reporte-${from}-${to}.pdf`,
    };
  }
  if (/^\/api\/appointments\/\d+\/confirm-payment$/.test(path) && method === 'POST') {
    authorize(u, 'admin', 'manicurista');
    return confirmPayment(db, await ownedAppointment(Number(path.split('/')[3]), u), b, u);
  }
  if (path === '/api/theme' && method === 'PATCH') {
    authorize(u);
    if (!['light', 'dark'].includes(b.theme)) fail('Tema inválido.');
    await db.run('UPDATE users SET theme=? WHERE id=?', [b.theme, u.id]);
    return { theme: b.theme };
  }
  if (path === '/api/presence' && method === 'POST') {
    authorize(u);
    const raw = readSessionToken(req);
    await db.run('UPDATE sessions SET last_seen=? WHERE token=?', [
      new Date().toISOString(),
      digest(raw),
    ]);
    return { ok: true };
  }
  if (/^\/api\/appointments\/\d+\/payment-choice$/.test(path) && method === 'PATCH') {
    authorize(u, 'cliente', 'manicurista', 'admin');
    return savePaymentChoice(db, await ownedAppointment(Number(path.split('/')[3]), u), b, u.role);
  }
  if (path === '/api/me')
    return {
      user: u ? cleanUser(u) : null,
      demo: process.env.DEMO_SEED !== 'false' && process.env.NODE_ENV !== 'production',
    };
  if (path === '/api/login' && method === 'POST') {
    if (u) fail('Ya hay una sesión abierta. Cierra sesión antes de entrar con otra cuenta.', 409);
    rate(req, 'login');
    const login = text(b.login, 'Usuario', 160).toLowerCase();
    const candidate = await one('SELECT * FROM users WHERE username=? OR email=?', [login, login]);
    const dummy = 'dummysalt:' + '0'.repeat(128);
    const ok = await checkPassword(String(b.password || ''), candidate?.password_hash || dummy);
    if (!candidate || !candidate.active || !ok) fail('Usuario o contraseña incorrectos.', 401);
    return { user: await loginSession(res, candidate, req) };
  }
  if (path === '/api/register' && method === 'POST') {
    if (u) fail('Cierra la sesión actual antes de crear otra cuenta.', 409);
    rate(req, 'register', 10);
    const name = text(b.name, 'Nombre', 100),
      username = text(b.username, 'Usuario', 80, 3).toLowerCase(),
      mail = email(b.email),
      tel = phone(b.phone),
      pass = password(b.password);
    if (!b.terms) fail('Acepta el tratamiento de datos para crear tu cuenta.');
    if (await one('SELECT id FROM users WHERE username=? OR email=?', [username, mail]))
      fail('El usuario o correo ya están registrados.', 409);
    const r = await db.run(
      'INSERT INTO users (name,username,email,phone,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)',
      [name, username, mail, tel, await hashPassword(pass), 'cliente', new Date().toISOString()],
    );
    return {
      user: await loginSession(
        res,
        await one('SELECT * FROM users WHERE id=?', [Number(r.lastInsertRowid)]),
        req,
      ),
    };
  }
  if (path === '/api/logout' && method === 'POST') {
    const raw = readSessionToken(req);
    if (raw) await db.run('DELETE FROM sessions WHERE token=?', [digest(raw)]);
    res.setHeader('Set-Cookie', sessionCookie('', 0, req));
    return { ok: true };
  }
  if (path === '/api/services' && method === 'GET')
    return await db.all('SELECT * FROM services' + (u?.role === 'admin' ? '' : ' WHERE active=1'));
  if (path === '/api/professionals' && method === 'GET') {
    const online = await onlineUsers(db);
    return (
      await db.all(
        "SELECT id,name,specialty,profile_photo FROM users WHERE role='manicurista' AND active=1 AND deleted=0",
      )
    ).map((p) => ({ ...p, online: online.has(p.id) }));
  }
  if (path === '/api/settings' && method === 'GET')
    return { ...(await one('SELECT * FROM settings WHERE id=1')), whatsapp_enabled: Boolean(sendWhatsApp) };
  if (path === '/api/availability' && method === 'GET') {
    const ignore = integer(q.get('ignore') || 0, 'Cita');
    if (ignore) await ownedAppointment(ignore, u);
    return await availability(
      integer(q.get('service'), 'Servicio', 1),
      integer(q.get('professional'), 'Profesional', 1),
      q.get('date'),
      ignore,
    );
  }
  if (path === '/api/appointments' && method === 'GET') {
    authorize(u);
    let where =
      u.role === 'cliente'
        ? ' WHERE a.client_id=?'
        : u.role === 'manicurista'
          ? ' WHERE a.professional_id=?'
          : '';
    return await db.all(
      appointmentQuery + where + ' ORDER BY a.date DESC,a.time DESC',
      where ? [u.id] : [],
    );
  }
  if (path === '/api/appointments' && method === 'POST') {
    if (u && u.role !== 'cliente')
      fail('Las reservas se realizan desde una cuenta de cliente.', 403);
    if (!u) rate(req, 'guest', 20);
    const sid = integer(b.service_id, 'Servicio', 1),
      pid = integer(b.professional_id, 'Manicurista', 1),
      date = validDate(b.date),
      time = validTime(b.time);
    const slots = await availability(sid, pid, date);
    if (!slots.includes(time)) fail('Este horario ya no está disponible. Selecciona otro.', 409);
    const s = await one('SELECT * FROM services WHERE id=?', [sid]);
    const r = await db.run(
      'INSERT INTO appointments (client_id,guest_name,guest_phone,professional_id,service_id,date,time,duration,price,design,color,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        u?.id || null,
        u ? '' : text(b.name, 'Nombre', 100),
        u ? '' : phone(b.phone),
        pid,
        sid,
        date,
        time,
        s.duration,
        s.price,
        text(b.design || 'Clásico', 'Diseño', 80),
        text(b.color || 'Rosado', 'Color', 40),
        text(b.notes || '', 'Observaciones', 1000, 0),
        new Date().toISOString(),
      ],
    );
    if (b.whatsapp_opt_in === 'on' || b.whatsapp_opt_in === true) {
      if (!sendWhatsApp) fail('Los recordatorios de WhatsApp no están disponibles.');
      const number = whatsappNumber(u ? u.phone : b.phone);
      if (!number) fail('Revisa el número de WhatsApp. Para otro país incluye el prefijo internacional.');
      await db.run('UPDATE appointments SET whatsapp_phone=?,whatsapp_since=? WHERE id=?', [number, new Date().toISOString(), r.lastInsertRowid]);
    }
    await savePaymentChoice(
      db,
      { id: Number(r.lastInsertRowid), status: 'Pendiente' },
      { method: b.method || 'Efectivo', destination: b.destination },
    );
    await db.run(
      'INSERT INTO notifications (user_id,appointment_id,message,created_at) VALUES (?,?,?,?)',
      [
        pid,
        Number(r.lastInsertRowid),
        `Nueva cita: ${u?.name || b.name} · ${s.name} · ${date} a las ${time}`,
        new Date().toISOString(),
      ],
    );
    return { id: Number(r.lastInsertRowid), status: 'Pendiente', price: s.price };
  }
  const appointmentMatch = path.match(/^\/api\/appointments\/(\d+)$/);
  if (appointmentMatch && method === 'PATCH') {
    const a = await ownedAppointment(Number(appointmentMatch[1]), u);
    const cfg = await one('SELECT * FROM settings WHERE id=1');
    if (b.date || b.time) {
      if (u.role === 'manicurista')
        fail('La reprogramación corresponde a la cliente o al administrador.', 403);
      editableByClient(a, cfg);
      const date = validDate(b.date),
        time = validTime(b.time);
      if (!(await availability(a.service_id, a.professional_id, date, a.id)).includes(time))
        fail('El horario no está disponible.', 409);
      await db.run("UPDATE appointments SET date=?,time=?,status='Pendiente' WHERE id=?", [
        date,
        time,
        a.id,
      ]);
      if (a.date !== date || a.time !== time) {
        await db.run('UPDATE appointments SET whatsapp_since=?,whatsapp_2h=0,whatsapp_30m=0 WHERE id=?', [new Date().toISOString(), a.id]);
        await db.run(
          'INSERT INTO notifications (user_id,appointment_id,message,created_at) VALUES (?,?,?,?)',
          [
            a.professional_id,
            a.id,
            `Cita reprogramada: ${a.client_name} · ${a.service_name} · ${date} a las ${time}`,
            new Date().toISOString(),
          ],
        );
      }
      return { ok: true };
    }
    if (!statuses.includes(b.status)) fail('Estado inválido.');
    if (u.role === 'cliente') {
      if (b.status !== 'Cancelada') fail('Solo puedes cancelar tu cita.', 403);
      editableByClient(a, cfg);
    } else {
      const transitions = {
        Pendiente: ['Confirmada', 'Rechazada', 'Cancelada', 'No asistió'],
        Confirmada: ['En proceso', 'Finalizada', 'Cancelada', 'No asistió'],
        'En proceso': ['Finalizada', 'Cancelada'],
      };
      if (!transitions[a.status]?.includes(b.status))
        fail('El cambio de estado no está permitido.');
    }
    if (
      b.status === 'No asistió' &&
      new Date(a.date + 'T' + a.time + ':00-05:00').getTime() > Date.now()
    )
      fail('Solo puedes marcar No asistió cuando haya llegado la hora de la cita.');
    const reason = text(b.reason || '', 'Motivo', 500, 0);
    if (b.status === 'Rechazada' && !reason) fail('Indica el motivo del rechazo.');
    await db.run('UPDATE appointments SET status=?,reason=? WHERE id=?', [b.status, reason, a.id]);
    if (b.status === 'Cancelada' && u.id !== a.professional_id)
      await db.run(
        'INSERT INTO notifications (user_id,appointment_id,message,created_at) VALUES (?,?,?,?)',
        [
          a.professional_id,
          a.id,
          `Cita cancelada: ${a.client_name} · ${a.date} a las ${a.time}`,
          new Date().toISOString(),
        ],
      );
    return { ok: true };
  }
  if (path === '/api/profile/photo' && method === 'PUT') {
    authorize(u);
    const photo = validateProfilePhoto(b.photo);
    await db.run('UPDATE users SET profile_photo=? WHERE id=?', [photo, u.id]);
    return { user: cleanUser(await one('SELECT * FROM users WHERE id=?', [u.id])) };
  }
  if (path === '/api/profile' && method === 'PATCH') {
    authorize(u);
    const mail = email(b.email);
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [mail, u.id]))
      fail('Este correo ya está registrado.', 409);
    await db.run('UPDATE users SET name=?,email=?,phone=? WHERE id=?', [
      text(b.name, 'Nombre', 100),
      mail,
      phone(b.phone),
      u.id,
    ]);
    if (b.new_password) {
      if (!(await checkPassword(String(b.current_password || ''), u.password_hash)))
        fail('La contraseña actual no es correcta.');
      await db.run('UPDATE users SET password_hash=? WHERE id=?', [
        await hashPassword(password(b.new_password)),
        u.id,
      ]);
      await db.run('DELETE FROM sessions WHERE user_id=?', [u.id]);
      await loginSession(res, await one('SELECT * FROM users WHERE id=?', [u.id]), req);
    }
    return { user: cleanUser(await one('SELECT * FROM users WHERE id=?', [u.id])) };
  }
  if (path === '/api/blocks' && method === 'GET') {
    authorize(u, 'manicurista');
    return await db.all('SELECT * FROM availability WHERE user_id=? ORDER BY date,start_time', [
      u.id,
    ]);
  }
  if (path === '/api/blocks' && method === 'POST') {
    authorize(u, 'manicurista');
    const date = validDate(b.date),
      start = validTime(b.start_time),
      end = validTime(b.end_time);
    if (date < today() || minute(start) >= minute(end))
      fail('Revisa la fecha y el rango de horas.');
    const apps = await db.all(
      "SELECT * FROM appointments WHERE professional_id=? AND date=? AND status IN ('Pendiente','Confirmada','En proceso')",
      [u.id, date],
    );
    if (
      apps.some((a) => minute(start) < minute(a.time) + a.duration && minute(end) > minute(a.time))
    )
      fail('Tienes una cita en ese horario. Gestiona la cita antes de bloquearlo.', 409);
    await db.run(
      'INSERT INTO availability (user_id,date,start_time,end_time,reason) VALUES (?,?,?,?,?)',
      [u.id, date, start, end, text(b.reason, 'Motivo', 200)],
    );
    return { ok: true };
  }
  if (path.match(/^\/api\/blocks\/\d+$/) && method === 'DELETE') {
    authorize(u, 'manicurista');
    await db.run('DELETE FROM availability WHERE id=? AND user_id=?', [
      Number(path.split('/').pop()),
      u.id,
    ]);
    return { ok: true };
  }
  if (path === '/api/payments' && method === 'GET') {
    authorize(u);
    if (u.role === 'manicurista') fail('Acceso restringido.', 403);
    return await db.all(
      'SELECT p.*,COALESCE(c.name,a.guest_name) client_name,s.name service_name FROM payments p JOIN appointments a ON p.appointment_id=a.id LEFT JOIN users c ON a.client_id=c.id JOIN services s ON s.id=a.service_id' +
        (u.role === 'cliente' ? ' WHERE a.client_id=?' : '') +
        ' ORDER BY p.date DESC',
      u.role === 'cliente' ? [u.id] : [],
    );
  }
  if (path === '/api/clients' && method === 'GET') {
    authorize(u, 'admin', 'manicurista');
    return await db.all(
      `SELECT u.id,u.name,u.email,u.phone,u.active,u.profile_photo, COUNT(a.id) visits, COALESCE(SUM(CASE WHEN a.status='Finalizada' THEN a.price ELSE 0 END),0) spent FROM users u LEFT JOIN appointments a ON a.client_id=u.id ${u.role === 'manicurista' ? 'AND a.professional_id=?' : ''} WHERE u.role='cliente' AND u.deleted=0 ${u.role === 'manicurista' ? 'AND u.id IN (SELECT client_id FROM appointments WHERE professional_id=?)' : ''} GROUP BY u.id,u.name,u.email,u.phone,u.active,u.profile_photo`,
      u.role === 'manicurista' ? [u.id, u.id] : [],
    );
  }
  if (path === '/api/supplies' || /^\/api\/supplies\/\d+\/finish$/.test(path)) return suppliesApi(db, path, method, b, u);
  if (path === '/api/products' && method === 'GET') {
    authorize(u, 'admin', 'manicurista');
    return db.all("SELECT p.*, COALESCE((SELECT SUM(s.quantity * CASE WHEN p.box_size>0 AND s.piece_counted=0 THEN p.box_size ELSE 1 END) FROM professional_supplies s WHERE s.product_id=p.id AND s.exhausted_at=''),0) in_use FROM products p");
  }
  authorize(u, 'admin');
  if (path === '/api/users' && method === 'GET') {
    const online = await onlineUsers(db);
    return (await db.all('SELECT * FROM users WHERE deleted=0 ORDER BY id')).map((person) => ({
      ...cleanUser(person),
      online: online.has(person.id),
    }));
  }
  if (/^\/api\/users\/\d+$/.test(path) && method === 'DELETE')
    return deleteAccount(db, Number(path.split('/').pop()), u);
  if (path === '/api/users' && method === 'POST') {
    const role = roles.includes(b.role) ? b.role : 'cliente';
    const username = text(b.username, 'Usuario', 80, 3).toLowerCase(),
      mail = email(b.email);
    if (await one('SELECT id FROM users WHERE username=? OR email=?', [username, mail]))
      fail('Usuario o correo duplicados.', 409);
    await db.run(
      'INSERT INTO users (name,username,email,phone,password_hash,role,specialty,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [
        text(b.name, 'Nombre', 100),
        username,
        mail,
        phone(b.phone),
        await hashPassword(password(b.password)),
        role,
        text(b.specialty || '', 'Especialidad', 200, 0),
        new Date().toISOString(),
      ],
    );
    return { ok: true };
  }
  if (path.match(/^\/api\/users\/\d+$/) && method === 'PATCH') {
    const id = Number(path.split('/').pop());
    const target = await one('SELECT * FROM users WHERE id=?', [id]);
    if (!target || target.deleted) fail('Usuario no encontrado.', 404);
    const username =
      b.username === undefined ? target.username : text(b.username, 'Usuario', 80, 3).toLowerCase();
    if (await one('SELECT id FROM users WHERE username=? AND id<>?', [username, id]))
      fail('Usuario duplicado.', 409);
    await db.run('UPDATE users SET username=? WHERE id=?', [username, id]);
    if (id === u.id && (Number(b.active) === 0 || b.role !== 'admin'))
      fail('No puedes desactivar tu propia cuenta ni quitarte el rol administrativo.');
    if (!roles.includes(b.role)) fail('Rol inválido.');
    if (
      target.role !== b.role &&
      (await one('SELECT id FROM appointments WHERE client_id=? OR professional_id=? LIMIT 1', [
        id,
        id,
      ]))
    )
      fail('No puedes cambiar el rol de un usuario con citas registradas.');
    if (
      Number(b.active) === 0 &&
      target.role === 'manicurista' &&
      (await one(
        "SELECT id FROM appointments WHERE professional_id=? AND date>=? AND status IN ('Pendiente','Confirmada','En proceso') LIMIT 1",
        [id, today()],
      ))
    )
      fail('La manicurista tiene citas activas. Gestiona esas citas antes de desactivarla.');
    const mail = email(b.email);
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [mail, id]))
      fail('Correo duplicado.', 409);
    await db.run('UPDATE users SET name=?,email=?,phone=?,role=?,active=?,specialty=? WHERE id=?', [
      text(b.name, 'Nombre', 100),
      mail,
      phone(b.phone),
      b.role,
      integer(b.active, 'Estado', 0, 1),
      text(b.specialty || '', 'Especialidad', 200, 0),
      id,
    ]);
    if (b.password)
      await db.run('UPDATE users SET password_hash=? WHERE id=?', [
        await hashPassword(password(b.password)),
        id,
      ]);
    // Editar datos de contacto no debe cerrar la sesión de la persona.
    // Los cambios de acceso sí invalidan las sesiones anteriores.
    if (b.password || target.role !== b.role || Number(target.active) !== Number(b.active)) {
      await db.run('DELETE FROM sessions WHERE user_id=?', [id]);
      if (id === u.id && Number(b.active) === 1)
        await loginSession(res, await one('SELECT * FROM users WHERE id=?', [id]), req);
    }
    return { ok: true };
  }
  if (
    (path === '/api/services' && method === 'POST') ||
    (path.match(/^\/api\/services\/\d+$/) && method === 'PATCH')
  ) {
    const values = [
      text(b.name, 'Nombre', 100),
      text(b.description, 'Descripción', 500),
      integer(b.price, 'Precio', 1),
      integer(b.duration, 'Duración', 15, 480),
      integer(b.active ?? 1, 'Estado', 0, 1),
    ];
    if (method === 'POST')
      await db.run(
        'INSERT INTO services (name,description,price,duration,active) VALUES (?,?,?,?,?)',
        values,
      );
    else
      await db.run(
        'UPDATE services SET name=?,description=?,price=?,duration=?,active=? WHERE id=?',
        [...values, Number(path.split('/').pop())],
      );
    return { ok: true };
  }
  if (path.match(/^\/api\/services\/\d+$/) && method === 'DELETE') {
    const id = Number(path.split('/').pop());
    if (await one('SELECT id FROM appointments WHERE service_id=? LIMIT 1', [id]))
      await db.run('UPDATE services SET active=0 WHERE id=?', [id]);
    else await db.run('DELETE FROM services WHERE id=?', [id]);
    return { ok: true };
  }
  if (path === '/api/products' && method === 'POST') {
    const boxSize = b.unit === 'caja' && b.box_size ? integer(b.box_size, 'Unidades por caja', 1, 10000) : 0;
    const stock = integer(b.initial_stock ?? 0, 'Cantidad inicial', 0, 100000) * (boxSize || 1);
    const cost = purchaseCost(purchaseCost(b.unit_cost ?? 0) / (boxSize || 1));
    const createdAt = new Date().toISOString();
    const result = await db.run('INSERT INTO products (name,category,stock,minimum,unit_cost,unit,created_at,box_size) VALUES (?,?,?,?,?,?,?,?)', [
      text(b.name, 'Producto', 100),
      text(b.category, 'Categoría', 80),
      stock,
      integer(b.minimum, 'Stock mínimo', 0, 100000) * (boxSize || 1),
      cost,
      text(b.unit || 'unidad', 'Unidad', 30),
      createdAt,
      boxSize,
    ]);
    if (stock > 0)
      await db.run(
        "INSERT INTO stock_movements (product_id,quantity,reason,user_id,created_at,unit_cost,tipo_movimiento,existencias_antes,existencias_despues) VALUES (?,?,'Inventario inicial',?,?,?,'Entrada',0,?)",
        [result.lastInsertRowid, stock, u.id, createdAt, cost, stock],
      );
    return { ok: true };
  }
  if (path.match(/^\/api\/products\/\d+$/) && method === 'PATCH') {
    const id = Number(path.split('/').pop());
    const current = await one('SELECT stock,box_size,unit FROM products WHERE id=?', [id]);
    if (!current) fail('Producto no encontrado.', 404);
    const boxSize = b.box_size ? integer(b.box_size, 'Unidades por caja', 1, 10000) : current.box_size;
    if (boxSize && (b.unit || current.unit) !== 'caja') fail('La unidad de este producto debe ser caja.');
    if (current.box_size && b.box_size_before != null && Number(b.box_size_before) !== current.box_size)
      fail('La caja cambió. Vuelve a abrir el producto.', 409);
    if (current.box_size && boxSize !== current.box_size) fail('Edita las existencias en unidades. El tamaño de esta caja ya está registrado.');
    const factor = current.box_size ? 1 : boxSize || 1;
    const cost = purchaseCost(purchaseCost(b.unit_cost ?? 0) / factor);
    if (boxSize && !current.box_size && (b.stock_before == null || b.stock == null || Number(b.stock_before) !== current.stock))
      fail('Verifica las cajas disponibles antes de convertirlas en unidades.', 409);
    if (b.stock_before != null && b.stock != null) {
      const before = integer(b.stock_before, 'Cantidad anterior', 0, Number.MAX_SAFE_INTEGER);
      const after = integer(b.stock, 'Cantidad disponible', 0, Math.floor(2147483647 / factor)) * factor;
      if (after !== before || factor > 1) {
        const result = await db.run('UPDATE products SET stock=? WHERE id=? AND stock=?', [after, id, before]);
        if (!result.changes) fail('La cantidad cambió. Vuelve a abrir el producto para actualizarla.', 409);
        await db.run(
          "INSERT INTO stock_movements (product_id,quantity,reason,user_id,created_at,unit_cost,tipo_movimiento,existencias_antes,existencias_despues) VALUES (?,?,?,?,?,?,?,?,?)",
          [id, after - before * factor, factor > 1 ? 'Conversión de cajas a unidades' : 'Ajuste de inventario', u.id, new Date().toISOString(), cost, factor > 1 ? 'Conversión' : after > before ? 'Entrada' : 'Salida', before * factor, after],
        );
      }
    }
    await db.run('UPDATE products SET name=?,category=?,minimum=?,unit_cost=?,unit=COALESCE(?,unit),active=?,box_size=? WHERE id=?', [
      text(b.name, 'Producto', 100),
      text(b.category, 'Categoría', 80),
      integer(b.minimum, 'Stock mínimo', 0, current.box_size ? 1000000000 : 100000) * factor,
      cost,
      b.unit ? text(b.unit, 'Unidad', 30) : null,
      integer(b.active, 'Estado', 0, 1),
      boxSize,
      id,
    ]);
    return { ok: true };
  }
  if (path === '/api/movements' && method === 'GET')
    return await db.all(
      'SELECT m.*,p.name product_name,u.name user_name,pro.name manicurista FROM stock_movements m JOIN products p ON m.product_id=p.id JOIN users u ON u.id=m.user_id LEFT JOIN professional_supplies e ON e.id=m.id_entrega LEFT JOIN users pro ON pro.id=e.professional_id ORDER BY m.id DESC',
    );
  if (path === '/api/movements' && method === 'POST') {
    const id = integer(b.product_id, 'Producto', 1);
    const p = await one('SELECT * FROM products WHERE id=?', [id]);
    const count = integer(b.quantity, 'Cantidad', -100000, 100000);
    if (b.by_box && (!p?.box_size || count <= 0)) fail('Configura las unidades por caja antes de registrar la entrada.');
    const factor = b.by_box ? p.box_size : 1;
    const qty = count * factor;
    if (!p || !p.active || qty === 0 || p.stock + qty < 0)
      fail('El movimiento no es válido o dejaría stock negativo.');
    const cost = qty > 0 && b.unit_cost != null ? purchaseCost(purchaseCost(b.unit_cost) / factor) : Number(p.unit_cost);
    const average = qty > 0 ? (p.stock * Number(p.unit_cost) + qty * cost) / (p.stock + qty) : Number(p.unit_cost);
    await db.run('UPDATE products SET stock=stock+?,unit_cost=? WHERE id=?', [qty, purchaseCost(average), id]);
    await db.run(
      'INSERT INTO stock_movements (product_id,quantity,reason,user_id,created_at,unit_cost,tipo_movimiento,existencias_antes,existencias_despues,id_entrega) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, qty, text(b.reason, 'Motivo', 200), u.id, new Date().toISOString(), cost, qty > 0 ? 'Entrada' : 'Salida', p.stock, p.stock + qty, null],
    );
    return { ok: true };
  }
  if (path === '/api/payments' && method === 'POST') {
    const id = integer(b.appointment_id, 'Cita', 1),
      a = await one('SELECT * FROM appointments WHERE id=?', [id]);
    if (!a || ['Cancelada', 'Rechazada', 'No asistió'].includes(a.status))
      fail('Selecciona una cita vigente.');
    if (
      !['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Bancolombia'].includes(b.method) ||
      !['Pagado', 'Pendiente'].includes(b.status)
    )
      fail('Método o estado inválido.');
    const date = validDate(b.date);
    if (date > today()) fail('La fecha de pago no puede estar en el futuro.');
    const p = await one('SELECT id FROM payments WHERE appointment_id=?', [id]);
    if (p)
      await db.run('UPDATE payments SET amount=?,method=?,status=?,date=? WHERE id=?', [
        a.price,
        b.method,
        b.status,
        date,
        p.id,
      ]);
    else
      await db.run(
        'INSERT INTO payments (appointment_id,amount,method,status,date) VALUES (?,?,?,?,?)',
        [id, a.price, b.method, b.status, date],
      );
    await db.run('UPDATE payments SET confirmed_by=?,confirmed_at=? WHERE appointment_id=?', [
      b.status === 'Pagado' ? u.id : null,
      b.status === 'Pagado' ? new Date().toISOString() : '',
      id,
    ]);
    if (['Efectivo', 'Transferencia', 'Nequi', 'Bancolombia'].includes(b.method))
      await db.run('UPDATE appointments SET payment_method=?,payment_destination=? WHERE id=?', [
        b.method === 'Efectivo' ? 'Efectivo' : 'Transferencia',
        ['Nequi', 'Bancolombia'].includes(b.method) ? b.method : '',
        id,
      ]);
    return { ok: true };
  }
  if (path === '/api/settings' && method === 'PATCH') {
    const instagram = socialUrl(b.instagram_url, 'instagram'),
      facebook = socialUrl(b.facebook_url, 'facebook');
    if (instagram !== undefined)
      await db.run('UPDATE settings SET instagram_url=? WHERE id=1', [instagram]);
    if (facebook !== undefined)
      await db.run('UPDATE settings SET facebook_url=? WHERE id=1', [facebook]);
    if (b.lead_minutes == null || b.lead_minutes === '')
      fail('Recarga la página para guardar la anticipación en minutos.', 409);
    const leadMinutes = integer(b.lead_minutes, 'Anticipación en minutos', 0, 10080);
    const opens = validTime(b.opens),
      closes = validTime(b.closes);
    if (minute(opens) >= minute(closes)) fail('La apertura debe ser anterior al cierre.');
    await db.run(
      'UPDATE settings SET name=?,phone=?,email=?,address=?,cancellation_hours=?,lead_hours=?,lead_minutes=?,opens=?,closes=? WHERE id=1',
      [
        text(b.name, 'Nombre', 100),
        phone(b.phone),
        email(b.email),
        text(b.address, 'Dirección', 200),
        integer(b.cancellation_hours, 'Anticipación de cancelación', 0, 168),
        Math.floor(leadMinutes / 60),
        leadMinutes,
        opens,
        closes,
      ],
    );
    return { ok: true };
  }
  fail('Recurso no encontrado.', 404);
}
let queue = Promise.resolve();
async function handle(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const mutating = !['GET', 'HEAD'].includes(req.method);
      let b = {};
      if (mutating) {
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
          fail('Origen no autorizado.', 403);
        if (!req.headers['content-type']?.startsWith('application/json'))
          fail('Se requiere contenido JSON.', 415);
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > (url.pathname === '/api/profile/photo' ? 70000 : 20000))
            fail('Solicitud demasiado grande.', 413);
        }
        try {
          b = JSON.parse(raw || '{}');
          if (!b || typeof b !== 'object' || Array.isArray(b)) fail('Solicitud inválida.');
        } catch {
          fail('Solicitud inválida.');
        }
      }
      const execute = async () => {
        if (mutating) {
          await db.run(db.kind === 'mysql' ? 'START TRANSACTION' : 'BEGIN IMMEDIATE');
          if (db.kind === 'mysql') await db.all('SELECT id FROM app_lock WHERE id=1 FOR UPDATE');
        }
        try {
          const result = await api(req, res, url.pathname, url.searchParams, b, await session(req));
          if (mutating) await db.run('COMMIT');
          return result;
        } catch (e) {
          if (mutating) await db.run('ROLLBACK');
          throw e;
        }
      };
      const job = queue.then(execute);
      queue = job.catch(() => {});
      const result = await job;
      if (Buffer.isBuffer(result?.pdf)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.end(result.pdf);
        return;
      }
      res.end(JSON.stringify(result));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) fail('Método no permitido.', 405);
    let file = resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
    if (
      !file.startsWith(publicRoot + '/') &&
      !file.startsWith(publicRoot + '\\') &&
      file !== publicRoot
    )
      fail('Acceso denegado.', 403);
    if (!extname(file)) file = resolve(publicRoot, 'index.html');
    try {
      if (!(await stat(file)).isFile()) fail('No encontrado.', 404);
    } catch {
      fail('No encontrado.', 404);
    }
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch (e) {
    res.statusCode = e.status || 500;
    if (!e.status) console.error(e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: e.status ? e.message : 'No pudimos completar la operación. Intenta de nuevo.',
      }),
    );
  }
}
// Puesta en marcha del servidor HTTP.
const server = http.createServer(handle);
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () =>
  console.log(
    `SALONEY disponible en http://${['0.0.0.0', '::'].includes(process.env.HOST) ? '127.0.0.1' : process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000} · Base de datos: ${db.kind}`,
  ),
);

if (sendWhatsApp) {
  const reminderDb = await openDatabase();
  async function checkWhatsApp() {
    try {
      await sendDueReminders(reminderDb, sendWhatsApp);
    } catch (error) {
      console.error('No se pudieron revisar los recordatorios:', error.message);
    } finally {
      setTimeout(checkWhatsApp, 30000).unref();
    }
  }
  void checkWhatsApp();
}

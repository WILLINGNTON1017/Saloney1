import { appointmentTab, withinChangeWindow, overlapsLunch, timeLabel, timeRange, SALON_TIME_ZONE } from './schedule.js';
import { prepareProfilePhoto } from './profile-photo.js';
import { serviceTotals } from './service-totals.js';
import { servicePhoto } from './photos.js';
import { announceSessionChange } from './tab-session.js';
import {
  themeButton,
  applyTheme,
  paymentChoice,
  paymentFields,
  receiptLink,
} from './preferences.js';
applyTheme();
// Los campos se habilitan al enfocarlos; nunca se recuperan credenciales guardadas por SALONEY.
document.addEventListener('focusin', (event) => {
  if (event.target.matches('[data-manual-login]')) event.target.removeAttribute('readonly');
});
import { socialLinks } from './social.js';
import { icon } from './icons.js';
// Herramientas de la interfaz: selección de elementos y presentación de datos.
const $ = (s) => document.querySelector(s),
  app = $('#app'),
  modal = $('#modal');
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const money = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n || 0);
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const dateLabel = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d + 'T12:00:00-05:00').toLocaleDateString('es-CO', { ...opts, timeZone: SALON_TIME_ZONE });
const initials = (n) =>
  n
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('');
const avatar = (n, photo) =>
  photo
    ? `<img class="avatar profile-avatar" src="${esc(photo)}" alt="Foto de ${esc(n)}">`
    : `<span class="avatar">${esc(initials(n))}</span>`;
const badge = (s) =>
  `<span class="badge ${String(s).toLowerCase().replaceAll(' ', '-')}">${esc(s)}</span>`;
const empty = (s = 'No hay registros para mostrar.') =>
  `<div class="empty">${icon('calendar')}<p>${esc(s)}</p></div>`;
const brand = () =>
  `<a class="brand" href="#${state.user ? 'dashboard' : 'home'}" aria-label="SALONEY inicio"><span class="brand-mark">S</span><span><strong>SALONEY</strong><small>Salón de uñas y belleza</small></span></a>`;
const button = (label, action, extra = '', cls = '') =>
  `<button class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const field = (label, name, value = '', type = 'text', attrs = '') =>
  `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const select = (label, name, options, value = '', attrs = '') =>
  `<label>${label}<select name="${name}" ${attrs}>${options
    .map((o) => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(t)}</option>`;
    })
    .join('')}</select></label>`;
// Estado compartido de la pantalla y datos recibidos del servidor.
let state = {
  user: null,
  demo: false,
  services: [],
  professionals: [],
  settings: {},
  appointments: [],
  payments: [],
  users: [],
  products: [],
  supplies: [],
  clients: [],
  blocks: [],
  movements: [],
  notifications: { items: [], unread: 0 },
};
let booking = {},
  bookingStep = 0,
  calendarMonth = today().slice(0, 7),
  filterTab = 'Próximas',
  search = '',
  statusFilter = '',
  dateFilter = '',
  weekOffset = 0,
  reportFrom = today().slice(0, 7) + '-01',
  reportTo =
    today().slice(0, 7) +
    '-' +
    new Date(Number(today().slice(0, 4)), Number(today().slice(5, 7)), 0).getDate();
let renderSerial = 0;
// Comunicación con el servidor y tratamiento de errores.
async function api(path, method = 'GET', body, pdf = false) {
  let r;
  try {
    r = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error(
      'No hay conexión con el servidor. Abre iniciar.cmd en la carpeta SALONEY y pulsa Reintentar.',
    );
  }
  if (r.ok && pdf) return r.blob();
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 401 && state.user) {
      state.user = null;
      applyTheme('light');
      location.hash = 'login';
    }
    throw new Error(data.error || 'Ocurrió un error.');
  }
  return data;
}
function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 4500);
}
function openModal(title, body) {
  modal.innerHTML = `<div class="modal-head"><h2>${esc(title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Cerrar">×</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
const route = () => {
  const r = location.hash.slice(1).split('?')[0] || (state.user ? 'dashboard' : 'home');
  if (state.user) {
    const allowed = [
      ...navs[state.user.role].map((n) => n[0]),
      'profile',
      'privacy',
      'book',
      'home',
      'login',
      'register',
    ];
    if (['home', 'login', 'register'].includes(r)) return 'dashboard';
    return allowed.includes(r) ? r : 'dashboard';
  }
  return r;
};
function navigate(r) {
  if (route() === r) render();
  else location.hash = r;
}
function resetBooking(sid) {
  booking = {
    service_id: Number(sid || state.services.find((s) => s.active)?.id),
    professional_id: state.professionals[0]?.id,
    date: today(),
    time: '',
    design: 'Clásico',
    color: 'Rosado',
    notes: '',
  };
  bookingStep = 0;
  calendarMonth = today().slice(0, 7);
  navigate('book');
}
// Actualización de los datos según el rol de la cuenta.
async function refresh() {
  [state.services, state.professionals, state.settings] = await Promise.all([
    api('/services'),
    api('/professionals'),
    api('/settings'),
  ]);
  if (state.user) {
    await refreshNotifications();
    state.appointments = await api('/appointments');
    if (['admin', 'manicurista'].includes(state.user.role)) state.supplies = await api('/supplies');
    if (state.user.role !== 'manicurista') state.payments = await api('/payments');
    if (state.user.role === 'admin')
      [state.users, state.products, state.clients, state.movements] = await Promise.all([
        api('/users'),
        api('/products'),
        api('/clients'),
        api('/movements'),
      ]);
    if (state.user.role === 'manicurista')
      [state.clients, state.blocks, state.products] = await Promise.all([api('/clients'), api('/blocks'), api('/products')]);
  }
}
function notificationIcon() {
  return (
    icon('bell') +
    (state.notifications.unread
      ? '<span class="notification-count">' + state.notifications.unread + '</span>'
      : '')
  );
}
let notificationOwner = null;
let notificationsBusy = false;
async function refreshNotifications(announce = false) {
  if (!state.user || notificationsBusy) return;
  notificationsBusy = true;
  const owner = state.user.id;
  const previous = notificationOwner === owner ? state.notifications.items[0]?.id || 0 : null;
  try {
    const result = await api('/notifications');
    if (state.user?.id !== owner) return;
    state.notifications = result;
    notificationOwner = owner;
    const bell = document.querySelector('[data-action="notifications"]');
    if (bell) {
      bell.innerHTML = notificationIcon();
      bell.setAttribute('aria-label', 'Notificaciones: ' + result.unread + ' sin leer');
    }
    if (
      announce &&
      previous !== null &&
      result.items.some((n) => n.id > (previous || 0) && !n.read_at)
    )
      toast(result.items[0].message);
  } finally {
    notificationsBusy = false;
  }
}
async function pollNotifications() {
  if (!state.user || document.hidden) return;
  try {
    await refreshNotifications(true);
  } catch {
    /* Reintentar en el siguiente intervalo. */
  }
}
setInterval(pollNotifications, 15000);
document.addEventListener('visibilitychange', pollNotifications);
const roleLabel = () =>
  ({ admin: 'Administrador', cliente: 'Cliente', manicurista: 'Manicurista' })[state.user?.role] ||
  '';
const navs = {
  cliente: [
    ['dashboard', 'home', 'Inicio'],
    ['appointments', 'calendar', 'Mis citas'],
    ['services', 'sparkles', 'Servicios'],
    ['history', 'clock', 'Mi historial'],
    ['profile', 'user', 'Mi perfil'],
  ],
  manicurista: [
    ['dashboard', 'home', 'Inicio'],
    ['appointments', 'calendar', 'Mis citas'],
    ['agenda', 'calendar', 'Agenda'],
    ['clients', 'users', 'Clientes'],
    ['services', 'sparkles', 'Servicios'],
    ['availability', 'clock', 'Disponibilidad'],
    ['supplies', 'box', 'Mis productos'],
    ['reports', 'chart', 'Mis estadísticas'],
    ['profile', 'user', 'Mi perfil'],
  ],
  admin: [
    ['dashboard', 'home', 'Dashboard'],
    ['clients', 'users', 'Clientes'],
    ['professionals', 'users', 'Manicuristas'],
    ['services', 'sparkles', 'Servicios'],
    ['appointments', 'calendar', 'Citas'],
    ['payments', 'wallet', 'Pagos'],
    ['inventory', 'box', 'Inventario'],
    ['supplies', 'box', 'Productos en uso'],
    ['reports', 'chart', 'Reportes'],
    ['users', 'users', 'Usuarios'],
    ['settings', 'settings', 'Ajustes'],
  ],
};
// Estructura de navegación para las cuentas que iniciaron sesión.
function shell(body) {
  const current = route();
  return `<div class="app-shell"><aside class="sidebar" id="sidebar">${brand()}<nav>${navs[state.user.role].map(([r, i, l], index) => `${state.user.role === 'admin' && index === 1 ? '<div class="nav-label">GESTIÓN DEL SALÓN</div>' : ''}${state.user.role === 'admin' && index === 8 ? '<div class="nav-label">CONFIGURACIÓN</div>' : ''}<a href="#${r}" class="nav-link ${current === r ? 'active' : ''}">${icon(i)}${l}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note">${icon('heart')}<h3>Cada detalle cuenta.</h3><p>Un espacio para cuidar,<br>crear y hacerte brillar.</p></div><button class="nav-link full" data-action="logout">${icon('logout')}Cerrar sesión</button></div></aside><div class="main-shell"><header class="topbar"><div class="row"><button class="mobile-menu" data-action="menu" aria-label="Abrir menú">${icon('menu')}</button><span class="topbar-label">SALONEY <span class="muted">/</span> <strong>Panel de ${roleLabel().toLowerCase()}</strong></span></div><div class="topbar-right">${themeButton()}<button class="btn outline topbar-logout" data-action="logout">Cerrar sesión</button><button class="notification-bell" data-action="notifications" aria-label="Notificaciones">${notificationIcon()}</button><a href="#profile" class="user-info">${avatar(state.user.name, state.user.profile_photo)}<span><strong>${esc(state.user.name)}</strong><small>${roleLabel()}</small></span>${icon('chevron')}</a></div></header><main class="content">${body}<div class="account-social">${socialLinks(state.settings)}</div></main></div></div>`;
}
function publicShell(body) {
  return `<header class="public-header">${brand()}<nav class="public-nav"><a href="#home">Inicio</a><a href="#services">Servicios</a><a href="#about">Sobre nosotros</a><a href="#contact">Contacto</a></nav><div class="row">${themeButton()}<a href="#login" class="btn outline">Iniciar sesión</a><a href="#register" class="btn register-link">Registrarse</a></div></header>${body}`;
}
function title(h, p = '', action = '') {
  return `<div class="page-title"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div>${action || `<span class="date-chip">${icon('calendar')}${dateLabel(today(), { weekday: 'short', day: 'numeric', month: 'long' })}</span>`}</div>`;
}
function stat(label, value, i = 'calendar', tone = '', foot = '') {
  return `<div class="stat-card"><div class="stat-icon ${tone}">${icon(i)}</div><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-foot">${foot || ' '}</div></div></div>`;
}
function serviceCards(limit = 99) {
  return `<div class="services-grid">${state.services
    .filter((s) => s.active)
    .slice(0, limit)
    .map(
      (s) =>
        `<article class="service-card"><img class="service-image" src="${servicePhoto(s.id)}" alt="Diseño de uñas de SALONEY" loading="lazy"><div class="service-body"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="service-meta"><strong>${money(s.price)}</strong><span>${s.duration} min</span></div>${!state.user || state.user.role === 'cliente' ? button('Reservar cita', 'book', `data-id="${s.id}"`, 'outline full') : ''}</div></article>`,
    )
    .join('')}</div>`;
}
function home() {
  return `<section class="hero"><img src="/assets/portada-saloney.png" alt="Uñas rosadas con detalles negros junto a un espejo decorado"><div class="hero-content"><span class="hero-tag pink">TU MOMENTO DE CUIDADO</span><h1>Un toque de color.<br>Un momento <em>para ti.</em></h1><p>Uñas bonitas, manos cuidadas y ese pequeño detalle que te hace sentir increíble.</p><div class="row">${button('Reservar mi cita ' + icon('arrow'), 'book')}<a class="btn outline" href="#services">Ver servicios</a></div></div></section><section class="public-section"><div class="section-title"><div><span class="eyebrow">HECHOS PARA TI</span><h2>Nuestros servicios</h2></div><a href="#services" class="text-link">Ver todos →</a></div>${serviceCards(4)}</section><footer class="public-footer">${brand()}<div><strong>Tu próxima cita empieza aquí.</strong><p class="muted">${esc(state.settings.address)} · ${esc(state.settings.phone)}</p></div>${socialLinks(state.settings)}<a href="#privacy" class="text-link">Privacidad y condiciones</a></footer>`;
}
function auth(register = false) {
  return `<main class="auth-wrap"><div class="auth-card"><div class="auth-art">${brand()}<img src="/assets/${register ? 'unas-flores-doradas' : 'unas-mariposas'}.png" alt="${register ? 'Manicure en tonos rosados' : 'Uñas rosadas con mariposas violetas y puntas francesas'}"></div><div class="auth-form"><h1>${register ? 'Crea tu cuenta' : 'Qué bueno verte'}</h1><p class="muted">${register ? 'Regístrate para reservar tus citas y guardar tu historial.' : 'Inicia sesión y encuentra tu espacio en SALONEY.'}</p><form data-form="${register ? 'register' : 'login'}" class="form-stack" autocomplete="off">${register ? field('Nombre completo', 'name', '', 'text', 'required maxlength="100" autocomplete="off"') + field('Nombre de usuario', 'username', '', 'text', 'required minlength="3" maxlength="80" autocomplete="off"') + field('Correo electrónico', 'email', '', 'email', 'required autocomplete="off"') + field('Teléfono', 'phone', '', 'tel', 'required autocomplete="off"') : field('Usuario o correo electrónico', 'login', '', 'text', 'required autocomplete="off" readonly data-manual-login="true" autocapitalize="none" spellcheck="false"')}${field('Contraseña', 'password', '', 'password', `required minlength="8" maxlength="128" autocomplete="${register ? 'new-password' : 'off'}" autocapitalize="none" spellcheck="false" ${register ? '' : 'readonly data-manual-login="true"'}`)}${register ? field('Confirmar contraseña', 'confirm', '', 'password', 'required minlength="8" autocomplete="new-password"') + '<label class="check"><input type="checkbox" name="terms" required><span>Acepto las <a href="#privacy" class="pink">condiciones y el tratamiento de mis datos</a>.</span></label>' : '<button type="button" class="text-link" data-action="forgot">¿Olvidaste tu contraseña?</button>'}<div class="form-error"></div><button class="btn full">${register ? 'Crear mi cuenta' : 'Iniciar sesión'}</button></form><p class="inline-note spaced">${register ? '¿Ya tienes cuenta? <a href="#login" class="pink">Inicia sesión</a>' : '¿Aún no tienes cuenta? <a href="#register" class="pink">Regístrate aquí</a>'}</p></div></div></main>`;
}
function donut(apps) {
  const colors = ['#f9bd3f', '#55b67d', '#6894ed', '#a086d2', '#ed7898', '#bfa4b4', '#b98946'];
  const labels = [
    'Pendiente',
    'Confirmada',
    'En proceso',
    'Finalizada',
    'Cancelada',
    'Rechazada',
    'No asistió',
  ];
  let pos = 0;
  const counts = labels.map((l) => apps.filter((a) => a.status === l).length);
  const gradient = counts
    .map((n, i) => {
      let start = pos;
      pos += apps.length ? (n / apps.length) * 100 : 0;
      return `${colors[i]} ${start}% ${pos}%`;
    })
    .join(',');
  return `<div class="donut-wrap"><div class="donut" style="background:${apps.length ? `conic-gradient(${gradient})` : '#f0e7ed'}"><div class="donut-hole"><strong>${apps.length}</strong><span>Citas en total</span></div></div><div class="legend">${labels.map((s, i) => `<div><i style="background:${colors[i]}"></i>${s}<b>${counts[i]}</b></div>`).join('')}</div></div>`;
}
function agendaRows(apps) {
  return apps.length
    ? apps
        .map(
          (a) =>
            `<div class="agenda-row"><span class="agenda-time">${timeRange(a.time, a.duration)}</span>${avatar(a.client_name, a.client_photo)}<button class="agenda-person" data-action="detail" data-id="${a.id}" style="text-align:left"><strong>${esc(state.user.role === 'cliente' ? a.service_name : a.client_name)}</strong><small>${esc(state.user.role === 'cliente' ? a.professional_name : a.service_name)}</small></button>${badge(a.status)}</div>`,
        )
        .join('')
    : empty('No tienes citas para este día.');
}
function dashboard() {
  const apps = state.appointments,
    todayApps = apps.filter((a) => a.date === today()).sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = apps
    .filter(
      (a) =>
        appointmentTab(a) === 'Próximas',
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const monthApps = apps.filter((a) => a.date.startsWith(today().slice(0, 7)));
  const monthWork = serviceTotals(monthApps),
    dayWork = serviceTotals(todayApps);
  const income = (
    state.user.role === 'manicurista'
      ? apps.map((a) => ({
          status: a.payment_status,
          date: a.payment_date || '',
          amount: a.payment_amount || 0,
        }))
      : state.payments
  )
    .filter((p) => p.status === 'Pagado' && p.date.startsWith(today().slice(0, 7)))
    .reduce((n, p) => n + p.amount, 0);
  const isClient = state.user.role === 'cliente',
    isPro = state.user.role === 'manicurista';
  if (isClient)
    return `${title(`Hola, ${esc(state.user.name.split(' ')[0])} <span class="pink">♡</span>`, 'Un nuevo día para consentirte. ¿Lista para tu próxima cita?')}<div class="welcome-card"><img src="/assets/unas-flores-doradas.png" alt="Manicure rosado"><div><span class="eyebrow">UN MOMENTO SOLO PARA TI</span><h2>Tu próxima cita, a un clic.</h2><p>Elige tu servicio favorito y reserva con la manicurista que prefieras.</p>${button('Reservar ahora ' + icon('arrow'), 'book')}</div></div><div class="stats-grid">${stat('Próximas citas', upcoming.length)}${stat('Visitas realizadas', apps.filter((a) => a.status === 'Finalizada').length, 'check', 'green')}${stat('Total pagado', money(state.payments.filter((p) => p.status === 'Pagado').reduce((n, p) => n + p.amount, 0)), 'wallet', 'purple')}${stat('Servicios disponibles', state.services.filter((s) => s.active).length, 'sparkles', 'orange')}</div><div class="card spaced"><div class="card-head"><h2>Tu próxima cita</h2><a href="#appointments" class="text-link">Ver mis citas →</a></div>${upcoming.length ? appointmentCard(upcoming[0]) : empty('Aún no tienes una cita. Reserva tu próximo momento de cuidado.')}</div><div class="section-title spaced"><h2>Encuentra tu próximo favorito</h2><a href="#services" class="text-link">Ver todos →</a></div>${serviceCards(4)}`;
  return `${title(`¡Hola, ${isPro ? esc(state.user.name.split(' ')[0]) : 'Administrador'}! <span class="pink">✧</span>`, isPro ? 'Aquí tienes tu agenda y un resumen de tu día.' : 'Así va tu salón. Todo lo que necesitas, en un solo lugar.')}<div class="stats-grid">${stat('Citas registradas hoy', todayApps.length, 'calendar', '', `${dayWork.count} finalizadas · ${todayApps.filter((a) => ['Cancelada', 'Rechazada'].includes(a.status)).length} canceladas/rechazadas`)}${stat(isPro ? 'Atenciones del mes' : 'Clientes registrados', isPro ? monthApps.filter((a) => a.status === 'Finalizada').length : state.clients.length, isPro ? 'check' : 'users', 'purple', isPro ? 'Servicios finalizados' : 'Tu comunidad SALONEY')}${stat('Servicios realizados del mes', money(monthWork.total), 'wallet', 'green', 'Se suma al finalizar cada cita')}${stat(isPro ? 'Próximas citas' : 'Manicuristas activas', isPro ? upcoming.length : state.professionals.length, isPro ? 'clock' : 'sparkles', 'orange', isPro ? 'Pendientes y confirmadas' : 'Un equipo que hace brillar')}</div><div class="stats-grid">${stat('Servicios realizados hoy', money(dayWork.total), 'sparkles', 'purple', dayWork.count + ' citas finalizadas')}${stat('Dinero recibido del mes', money(income), 'wallet', 'green', 'Pagos confirmados')}${stat('Pendiente de cobro del mes', money(monthWork.pending), 'clock', 'orange', 'Servicios finalizados sin pago confirmado')}</div><div class="dashboard-grid"><section class="card"><div class="card-head"><div><h2>Tu agenda de hoy</h2><p class="inline-note" style="margin-top:5px">${dateLabel(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><a href="#${isPro ? 'agenda' : 'appointments'}" class="btn outline small">${icon('calendar')}Ver calendario</a></div>${agendaRows(todayApps)}<a class="btn outline full spaced" href="#appointments">Ver todas las citas</a></section><section class="card"><div class="card-head"><h2>Estado de las citas de hoy</h2></div>${donut(todayApps)}<p class="inline-note" style="text-align:center;margin-top:18px">Tu agenda se actualiza con cada reserva.</p></section><section class="card"><div class="card-head"><h2>Próximas citas</h2><a href="#appointments" class="text-link">Ver todas →</a></div>${
    upcoming
      .slice(0, 4)
      .map(
        (a) =>
          `<div class="agenda-row"><div class="stat-icon purple">${icon('calendar')}</div><div class="agenda-person"><strong>${dateLabel(a.date)} · ${timeRange(a.time, a.duration)}</strong><small>${esc(a.client_name)} · ${esc(a.service_name)}</small></div><button class="text-link" data-action="detail" data-id="${a.id}">Ver</button></div>`,
      )
      .join('') || empty('No hay próximas citas.')
  }</section><section class="card"><div class="card-head"><h2>${isPro ? 'Tus clientes frecuentes' : 'Servicios más solicitados'}</h2><a href="#${isPro ? 'clients' : 'reports'}" class="text-link">Ver todos →</a></div>${
    isPro
      ? state.clients
          .slice()
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 4)
          .map(
            (c) =>
              `<div class="agenda-row">${avatar(c.name, c.profile_photo)}<div class="agenda-person"><strong>${esc(c.name)}</strong><small>${c.visits} citas contigo</small></div><button class="btn outline small" data-action="client-history" data-id="${c.id}">Historial</button></div>`,
          )
          .join('') || empty()
      : bars(
          state.services
            .map((s) => [s.name, apps.filter((a) => a.service_id === s.id).length])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5),
        )
  }</section></div>${isPro ? `<section class="card spaced"><div class="card-head"><h2>Mi agenda semanal</h2><a class="text-link" href="#agenda">Abrir agenda →</a></div>${weekCalendar()}</section>` : ''}`;
}
function appointmentCard(a) {
  return `<article class="appointment-card"><img src="${servicePhoto(a.service_id)}" alt=""><div class="info"><h3>${esc(a.service_name)}</h3><p>${dateLabel(a.date)} · ${timeRange(a.time, a.duration)}<br>${esc(a.professional_name)}${state.user?.role !== 'cliente' ? ` · ${esc(a.client_name)}` : ''}</p></div>${badge(a.status)}${button('Ver detalles', 'detail', `data-id="${a.id}"`, 'outline small')}</article>`;
}
function filteredAppointments(history = false) {
  return state.appointments.filter(
    (a) =>
      (!search ||
        [a.client_name, a.service_name, a.professional_name, String(a.id)].some((v) =>
          v.toLowerCase().includes(search.toLowerCase()),
        )) &&
      (!statusFilter || a.status === statusFilter) &&
      (!dateFilter || a.date === dateFilter) &&
      (history || state.user.role !== 'cliente' || appointmentTab(a) === filterTab) &&
      (!history || ['Finalizada', 'Cancelada', 'Rechazada', 'No asistió'].includes(a.status)),
  );
}
function appointments(history = false) {
  const client = state.user.role === 'cliente';
  const apps = filteredAppointments(history);
  const toolbar = `<div class="table-toolbar"><input id="search" placeholder="Buscar cita, cliente o servicio…" aria-label="Buscar citas" value="${esc(search)}">${!client ? `<select id="status-filter" aria-label="Filtrar estado"><option value="">Todos los estados</option>${['Pendiente', 'Confirmada', 'En proceso', 'Finalizada', 'Cancelada', 'Rechazada', 'No asistió'].map((s) => `<option ${statusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}</select><input type="date" id="date-filter" aria-label="Filtrar por fecha" value="${dateFilter}" style="max-width:180px">` : ''}</div>`;
  return `${title(history ? 'Mi historial' : client ? 'Mis citas' : 'Gestión de citas', history ? 'Tus visitas, servicios y momentos en SALONEY.' : 'Consulta los detalles y el estado de cada reserva.', client ? button('＋ Reservar cita', 'book') : '')}<section class="card">${client && !history ? `<div class="tabs">${['Próximas', 'Pasadas', 'Canceladas'].map((t) => `<button class="tab ${filterTab === t ? 'active' : ''}" data-action="tab" data-tab="${t}">${t}</button>`).join('')}</div>` : ''}${toolbar}<div id="list-content">${appointmentList(apps, client)}</div></section>`;
}
function appointmentList(apps, client = state.user.role === 'cliente') {
  return client
    ? apps.map(appointmentCard).join('') || empty('No se encontraron citas en esta sección.')
    : table(
        ['Fecha / hora', 'Cliente', 'Servicio', 'Manicurista', 'Estado', 'Acciones'],
        apps.map((a) => [
          `<span>${dateLabel(a.date)}</span><small>${timeRange(a.time, a.duration)}</small>`,
          esc(a.client_name),
          `${esc(a.service_name)}<small>${money(a.price)}</small>`,
          esc(a.professional_name),
          badge(a.status),
          button('Ver detalles', 'detail', `data-id="${a.id}"`, 'outline small'),
        ]),
      ) + `<p class="table-count">${apps.length} citas encontradas</p>`;
}
function table(headers, rows) {
  return rows.length
    ? `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : empty('No se encontraron resultados.');
}
function services() {
  if (state.user?.role === 'admin')
    return `${title('Servicios', 'Cuida tu catálogo: precios, duración y disponibilidad.', button('＋ Nuevo servicio', 'edit-service'))}<section class="card"><div class="table-toolbar"><input id="search" placeholder="Buscar servicio…" aria-label="Buscar servicio" value="${esc(search)}"></div><div id="list-content">${servicesTable()}</div></section>`;
  return `${title('Nuestros servicios', 'Elige ese pequeño detalle que te hace sentir increíble.')} ${serviceCards()}`;
}
function servicesTable() {
  return table(
    ['Servicio', 'Duración', 'Precio', 'Estado', 'Acciones'],
    state.services
      .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
      .map((s) => [
        `${esc(s.name)}<small>${esc(s.description)}</small>`,
        s.duration + ' min',
        money(s.price),
        badge(s.active ? 'Activo' : 'Inactivo'),
        `<div class="row">${button(icon('edit'), 'edit-service', `data-id="${s.id}" aria-label="Editar ${esc(s.name)}"`, 'outline small')}${button(icon('trash'), 'delete-service', `data-id="${s.id}" aria-label="Eliminar ${esc(s.name)}"`, 'ghost small')}</div>`,
      ]),
  );
}
function peoplePage(kind) {
  const names = {
    clients: ['Clientes', 'Conoce a las personas que hacen parte de SALONEY.', 'Nuevo cliente'],
    professionals: [
      'Manicuristas',
      'Tu equipo, sus especialidades y su estado.',
      'Nueva manicurista',
    ],
    users: ['Usuarios del sistema', 'Administra las cuentas y sus permisos.', 'Nuevo usuario'],
  };
  const [h, p, b] = names[kind];
  return `${title(h, p, state.user.role === 'admin' ? button('＋ ' + b, 'edit-user', `data-kind="${kind}"`) : '')}<section class="card"><div class="table-toolbar"><input id="search" placeholder="Buscar por nombre, correo o teléfono…" aria-label="Buscar personas" value="${esc(search)}"></div><div id="list-content">${peopleTable(kind)}</div></section>`;
}
function peopleTable(kind) {
  const administrator = state.user.role === 'admin';
  let users =
    kind === 'clients'
      ? state.clients
      : state.users.filter((u) => kind !== 'professionals' || u.role === 'manicurista');
  if (administrator)
    users = users.map((u) => ({
      ...u,
      username: state.users.find((account) => account.id === u.id)?.username || u.username || '',
    }));
  users = users.filter((u) =>
    [u.name, u.email, u.phone, ...(administrator ? [u.username] : [])].some((v) =>
      (v || '').toLowerCase().includes(search.toLowerCase()),
    ),
  );
  return table(
    [
      'Nombre',
      ...(administrator ? ['Usuario de acceso', 'Contraseña'] : []),
      kind === 'professionals' ? 'Especialidad' : 'Contacto',
      kind === 'clients' ? 'Citas' : 'Rol',
      'Estado',
      'Acciones',
    ],
    users.map((u) => [
      `<span class="row">${avatar(u.name, u.profile_photo)}${esc(u.name)}</span>`,
      ...(administrator
        ? [
            esc(u.username),
            '<span class="muted">No recuperable</span>' +
              button(
                'Restablecer contraseña',
                'edit-user',
                `data-id="${u.id}" data-kind="${kind}"`,
                'outline small',
              ),
          ]
        : []),
      kind === 'professionals' ? esc(u.specialty) : `${esc(u.email)}<small>${esc(u.phone)}</small>`,
      kind === 'clients'
        ? u.visits
        : { admin: 'Administrador', cliente: 'Cliente', manicurista: 'Manicurista' }[u.role],
      badge(u.active ? 'Activo' : 'Inactivo') +
        (u.role === 'manicurista'
          ? '<small>' + (u.online ? 'Activa' : 'Desconectada') + '</small>'
          : ''),
      `<div class="row">${kind === 'clients' ? button('Historial', 'client-history', `data-id="${u.id}"`, 'outline small') : ''}${state.user.role === 'admin' ? button(icon('edit'), 'edit-user', `data-id="${u.id}" data-kind="${kind}" aria-label="Editar ${esc(u.name)}"`, 'outline small') + (u.id !== state.user.id ? button('Eliminar', 'delete-user', `data-id="${u.id}"`, 'outline small') : '') : ''}</div>`,
    ]),
  );
}
function weekCalendar() {
  const d = new Date(today() + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  return `<div class="table-wrap"><div class="week-grid">${days
    .map(
      (day) =>
        `<div class="week-day ${day === today() ? 'today' : ''}"><header>${dateLabel(day, { weekday: 'short' })}<br><strong>${dateLabel(day, { day: 'numeric', month: 'short' })}</strong></header>${state.appointments
          .filter(
            (a) => a.date === day && !['Cancelada', 'Rechazada', 'No asistió'].includes(a.status),
          )
          .sort((a, b) => a.time.localeCompare(b.time))
          .map(
            (a) =>
              `<button class="week-event" data-action="detail" data-id="${a.id}"><strong>${timeRange(a.time, a.duration)} · ${esc(a.client_name)}</strong><span>${esc(a.service_name)}</span><span>${esc(a.status)}</span></button>`,
          )
          .join('')}</div>`,
    )
    .join('')}</div></div>`;
}
function agenda() {
  return `${title('Mi agenda', 'Organiza tu semana y consulta cada atención.')}<section class="card"><div class="card-head"><h2>Semana ${weekOffset === 0 ? 'actual' : ''}</h2><div class="row">${button('‹', 'week', `data-delta="-1" aria-label="Semana anterior"`, 'outline small')}${button('Hoy', 'week', `data-delta="0"`, 'outline small')}${button('›', 'week', `data-delta="1" aria-label="Semana siguiente"`, 'outline small')}</div></div>${weekCalendar()}</section>`;
}
function suppliesPage() {
  const active = state.supplies.filter(s => !s.exhausted_at);
  const finished = state.supplies.filter(s => s.exhausted_at);
  const rows = (items, done) => table(['Producto', 'Manicurista', 'Cantidad', 'Costo de compra', done ? 'Fecha de agotamiento' : 'Acción'], items.map(s => [esc(s.product_name), esc(s.professional_name), s.quantity + ' ' + esc(s.unit), money(s.quantity * s.unit_cost), done ? esc(new Date(s.exhausted_at).toLocaleString('es-CO', { timeZone: SALON_TIME_ZONE })) : button('Se acabó', 'finish-supply', `data-id="${s.id}"`, 'outline small')]));
  return `${title(state.user.role === 'admin' ? 'Productos en uso' : 'Mis productos', 'Elige los productos que necesitas y marca cada uno cuando se termine.', button(state.supplies.length ? '＋ Solicitar productos' : '＋ Elegir mis primeros productos', 'take-supply'))}<p class="notice">Los productos se descuentan del almacén al confirmar tu solicitud. Cuando se terminen, márcalos como agotados y solicita los que necesites reponer.</p><section class="card spaced"><h2>En uso</h2>${active.length ? rows(active, false) : empty('Todavía no hay productos en uso.')}</section><section class="card spaced"><h2>Productos agotados</h2>${finished.length ? rows(finished, true) : empty('Todavía no se han registrado productos agotados.')}</section>`;
}
function inventory() {
  return `${title('Inventario', 'Controla tus productos y cada entrada o salida.', button('＋ Nuevo producto', 'edit-product'))}<section class="card"><div class="table-toolbar"><input id="search" placeholder="Buscar producto…" aria-label="Buscar producto" value="${esc(search)}">${button('Ver movimientos', 'movements', '', 'outline')}</div>${state.products.some((p) => p.active && p.stock <= p.minimum) ? `<div class="notice">${icon('box')} Hay ${state.products.filter((p) => p.active && p.stock <= p.minimum).length} productos en el nivel mínimo o por debajo.</div>` : ''}<div id="list-content">${inventoryTable()}</div></section>`;
}
function inventoryTable() {
  return table(
    ['Producto', 'Fecha de registro (Colombia)', 'Categoría', 'Cantidad disponible', 'Unidad de medida', 'En uso', 'Costo por unidad', 'Valor en inventario', 'Mínimo', 'Estado', 'Acciones'],
    state.products
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .map((p) => [
        esc(p.name),
        p.created_at ? esc(new Date(p.created_at).toLocaleString('es-CO', { timeZone: SALON_TIME_ZONE })) : 'Fecha no registrada',
        esc(p.category),
        `<strong class="${p.stock <= p.minimum ? 'pink' : ''}">${p.stock}</strong>`,
        p.box_size ? 'Unidad (caja de ' + Number(p.box_size) + ')' : esc(p.unit || 'unidad'),
        Number(p.in_use || 0),
        money(p.unit_cost),
        money(p.stock * p.unit_cost),
        p.minimum,
        badge(p.active ? 'Activo' : 'Inactivo'),
        `<div class="row">${button('Movimiento', 'stock', `data-id="${p.id}"`, 'outline small')}${button(icon('edit'), 'edit-product', `data-id="${p.id}" aria-label="Editar producto"`, 'ghost small')}</div>`,
      ]),
  );
}
function payments() {
  return `${title('Pagos', 'Registra y consulta los pagos asociados a las citas.', button('＋ Registrar pago', 'payment'))}<section class="card"><div class="table-toolbar"><input id="search" placeholder="Buscar pago o cliente…" aria-label="Buscar pago" value="${esc(search)}"></div><div id="list-content">${paymentsTable()}</div><div class="summary-line spaced"><span>Total recibido</span><strong>${money(state.payments.filter((p) => p.status === 'Pagado').reduce((n, p) => n + p.amount, 0))}</strong></div></section>`;
}
function paymentsTable() {
  return table(
    ['Fecha', 'Cita', 'Cliente', 'Valor', 'Método', 'Estado', 'Acciones'],
    state.payments
      .filter((p) =>
        [p.client_name, p.service_name, String(p.appointment_id)].some((v) =>
          v.toLowerCase().includes(search.toLowerCase()),
        ),
      )
      .map((p) => [
        dateLabel(p.date),
        '#' + p.appointment_id,
        `${esc(p.client_name)}<small>${esc(p.service_name)}</small>`,
        money(p.amount),
        esc(p.method),
        badge(p.status),
        '<div class="row">' +
          button('Editar', 'payment', `data-id="${p.appointment_id}"`, 'outline small') +
          (p.status === 'Pagado'
            ? button('Factura PDF', 'invoice-pdf', `data-id="${p.appointment_id}"`, 'outline small')
            : '') +
          '</div>',
      ]),
  );
}
function bars(data, monetary = false) {
  const max = Math.max(...data.map((x) => x[1]), 1);
  return `<div class="bar-list">${data.map(([name, n]) => `<div><div class="bar-label"><span>${esc(name)}</span><strong>${monetary ? money(n) : n}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${(n / max) * 100}%"></div></div></div>`).join('') || empty('No hay datos para este período.')}</div>`;
}
function reportData() {
  const apps = state.appointments.filter((a) => a.date >= reportFrom && a.date <= reportTo),
    payments = state.payments.filter(
      (p) => p.date >= reportFrom && p.date <= reportTo && p.status === 'Pagado',
    );
  return { apps, payments };
}
function cancellationReport(apps) {
  const cancelled = apps.filter((a) => ['Cancelada', 'Rechazada'].includes(a.status));
  return (
    '<section class="card spaced"><div class="card-head"><h2>Citas canceladas y rechazadas</h2></div><p class="inline-note">Se incluyen según la fecha programada de la cita, no el día en que se canceló. El período inicial abarca todo el mes.</p>' +
    table(
      ['Cita', 'Fecha programada', 'Cliente', 'Estado', 'Motivo'],
      cancelled.map((a) => [
        '#' + a.id,
        dateLabel(a.date),
        esc(a.client_name),
        badge(a.status),
        esc(a.reason || 'Sin motivo registrado'),
      ]),
    ) +
    '</section>'
  );
}
function reports() {
  const { apps, payments } = reportData(),
    pro = state.user.role === 'manicurista';
  const group = (key, list = apps) => {
    const m = {};
    for (const a of list) m[a[key]] = (m[a[key]] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const byService = state.services
    .map((s) => [s.name, apps.filter((a) => a.service_id === s.id).length])
    .sort((a, b) => b[1] - a[1]);
  const earned = payments.reduce((n, p) => n + p.amount, 0);
  return `<div class="reports-page">${title(pro ? 'Mis estadísticas' : 'Reportes del salón', 'Indicadores calculados a partir de los registros del sistema.', button(icon('download') + ' Descargar PDF', 'report-pdf', '', 'outline'))}<div class="card spaced"><form data-form="report-period" class="period-fields">${field('Fecha de la cita / pago desde', 'from', reportFrom, 'date', 'required')}${field('Hasta', 'to', reportTo, 'date', 'required')}<button class="btn">Aplicar período</button><div class="form-error"></div></form></div><section class="report-summary"><h2>Resumen de citas</h2><div class="report-metrics report-metrics-citas">${stat('Citas del período', apps.length, 'calendar', '', 'Reservas registradas')}${stat('Finalizadas', apps.filter((a) => a.status === 'Finalizada').length, 'check', 'green', 'Servicios terminados')}${stat('No asistió', apps.filter((a) => a.status === 'No asistió').length, 'clock', 'orange', 'Ausencias registradas')}${stat('Canceladas / rechazadas', apps.filter((a) => ['Cancelada', 'Rechazada'].includes(a.status)).length, 'calendar', 'purple', 'Citas sin atención')}</div></section><section class="report-summary"><h2>${pro ? 'Resumen de atención' : 'Resumen de dinero'}</h2><div class="report-metrics report-metrics-money">${stat('Servicios realizados', money(serviceTotals(apps).total), 'wallet', 'green', 'Valor de las citas finalizadas')}${stat(pro ? 'Clientes atendidos' : 'Ingresos recibidos', pro ? new Set(apps.filter((a) => a.status === 'Finalizada').map((a) => a.client_id || a.guest_phone)).size : money(earned), pro ? 'users' : 'wallet', 'purple', pro ? 'Personas con servicios finalizados' : 'Pagos confirmados del período')}${stat('Pendiente de cobro', money(serviceTotals(apps).pending), 'clock', 'orange', 'De los servicios finalizados')}</div></section>${cancellationReport(apps)}<div class="report-grid"><section class="card"><div class="card-head"><h2>Citas por estado</h2></div>${donut(apps)}</section><section class="card"><div class="card-head"><h2>Servicios más y menos solicitados</h2></div>${bars(byService)}</section><section class="card"><div class="card-head"><h2>Horarios con más reservas</h2></div>${bars(group('time'))}</section><section class="card"><div class="card-head"><h2>Clientes frecuentes</h2></div>${bars(group('client_name'))}</section>${
    pro
      ? ''
      : `<section class="card"><div class="card-head"><h2>Citas por manicurista</h2></div>${bars(group('professional_name'))}</section><section class="card"><div class="card-head"><h2>Métodos de pago</h2></div>${bars(group('method', payments))}</section><section class="card"><div class="card-head"><h2>Ingresos por día</h2></div>${bars(
          [...new Set(payments.map((p) => p.date))]
            .sort()
            .map((d) => [
              dateLabel(d),
              payments.filter((p) => p.date === d).reduce((n, p) => n + p.amount, 0),
            ]),
          true,
        )}</section><section class="card"><div class="card-head"><h2>Ingresos por servicio</h2></div>${bars(
          state.services
            .map((s) => [
              s.name,
              payments.filter((p) => p.service_name === s.name).reduce((n, p) => n + p.amount, 0),
            ])
            .sort((a, b) => b[1] - a[1]),
          true,
        )}</section><section class="card"><div class="card-head"><h2>Clientes que más gastan</h2></div>${bars(
          [...new Set(payments.map((p) => p.client_name))]
            .map((c) => [
              c,
              payments.filter((p) => p.client_name === c).reduce((n, p) => n + p.amount, 0),
            ])
            .sort((a, b) => b[1] - a[1]),
          true,
        )}</section><section class="card"><div class="card-head"><h2>Resumen administrativo</h2></div><div class="summary-line"><span>Clientes registrados</span><strong>${state.clients.length}</strong></div><div class="summary-line"><span>Clientes nuevos en el período</span><strong>${state.users.filter((u) => u.role === 'cliente' && u.created_at.slice(0, 10) >= reportFrom && u.created_at.slice(0, 10) <= reportTo).length}</strong></div><div class="summary-line"><span>Citas del período sin pago completo</span><strong>${apps.filter((a) => !['Cancelada', 'Rechazada', 'No asistió'].includes(a.status) && !state.payments.some((p) => p.appointment_id === a.id && p.status === 'Pagado')).length}</strong></div><div class="summary-line"><span>Productos con stock bajo</span><strong>${state.products.filter((p) => p.active && p.stock <= p.minimum).length}</strong></div></section>`
  }</div></div>`;
}
function profile() {
  const u = state.user;
  return `${title('Mi perfil', 'Mantén tus datos actualizados.')}<div class="profile-grid"><section class="card"><form class="form-stack" data-form="profile">${field('Nombre completo', 'name', u.name, 'text', 'required maxlength="100"')}${field('Correo electrónico', 'email', u.email, 'email', 'required')}${field('Teléfono', 'phone', u.phone, 'tel', 'required')}<h3 class="spaced">Cambiar contraseña</h3><p class="inline-note">Deja estos campos vacíos si quieres conservar tu contraseña.</p>${field('Contraseña actual', 'current_password', '', 'password', 'autocomplete="current-password"')}${field('Nueva contraseña', 'new_password', '', 'password', 'minlength="8" autocomplete="new-password"')}<div class="form-error"></div><button class="btn">Guardar cambios</button></form></section><section class="card profile-card"><button type="button" class="profile-photo-picker" data-action="choose-photo" aria-label="Elegir foto de perfil">${avatar(u.name, u.profile_photo)}<span>Cambiar foto</span></button><h2>${esc(u.name)}</h2><p>${roleLabel()}</p>${badge('Activo')}<p>Tu cuenta reúne tus datos y las funciones de tu rol.</p><p class="inline-note">Usuario: ${esc(u.username)}</p><form data-form="profile-photo" class="form-stack spaced"><input type="file" name="photo" aria-label="Seleccionar foto de perfil" accept="image/jpeg,image/png,image/webp" hidden><p class="inline-note">JPG, PNG o WebP, hasta 10 MB. La foto se recorta al centro en formato cuadrado.</p><div class="form-error"></div><p class="photo-save-status" role="status">La foto se guarda automáticamente al seleccionarla.</p>${u.profile_photo ? button('Quitar foto', 'remove-photo', '', 'outline') : ''}</form></section></div>`;
}
function settings() {
  const s = state.settings;
  return `${title('Ajustes del salón', 'Información general y reglas para las reservas.')}<section class="card" style="max-width:900px"><form data-form="settings" class="form-stack"><div class="grid2">${field('Nombre del salón', 'name', s.name, 'text', 'required')}${field('Teléfono', 'phone', s.phone, 'tel', 'required')}${field('Correo', 'email', s.email, 'email', 'required')}${field('Dirección', 'address', s.address, 'text', 'required')}</div><h2 class="spaced">Redes sociales</h2><div class="grid2">${field('Enlace de Instagram', 'instagram_url', s.instagram_url || '', 'url', 'placeholder="https://www.instagram.com/tu_usuario/"')}${field('Enlace de Facebook', 'facebook_url', s.facebook_url || '', 'url', 'placeholder="https://www.facebook.com/tu_perfil"')}</div><h2 class="spaced">Configuración de citas</h2><div class="grid2">${field('Hora de apertura', 'opens', s.opens, 'time', 'required')}${field('Hora de cierre', 'closes', s.closes, 'time', 'required')}${field('Anticipación mínima para reservar (minutos)', 'lead_minutes', s.lead_minutes ?? s.lead_hours * 60, 'number', 'min="0" max="10080" required')}${field('Límite para modificar o cancelar (horas antes)', 'cancellation_hours', s.cancellation_hours, 'number', 'min="0" max="168" required')}</div><p class="inline-note">La cliente elige su manicurista. Los horarios respetan la duración del servicio y los bloqueos de disponibilidad. Zona horaria: Colombia.</p><div class="form-error"></div><button class="btn">Guardar cambios</button></form></section>`;
}
let availabilityDate = today();
let availabilityMonth = today().slice(0, 7);
// Calendario de disponibilidad: consulta de citas y bloqueos de horario.
function availabilityPage() {
  const [year, month] = availabilityMonth.split('-').map(Number);
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const calendarHtml =
    '<div class="calendar-header">' +
    button('‹', 'availability-month', 'data-delta="-1" aria-label="Mes anterior"', 'outline') +
    '<strong>' +
    new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) +
    '</strong>' +
    button('›', 'availability-month', 'data-delta="1" aria-label="Mes siguiente"', 'outline') +
    '</div><div class="calendar-grid">' +
    ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      .map((d) => '<small>' + d + '</small>')
      .join('') +
    '<span></span>'.repeat(offset) +
    Array.from({ length: days }, (_, i) => {
      const date = availabilityMonth + '-' + String(i + 1).padStart(2, '0');
      return (
        '<button class="calendar-day ' +
        (date === availabilityDate ? 'selected' : '') +
        '" data-action="availability-date" data-date="' +
        date +
        '" aria-label="' +
        dateLabel(date) +
        '">' +
        (i + 1) +
        '</button>'
      );
    }).join('') +
    '</div>';
  const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const time = (m) =>
    String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  let slots = '';
  for (let m = mins(state.settings.opens); m < mins(state.settings.closes); m += 30) {
    const end = Math.min(m + 30, mins(state.settings.closes));
    if (overlapsLunch(m, end - m)) continue;
    const block = state.blocks.find(
      (b) => b.date === availabilityDate && mins(b.start_time) < end && mins(b.end_time) > m,
    );
    const appointment = state.appointments.find(
      (a) =>
        a.date === availabilityDate &&
        !['Cancelada', 'Rechazada', 'No asistió'].includes(a.status) &&
        mins(a.time) < end &&
        mins(a.time) + Number(a.duration) > m,
    );
    const past = new Date(availabilityDate + 'T' + time(m) + ':00-05:00').getTime() <= Date.now();
    slots += button(
      timeLabel(time(m)) + '–' + timeLabel(time(end)) + ' · ' + (appointment ? 'Ocupado' : block ? 'Bloqueado' : 'Libre'),
      appointment ? 'detail' : block ? 'delete-block' : 'block',
      appointment
        ? 'data-id="' + appointment.id + '"'
        : block
          ? 'data-id="' + block.id + '"'
          : 'data-start="' + time(m) + '" data-end="' + time(end) + '" ' + (past ? 'disabled' : ''),
      'outline availability-slot',
    );
  }
  const planner =
    '<section class="card spaced availability-planner">' +
    calendarHtml +
    '<h2 class="spaced">' +
    dateLabel(availabilityDate, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }) +
    '</h2><p class="inline-note spaced">Elige una hora libre para bloquearla. Pulsa un bloqueo para volver a habilitar todo su intervalo; las citas ocupadas muestran su detalle.</p><div class="availability-slots spaced">' +
    slots +
    '</div></section>';

  return `${title('Mi disponibilidad', 'Bloquea los horarios en los que no puedes atender.', button('＋ Bloquear horario', 'block'))}${planner}<section class="card">${table(
    ['Fecha', 'Desde', 'Hasta', 'Motivo', 'Acciones'],
    state.blocks.map((b) => [
      dateLabel(b.date),
      b.start_time,
      b.end_time,
      esc(b.reason),
      button('Eliminar', 'delete-block', `data-id="${b.id}"`, 'outline small'),
    ]),
  )}<p class="inline-note spaced">Horario del salón: ${state.settings.opens}–${state.settings.closes}. Fuera de ese horario no se permiten reservas.</p></section>`;
}
function calendar() {
  const [y, m] = calendarMonth.split('-').map(Number);
  const start = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  return `<div class="calendar-header">${button('‹', 'calendar-month', 'data-delta="-1" aria-label="Mes anterior"', 'outline small')}<strong>${new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</strong>${button('›', 'calendar-month', 'data-delta="1" aria-label="Mes siguiente"', 'outline small')}</div><div class="calendar-grid">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<small>${d}</small>`).join('')}${'<span></span>'.repeat(start)}${Array.from(
    { length: count },
    (_, i) => {
      const d = `${calendarMonth}-${String(i + 1).padStart(2, '0')}`;
      return `<button class="calendar-day ${d === booking.date ? 'selected' : ''} ${d === today() ? 'today' : ''}" data-action="date" data-date="${d}" ${d < today() ? 'disabled' : ''} aria-label="${dateLabel(d)}">${i + 1}</button>`;
    },
  ).join('')}</div>`;
}
function bookingSlots(date) {
  return api(
    `/availability?service=${booking.service_id}&professional=${booking.professional_id}&date=${date}${booking.edit_id ? '&ignore=' + booking.edit_id : ''}`,
  );
}
// Reserva paso a paso: servicio, profesional, fecha, hora y confirmación.
async function bookPage() {
  if (!booking.service_id) {
    booking = {
      service_id: state.services.find((s) => s.active)?.id,
      professional_id: state.professionals[0]?.id,
      date: today(),
      time: '',
      design: 'Clásico',
      color: 'Rosado',
      notes: '',
    };
  }
  const steps = ['Servicio', 'Manicurista', 'Fecha', 'Hora', 'Confirmación'];
  const s = state.services.find((s) => s.id === booking.service_id),
    p = state.professionals.find((p) => p.id === booking.professional_id);
  let body = '';
  if (bookingStep === 0)
    body = `<h2>¿Cómo quieres consentirte?</h2><p class="inline-note" style="margin:9px 0 20px">Selecciona el servicio para tu próxima visita.</p>${
      state.services
        .filter((s) => s.active)
        .map(
          (s) =>
            `<button class="booking-option ${s.id === booking.service_id ? 'selected' : ''}" data-action="select-service" data-id="${s.id}"><img src="${servicePhoto(s.id)}" alt=""><span class="info"><strong>${esc(s.name)}</strong><small>${esc(s.description)} · ${s.duration} min</small></span><b>${money(s.price)}</b></button>`,
        )
        .join('') || empty('No hay servicios disponibles.')
    }`;
  if (bookingStep === 1)
    body = `<h2>Elige a tu manicurista</h2><p class="inline-note" style="margin:9px 0 20px">Puedes reservar aunque la manicurista esté desconectada. Los horarios dependen de su agenda.</p>${state.professionals.map((p) => `<button class="booking-option ${p.id === booking.professional_id ? 'selected' : ''}" data-action="select-professional" data-id="${p.id}">${avatar(p.name, p.profile_photo)}<span class="info"><strong>${esc(p.name)}</strong><small>${esc(p.specialty)}</small><small data-professional-presence="${p.id}">${p.online ? '● Activa' : '○ Desconectada'}</small></span>${icon(p.id === booking.professional_id ? 'check' : 'chevron')}</button>`).join('') || empty('No hay manicuristas activas para reservar.')}`;
  if (bookingStep === 2)
    body = `<h2>Un día para ti</h2><p class="inline-note" style="margin-top:9px">${esc(p?.name)} · ${esc(s?.name)}</p>${calendar()}`;
  if (bookingStep === 3) {
    const slots = await bookingSlots(booking.date);
    const { closes } = state.settings;
    const leadMinutes = state.settings.lead_minutes ?? state.settings.lead_hours * 60;
    const closeAt = Date.parse(booking.date + 'T' + closes + ':00-05:00');
    const tooLate = Date.now() + (leadMinutes + Number(s.duration)) * 60000 > closeAt;
    const advance = leadMinutes === 1 ? '1 minuto' : leadMinutes + ' minutos';
    const noSlots = tooLate && booking.date === today()
      ? 'Hoy cerramos a las ' + timeLabel(closes) + '. Este servicio dura ' + s.duration + ' minutos.' +
        (leadMinutes > 0 ? ' Las reservas requieren ' + advance + ' de anticipación.' : '') +
        ' Elige otra fecha.'
      : 'No hay horarios disponibles para este servicio con la manicurista elegida. Prueba con otra fecha.';
    body = `<h2>Selecciona la hora</h2><p class="inline-note" style="margin-top:9px">${dateLabel(booking.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${esc(p?.name)} · Hora de Colombia · ${s?.duration} minutos</p><p class="inline-note">Almuerzo: 11:30 a. m. a 12:30 p. m. No se permiten citas que crucen este horario.</p><div class="time-grid">${slots.map((t) => `<button class="time-button ${booking.time === t ? 'selected' : ''}" data-action="time" data-time="${t}">${timeRange(t, s?.duration)}</button>`).join('')}</div>${!slots.length ? empty(noSlots) + button('Ver próximos horarios disponibles', 'next-available') : ''}`;
  }
  if (bookingStep === 4)
    body = `<h2>${booking.edit_id ? 'Revisa los cambios' : 'Ya casi está. Revisa tu cita.'}</h2><div class="summary-line spaced"><span>Servicio</span><strong>${esc(s?.name)}</strong></div><div class="summary-line"><span>Manicurista</span><strong>${esc(p?.name)}</strong></div><div class="summary-line"><span>Fecha y hora</span><strong>${dateLabel(booking.date)} · ${timeRange(booking.time, s?.duration)}</strong></div><div class="summary-line"><span>Duración</span><strong>${s?.duration} minutos</strong></div><div class="summary-line"><span>Total</span><strong class="pink">${money(s?.price)}</strong></div><form data-form="booking" class="form-stack spaced">${!booking.edit_id && state.settings.whatsapp_enabled ? '<label class="check"><input type="checkbox" name="whatsapp_opt_in"><span>Quiero recibir recordatorios por WhatsApp 2 horas y 30 minutos antes de esta cita en ' + (state.user ? esc(state.user.phone) : 'el teléfono de la reserva') + '.</span></label>' : ''}${!booking.edit_id ? paymentFields({ payment_method: booking.method }) : ''}${!state.user ? `<h3>Tus datos de contacto</h3>${field('Nombre completo', 'name', booking.name || '', 'text', 'required maxlength="100"')}${field('Teléfono', 'phone', booking.phone || '', 'tel', 'required')}` : ''}${!booking.edit_id ? `<div class="grid2">${select('Diseño', 'design', ['Clásico', 'Francés', 'Flores', 'Minimalista', 'A definir en el salón'], booking.design)}${select('Color', 'color', ['Rosado', 'Nude', 'Rojo', 'Blanco', 'Lavanda', 'A definir en el salón'], booking.color)}</div><label>Observaciones<textarea name="notes" maxlength="1000" placeholder="Cuéntanos tus preferencias…">${esc(booking.notes)}</textarea></label>` : ''}<p class="inline-note">La cita quedará pendiente de confirmación por ${esc(p?.name)}. Puedes modificar o cancelar hasta ${state.settings.cancellation_hours} horas antes. Los diseños adicionales se acuerdan en el salón.</p>${!state.user ? '<label class="check"><input type="checkbox" name="terms" required><span>Acepto el tratamiento de mis datos para gestionar la reserva. <a href="#privacy" class="pink">Ver condiciones</a></span></label>' : ''}<div class="form-error"></div><button class="btn full">${booking.edit_id ? 'Confirmar cambios' : 'Confirmar mi cita'}</button></form>`;
  const nextDisabled =
    (bookingStep === 0 && !s) ||
    (bookingStep === 1 && !p) ||
    (bookingStep === 2 && !booking.date) ||
    (bookingStep === 3 && !booking.time);
  return `<div class="booking">${title(booking.edit_id ? 'Modificar cita' : 'Reserva tu momento', 'Cinco pasos sencillos. Un momento especial para ti.', '<a class="text-link" href="#' + (state.user ? 'dashboard' : 'home') + '">Volver al inicio</a>')}<section class="card"><div class="stepper">${steps.map((t, i) => `<div class="step ${i === bookingStep ? 'current' : i < bookingStep ? 'done' : ''}"><span>${i < bookingStep ? '✓' : i + 1}</span>${t}</div>`).join('')}</div>${body}<div class="booking-footer">${bookingStep > (booking.edit_id ? 2 : 0) ? button('← Atrás', 'book-back', '', 'outline') : '<span></span>'}${bookingStep < 4 ? button('Siguiente →', 'book-next', nextDisabled ? 'disabled' : '') : ''}</div></section></div>`;
}
async function render() {
  const serial = ++renderSerial;
  let r = route();
  if (state.user && ['home', 'login', 'register'].includes(r)) {
    location.hash = 'dashboard';
    return;
  }
  if (
    !state.user &&
    !['home', 'login', 'register', 'services', 'book', 'about', 'contact', 'privacy'].includes(r)
  ) {
    location.hash = 'login';
    return;
  }
  try {
    let body = '';
    if (r === 'book') {
      if (state.user && state.user.role !== 'cliente' && !booking.edit_id) {
        toast('Las reservas se realizan desde una cuenta de cliente.');
        navigate('appointments');
        return;
      }
      body = await bookPage();
    } else if (r === 'home') body = home();
    else if (r === 'login' || r === 'register') body = auth(r === 'register');
    else if (r === 'services') body = services();
    else if (r === 'dashboard') body = dashboard();
    else if (r === 'appointments' || r === 'history') body = appointments(r === 'history');
    else if (['clients', 'professionals', 'users'].includes(r)) body = peoplePage(r);
    else if (r === 'agenda') body = agenda();
    else if (r === 'inventory') body = inventory();
    else if (r === 'supplies') body = suppliesPage();
    else if (r === 'payments') body = payments();
    else if (r === 'reports') body = reports();
    else if (r === 'profile') body = profile();
    else if (r === 'settings') body = settings();
    else if (r === 'availability') body = availabilityPage();
    else if (r === 'about')
      body = `<section class="public-section">${title('Un espacio para ti', 'SALONEY · Salón de uñas y belleza')}<div class="grid2"><div class="card stack"><h2>El cuidado está en los detalles</h2><p>En SALONEY puedes encontrar servicios de manicure, pedicure, uñas en gel y diseños. Elige tu servicio y la profesional que prefieras para tu próxima visita.</p><p>Consulta la duración y el precio antes de reservar. Tu manicurista revisará la cita y podrás seguir su estado desde tu cuenta.</p>${button('Reservar mi cita', 'book')}</div><img src="/assets/unas-flores-doradas.png" alt="Manicure rosado" style="width:100%;border-radius:12px"></div></section>`;
    else if (r === 'contact')
      body = `<section class="public-section">${title('Hablemos', 'Estamos para ayudarte con tu próxima visita.')}<div class="card stack" style="max-width:650px"><h2>${esc(state.settings.name)}</h2><p>${esc(state.settings.address)}</p><p>Teléfono: <a class="pink" href="tel:${esc(state.settings.phone.replace(/[^+\d]/g, ''))}">${esc(state.settings.phone)}</a></p><p>Correo: <a class="pink" href="mailto:${esc(state.settings.email)}">${esc(state.settings.email)}</a></p><p>Horario de reservas: ${state.settings.opens} a ${state.settings.closes}</p>${socialLinks(state.settings)}${button('Reservar una cita', 'book')}</div></section>`;
    else if (r === 'privacy')
      body = `<section class="public-section"><div class="card stack" style="max-width:850px;margin:auto"><h1>Condiciones y privacidad</h1><p>SALONEY utiliza tu nombre, teléfono y correo para gestionar tu cuenta, tus reservas y el historial de servicios. Las profesionales acceden únicamente a los datos necesarios de sus clientes asignadas y la administración gestiona el servicio.</p><p>La reserva queda pendiente hasta la confirmación de la manicurista elegida. Se puede modificar o cancelar hasta ${state.settings.cancellation_hours} horas antes de la atención. Los precios están expresados en pesos colombianos.</p><p>No ingreses información sensible en las observaciones. Para solicitar una corrección o la eliminación de datos, comunícate con ${esc(state.settings.email)}.</p><a class="btn outline" href="#${state.user ? 'dashboard' : 'home'}">Volver</a></div></section>`;
    else body = empty('Página no encontrada.');
    if (serial !== renderSerial) return;
    app.innerHTML = state.user
      ? shell(body)
      : publicShell(
          ['services', 'book'].includes(r) ? `<main class="public-section">${body}</main>` : body,
        );
    document.title = `${{ home: 'Inicio', login: 'Iniciar sesión', register: 'Registro', dashboard: 'Mi panel', book: 'Reservar cita', appointments: 'Citas', services: 'Servicios' }[r] || 'Mi espacio'} · SALONEY`;
  } catch (e) {
    if (serial === renderSerial)
      app.innerHTML = (state.user ? shell : publicShell)(
        `<section class="card"><h2>No pudimos cargar esta página</h2><p class="spaced">${esc(e.message)}</p>${button('Reintentar', 'reload', '', 'outline spaced')}</section>`,
      );
  }
}

// Detalle de una cita y acciones permitidas para cada rol.
function detail(id) {
  const a = state.appointments.find((a) => a.id === id);
  if (!a) return;
  const client = state.user.role === 'cliente';
  const canClient =
    ['Pendiente', 'Confirmada'].includes(a.status) &&
    withinChangeWindow(a, state.settings.cancellation_hours);
  let actions = '';
  if (client) {
    if (
      ['Pendiente', 'Confirmada', 'En proceso'].includes(a.status) &&
      a.payment_status !== 'Pagado'
    )
      actions += button('Elegir método de pago', 'client-payment', `data-id="${id}"`, 'outline');
    if (canClient)
      actions +=
        button('Modificar', 'reschedule', `data-id="${id}"`, 'outline') +
        button('Cancelar cita', 'status', `data-id="${id}" data-status="Cancelada"`, 'danger');
  } else {
    if (!['Cancelada', 'Rechazada', 'No asistió'].includes(a.status))
      actions += button('Cambiar método de pago', 'client-payment', `data-id="${id}"`, 'outline');
    const next =
      {
        Pendiente: ['Confirmada', 'Rechazada'],
        Confirmada: ['En proceso', 'Finalizada'],
        'En proceso': ['Finalizada'],
      }[a.status] || [];
    if (
      ['Pendiente', 'Confirmada'].includes(a.status) &&
      new Date(a.date + 'T' + a.time + ':00-05:00').getTime() <= Date.now()
    )
      next.push('No asistió');
    actions += next
      .map((s) =>
        button(
          {
            Confirmada: 'Confirmar',
            Rechazada: 'Rechazar',
            'En proceso': 'Iniciar atención',
            Finalizada: 'Finalizar atención',
            'No asistió': 'No asistió',
          }[s],
          'status',
          `data-id="${id}" data-status="${s}"`,
          s === 'Rechazada' ? 'outline' : '',
        ),
      )
      .join('');
    if (state.user.role === 'admin' && canClient)
      actions += button('Reprogramar', 'reschedule', `data-id="${id}"`, 'outline');
    if (state.user.role === 'admin' && ['Pendiente', 'Confirmada', 'En proceso'].includes(a.status))
      actions += button('Cancelar', 'status', `data-id="${id}" data-status="Cancelada"`, 'danger');
  }
  if (
    !client &&
    a.payment_status !== 'Pagado' &&
    !['Cancelada', 'Rechazada', 'No asistió'].includes(a.status)
  )
    actions += button('Confirmar pago recibido', 'confirm-payment', `data-id="${id}"`);
  if (a.payment_status === 'Pagado')
    actions += button('Descargar factura PDF', 'invoice-pdf', `data-id="${id}"`, 'outline');
  if (client && a.payment_method === 'Transferencia' && a.payment_status !== 'Pagado')
    actions += receiptLink(a);
  openModal(
    'Detalle de la cita #' + id,
    `${badge(a.status)}${[
      ['Cliente', a.client_name],
      ['Teléfono', a.client_phone],
      ['Servicio', a.service_name],
      ['Manicurista', a.professional_name],
      ['Fecha', dateLabel(a.date)],
      ['Horario (Colombia)', timeRange(a.time, a.duration) + ' · ' + a.duration + ' min'],
      ['Diseño / color', a.design + ' · ' + a.color],
      ['Valor', money(a.price)],
      [
        'Estado del pago',
        a.payment_status === 'Pagado' ? 'Pago confirmado' : 'Pendiente de pago / verificación',
      ],
      ['Confirmado por', a.confirmed_by_name || 'Sin confirmar'],
      [
        'Método elegido',
        a.payment_method || 'Sin elegir',
      ],
    ]
      .map(
        ([l, v]) => `<div class="summary-line"><span>${l}</span><strong>${esc(v)}</strong></div>`,
      )
      .join(
        '',
      )}${a.notes ? `<p class="detail-note"><strong>Observaciones:</strong> ${esc(a.notes)}</p>` : ''}${a.reason ? `<p class="detail-note"><strong>Motivo:</strong> ${esc(a.reason)}</p>` : ''}${client && !canClient && ['Pendiente', 'Confirmada'].includes(a.status) ? `<p class="notice">El plazo para modificar o cancelar es de ${state.settings.cancellation_hours} horas antes de la cita.</p>` : ''}<div class="modal-actions" style="flex-wrap:wrap">${actions}</div>`,
  );
}
function editService(id) {
  const s = state.services.find((s) => s.id === id) || { active: 1, duration: 60, price: 30000 };
  openModal(
    id ? 'Editar servicio' : 'Nuevo servicio',
    `<form class="form-stack" data-form="service" data-id="${id || ''}">${field('Nombre', 'name', s.name, 'text', 'required maxlength="100"')}<label>Descripción<textarea name="description" required maxlength="500">${esc(s.description)}</textarea></label><div class="grid2">${field('Precio (COP)', 'price', s.price, 'number', 'required min="1" max="100000000"')}${field('Duración (minutos)', 'duration', s.duration, 'number', 'required min="15" max="480"')}</div>${select(
      'Estado',
      'active',
      [
        [1, 'Activo'],
        [0, 'Inactivo'],
      ],
      s.active,
    )}<div class="form-error"></div><button class="btn">Guardar servicio</button></form>`,
  );
}
function editUser(id, kind) {
  const u = state.users.find((u) => u.id === id) || {
    role: kind === 'professionals' ? 'manicurista' : 'cliente',
    active: 1,
  };
  openModal(
    id ? 'Editar usuario' : 'Crear usuario',
    `<form class="form-stack" data-form="user" data-id="${id || ''}">${field('Nombre completo', 'name', u.name, 'text', 'required maxlength="100"')}${field('Usuario', 'username', u.username || '', 'text', 'required minlength="3" maxlength="80"')}${field('Correo', 'email', u.email, 'email', 'required')}${field('Teléfono', 'phone', u.phone, 'tel', 'required')}${select(
      'Rol',
      'role',
      [
        ['cliente', 'Cliente'],
        ['manicurista', 'Manicurista'],
        ['admin', 'Administrador'],
      ],
      u.role,
    )}${field('Especialidad (manicuristas)', 'specialty', u.specialty, 'text', 'maxlength="200"')}${
      id
        ? select(
            'Estado',
            'active',
            [
              [1, 'Activo'],
              [0, 'Inactivo'],
            ],
            u.active,
          )
        : ''
    }${field(id ? 'Nueva contraseña (opcional)' : 'Contraseña', 'password', '', 'password', `${id ? '' : 'required'} minlength="8" maxlength="128" autocomplete="new-password"`)}<button type="button" class="text-link" data-action="show-password">Mostrar / ocultar nueva contraseña</button><p class="inline-note">Las contraseñas existentes no se pueden consultar. Escribe una nueva para restablecer el acceso.</p><div class="form-error"></div><button class="btn">Guardar usuario</button></form>`,
  );
}
function paymentModal(id) {
  const p = state.payments.find((p) => p.appointment_id === id) || {};
  const apps = state.appointments.filter(
    (a) => !['Cancelada', 'Rechazada', 'No asistió'].includes(a.status),
  );
  openModal(
    'Registrar pago',
    `<form data-form="payment" class="form-stack">${select(
      'Cita',
      'appointment_id',
      apps.map((a) => [
        a.id,
        `#${a.id} · ${a.client_name} · ${a.service_name} · ${money(a.price)}`,
      ]),
      id || apps[0]?.id,
      'required',
    )}${select('Método de pago', 'method', ['Efectivo', 'Transferencia'], ['Nequi', 'Bancolombia'].includes(p.method) ? 'Transferencia' : p.method)}${select('Estado', 'status', ['Pagado', 'Pendiente'], p.status)}${field('Fecha', 'date', p.date || today(), 'date', `required max="${today()}"`)}<p class="inline-note">El valor corresponde al precio guardado en la cita. Si ya tiene un pago, se actualizará ese registro.</p><div class="form-error"></div><button class="btn" ${apps.length ? '' : 'disabled'}>Guardar pago</button></form>`,
  );
}
function productModal(id) {
  const p = state.products.find((p) => p.id === id) || { minimum: 5, active: 1 };
  const categories = [...new Set(['Limas y pulido', 'Esmaltes', 'Geles', 'Acrílico', 'Extensiones', 'Preparación', 'Cuidado', 'Removedores', 'Decoración', 'Consumibles', 'Higiene', ...state.products.map(item => item.category).filter(Boolean)])];
  const units = [...new Set(['unidad', 'frasco', 'caja', 'tubo', 'rollo', 'tarro', 'bolsa', 'paquete', p.unit || 'unidad'])];
  openModal(
    id ? 'Editar producto' : 'Nuevo producto',
    `<form data-form="product" data-id="${id || ''}" class="form-stack">${field('Nombre', 'name', p.name, 'text', 'required maxlength="100"')}${select('Categoría', 'category', [['', 'Selecciona una categoría'], ...categories], p.category || '', 'required')}${field('Cantidad disponible', id ? 'stock' : 'initial_stock', id ? p.stock : '', 'number', 'required min="0" step="1"')}${select('Unidad de medida', 'unit', units, p.unit || 'unidad', 'required')}${field('Unidades por caja', 'box_size', p.box_size || '', 'number', 'min="1" max="10000" step="1"')}${id ? '<input type="hidden" name="box_size_before" value="' + Number(p.box_size || 0) + '"><input type="hidden" name="stock_before" value="' + esc(p.stock) + '">' : ''}${field('Costo de compra por unidad (COP)', 'unit_cost', p.unit_cost || 0, 'number', 'required min="0" max="100000000" step="0.01"')}${field('Stock mínimo', 'minimum', p.minimum, 'number', 'required min="0" max="1000000000"')}${
      id
        ? select(
            'Estado',
            'active',
            [
              [1, 'Activo'],
              [0, 'Inactivo'],
            ],
            p.active,
          )
        : ''
    }<div class="form-error"></div><button class="btn">Guardar producto</button></form>`,
  );
  const form = modal.querySelector('form');
  const { unit, box_size: size, unit_cost: cost, minimum } = form.elements;
  const stock = form.elements.namedItem(id ? 'stock' : 'initial_stock');
  const updateLabels = () => {
    const box = unit.value === 'caja';
    size.closest('label').style.display = box ? '' : 'none';
    size.disabled = !box;
    size.required = box;
    size.readOnly = Boolean(p.box_size);
    const countBoxes = box && !p.box_size;
    stock.parentElement.firstChild.textContent = countBoxes ? 'Cantidad de cajas disponibles' : box ? 'Cantidad de unidades disponibles' : 'Cantidad disponible';
    cost.parentElement.firstChild.textContent = countBoxes ? 'Costo de compra por caja (COP)' : 'Costo de compra por unidad (COP)';
    minimum.parentElement.firstChild.textContent = countBoxes ? 'Stock mínimo en cajas' : box ? 'Stock mínimo en unidades' : 'Stock mínimo';
  };
  if (p.box_size) unit.disabled = true;
  unit.addEventListener('change', updateLabels);
  updateLabels();
}
async function handleAction(el) {
  const action = el.dataset.action,
    id = Number(el.dataset.id);
  if (action === 'take-supply') {
    const products = state.products.filter(p => p.active && p.stock > 0 && (p.unit !== 'caja' || p.box_size));
    if (!products.length) { toast('No hay productos disponibles. Pide al administrador revisar las existencias y las unidades por caja.'); return; }
    const byCategory = new Map();
    for (const product of products) {
      const category = product.category?.trim() || 'Sin categoría';
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(product);
    }
    const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b, 'es'));
    const groups = categories.map(category => {
      const fields = byCategory.get(category).map(p =>
        field(esc(p.name) + ' · ' + p.stock + ' disponibles (' + (p.box_size ? 'unidades · caja de ' + Number(p.box_size) : esc(p.unit || 'unidad')) + ')',
          'supply_' + p.id, 0, 'number', 'min="0" max="' + p.stock + '" step="1"')
      ).join('');
      return `<div data-supply-group="${esc(category)}" hidden><div class="form-stack">${fields}</div></div>`;
    }).join('');
    openModal('Solicitar productos', `<form data-form="take-supply" class="form-stack">${state.user.role === 'admin' ? select('Manicurista', 'professional_id', state.professionals.map(p => [p.id, p.name])) : ''}${select('Categoría', 'category', [['', 'Selecciona una categoría'], ...categories], '', 'required')}${groups}<p class="inline-note">Puedes agregar productos de varias categorías antes de confirmar.${state.products.some(p => p.active && p.stock > 0 && p.unit === 'caja' && !p.box_size) ? ' Para solicitar artículos de una caja, registra primero las unidades por caja en Inventario.' : ''} Al confirmar se descontarán del almacén.</p><div class="form-error"></div><button class="btn">Confirmar solicitud y descontar</button></form>`);
    const picker = modal.querySelector('[name="category"]');
    picker.addEventListener('change', () => {
      const visible = picker.form.querySelector('[data-supply-group]:not([hidden])');
      const invalid = visible?.querySelector('input:invalid');
      if (invalid) {
        picker.value = visible.dataset.supplyGroup;
        invalid.reportValidity();
        return;
      }
      for (const group of picker.form.querySelectorAll('[data-supply-group]')) {
        group.hidden = group.dataset.supplyGroup !== picker.value;
      }
    });
    return;
  }
  if (action === 'finish-supply') {
    const supply = state.supplies.find(s => s.id === id);
    openModal('Confirmar que el producto se acabó', `<form data-form="finish-supply" data-id="${id}" class="form-stack"><p>Marcarás como agotados ${supply.quantity} ${esc(supply.unit)} de ${esc(supply.product_name)}. Ya se descontaron al solicitarlos; no se descontarán otra vez.</p><p class="inline-note">Confirma solamente si se terminó todo el producto indicado.</p><div class="form-error"></div><button class="btn">Sí, se acabó</button></form>`);
    return;
  }
  if (action === 'show-password') {
    const input = modal.querySelector('[name=password]');
    input.type = input.type === 'password' ? 'text' : 'password';
    return;
  }
  if (action === 'theme') {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (state.user) {
      await api('/theme', 'PATCH', { theme });
      state.user.theme = theme;
    }
    applyTheme(theme);
    return;
  }
  if (action === 'confirm-payment') {
    const appointment = state.appointments.find((a) => a.id === id);
    openModal(
      'Confirmar pago recibido · Cita #' + id,
      '<form data-form="confirm-payment" data-id="' +
        id +
        '" class="form-stack"><p>Cliente: ' +
        esc(appointment.client_name) +
        ' · Total: ' +
        money(appointment.price) +
        '</p>' +
        paymentFields(appointment, true) +
        '<label class="check"><input type="checkbox" name="received" required><span>Confirmo que recibí el efectivo o verifiqué en la cuenta bancaria el abono, su valor y la referencia del comprobante correspondiente a esta cita.</span></label><div class="form-error"></div><button class="btn">Confirmar pago recibido</button></form>',
    );
    return;
  }
  if (action === 'client-payment') {
    openModal(
      'Elige cómo pagar',
      paymentChoice(
        state.appointments.find((a) => a.id === id),
        state.user.role !== 'cliente',
      ),
    );
    return;
  }
  if (action === 'delete-user') {
    openModal(
      'Eliminar cuenta',
      '<form data-form="delete-user" data-id="' +
        id +
        '" class="form-stack"><p>La persona perderá el acceso y se retirará de las listas. Su historial de citas y pagos se conservará. Esta acción no se puede deshacer desde el panel.</p><div class="form-error"></div><button class="btn danger">Confirmar eliminación</button></form>',
    );
    return;
  }
  if (action === 'close-modal') {
    modal.close();
    return;
  }
  if (action === 'menu') {
    $('#sidebar').classList.toggle('open');
    return;
  }
  if (action === 'reload') {
    await init();
    return;
  }
  if (action === 'choose-photo') {
    document.querySelector('input[name="photo"]').click();
    return;
  }
  if (action === 'remove-photo') {
    const result = await api('/profile/photo', 'PUT', { photo: null });
    state.user = result.user;
    await render();
    toast('Foto eliminada.');
    return;
  }
  if (action === 'logout') {
    await api('/logout', 'POST', {});
    announceSessionChange();
    state.user = null;
    applyTheme('light');
    state.appointments = [];
    state.payments = [];
    state.users = [];
    state.clients = [];
    state.blocks = [];
    state.products = [];
    state.supplies = [];
    state.movements = [];
    booking = {};
    modal.close();
    navigate('home');
    return;
  }
  if (action === 'book') {
    resetBooking(id);
    return;
  }
  if (action === 'detail') {
    detail(id);
    return;
  }
  if (action === 'edit-service') {
    editService(id);
    return;
  }
  if (action === 'edit-user') {
    editUser(id, el.dataset.kind);
    return;
  }
  if (action === 'edit-product') {
    productModal(id);
    return;
  }
  if (action === 'payment') {
    paymentModal(id);
    return;
  }
  if (action === 'tab') {
    filterTab = el.dataset.tab;
    render();
    return;
  }
  if (action === 'week') {
    weekOffset = Number(el.dataset.delta) === 0 ? 0 : weekOffset + Number(el.dataset.delta);
    render();
    return;
  }
  if (action === 'select-service') {
    booking.service_id = id;
    booking.time = '';
    render();
    return;
  }
  if (action === 'select-professional') {
    booking.professional_id = id;
    booking.time = '';
    render();
    return;
  }
  if (action === 'date') {
    booking.date = el.dataset.date;
    booking.time = '';
    render();
    return;
  }
  if (action === 'time') {
    booking.time = el.dataset.time;
    render();
    return;
  }
  if (action === 'calendar-month') {
    const d = new Date(calendarMonth + '-01T12:00:00');
    d.setMonth(d.getMonth() + Number(el.dataset.delta));
    calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    render();
    return;
  }
  if (action === 'next-available') {
    el.disabled = true;
    const label = el.textContent;
    el.textContent = 'Buscando horarios…';
    const serial = renderSerial;
    const day = new Date(booking.date + 'T12:00:00Z');
    try {
      for (let i = 0; i < 30; i++) {
        day.setUTCDate(day.getUTCDate() + 1);
        const date = day.toISOString().slice(0, 10);
        const slots = await bookingSlots(date);
        if (serial !== renderSerial || !el.isConnected) return;
        if (slots.length) {
          booking.date = date;
          booking.time = '';
          calendarMonth = date.slice(0, 7);
          await render();
          return;
        }
      }
      toast('No hay horarios en los 30 días siguientes. Puedes elegir otra fecha en el calendario.');
    } finally {
      el.disabled = false;
      el.textContent = label;
    }
    return;
  }
  if (action === 'book-next') {
    bookingStep = Math.min(4, bookingStep + 1);
    await render();
    return;
  }
  if (action === 'book-back') {
    bookingStep = Math.max(booking.edit_id ? 2 : 0, bookingStep - 1);
    render();
    return;
  }
  if (action === 'reschedule') {
    const a = state.appointments.find((a) => a.id === id);
    booking = { ...a, edit_id: id };
    calendarMonth = a.date.slice(0, 7);
    bookingStep = 2;
    modal.close();
    navigate('book');
    return;
  }
  if (action === 'status') {
    const next = el.dataset.status;
    openModal(
      next === 'Cancelada'
        ? 'Cancelar cita'
        : next === 'Rechazada'
          ? 'Rechazar cita'
          : 'Actualizar cita',
      `<form data-form="status" data-id="${id}" class="form-stack"><input type="hidden" name="status" value="${next}"><p>La cita #${id} quedará en estado <strong>${next}</strong>.</p>${['Rechazada', 'Cancelada'].includes(next) ? `<label>Motivo${next === 'Cancelada' ? ' (opcional)' : ''}<textarea name="reason" maxlength="500" ${next === 'Rechazada' ? 'required' : ''}></textarea></label>` : ''}<div class="form-error"></div><button class="btn">Confirmar ${next === 'Finalizada' ? 'finalización' : 'cambio'}</button></form>`,
    );
    return;
  }
  if (action === 'delete-service') {
    openModal(
      'Eliminar servicio',
      `<form data-form="delete-service" data-id="${id}" class="form-stack"><p>Si el servicio tiene citas registradas, se desactivará para conservar el historial. En caso contrario, se eliminará.</p><div class="form-error"></div><button class="btn danger">Confirmar eliminación</button></form>`,
    );
    return;
  }
  if (action === 'stock') {
    const p = state.products.find((p) => p.id === id);
    if (p.unit === 'caja' && !p.box_size) {
      productModal(id);
      modal.querySelector('[name="box_size"]').focus();
      return;
    }
    openModal(
      'Movimiento de inventario',
      `<form data-form="stock" class="form-stack"><input type="hidden" name="product_id" value="${id}"><h3>${esc(p.name)} · Stock: ${p.stock}</h3>${select(
        'Tipo',
        'type',
        [
          ['in', 'Entrada'],
          ['out', 'Salida'],
        ],
      )}${field('Cantidad', 'quantity', 1, 'number', 'required min="1" max="100000"')}${field('Costo de compra por unidad (solo entradas)', 'unit_cost', p.unit_cost || 0, 'number', 'required min="0" step="0.01"')}<p class="inline-note">Cantidad en ${p.box_size ? 'unidades. Cada caja contiene ' + Number(p.box_size) + ' unidades' : esc(p.unit || 'unidad')}. Al registrar una compra se actualiza el costo promedio del inventario.</p>${field('Motivo', 'reason', '', 'text', 'required maxlength="200"')}<div class="form-error"></div><button class="btn">Registrar movimiento</button></form>`,
    );
    if (p.box_size) {
      const { type, quantity, unit_cost: cost } = modal.querySelector('form').elements;
      const updateMovement = () => {
        const incoming = type.value === 'in';
        quantity.parentElement.firstChild.textContent = incoming ? 'Cantidad de cajas (' + p.box_size + ' unidades por caja)' : 'Cantidad de unidades';
        cost.parentElement.firstChild.textContent = 'Costo de compra por caja (COP)';
        cost.value = (Number(p.unit_cost) * p.box_size).toFixed(2);
        cost.disabled = !incoming;
        cost.parentElement.style.display = incoming ? '' : 'none';
      };
      type.addEventListener('change', updateMovement);
      updateMovement();
    }
    return;
  }
  if (action === 'movements') {
    openModal(
      'Movimientos de inventario',
      table(
        ['Fecha y hora (Colombia)', 'Producto', 'Movimiento', 'Cantidad', 'Antes → después', 'Costo por unidad', 'Valor', 'Registrado por', 'Manicurista', 'Motivo'],
        state.movements.map((m) => [
          esc(new Date(m.created_at).toLocaleString('es-CO', { timeZone: SALON_TIME_ZONE })),
          esc(m.product_name),
          esc(m.tipo_movimiento || (m.quantity > 0 ? 'Entrada' : 'Salida')),
          m.quantity,
          m.existencias_antes == null ? 'Sin registro histórico' : esc(m.existencias_antes + ' → ' + m.existencias_despues),
          money(m.unit_cost),
          money(Math.abs(m.quantity) * m.unit_cost),
          esc(m.user_name),
          esc(m.manicurista || '—'),
          esc(m.reason),
        ]),
      ),
    );
    return;
  }
  if (action === 'availability-date') {
    availabilityDate = el.dataset.date;
    await refresh();
    await render();
    return;
  }
  if (action === 'availability-month') {
    const [y, m] = availabilityMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + Number(el.dataset.delta), 1);
    availabilityMonth = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    availabilityDate = availabilityMonth + '-01';
    await refresh();
    await render();
    return;
  }
  if (action === 'block') {
    openModal(
      'Bloquear disponibilidad',
      `<form data-form="block" class="form-stack">${field('Fecha', 'date', availabilityDate < today() ? today() : availabilityDate, 'date', `required min="${today()}"`)}<div class="grid2">${field('Desde', 'start_time', el.dataset.start || state.settings.opens, 'time', 'required')}${field('Hasta', 'end_time', el.dataset.end || state.settings.closes, 'time', 'required')}</div>${field('Motivo', 'reason', '', 'text', 'required maxlength="200"')}<div class="form-error"></div><button class="btn">Bloquear horario</button></form>`,
    );
    return;
  }
  if (action === 'delete-block') {
    const block = state.blocks.find((b) => b.id === id);
    if (
      !block ||
      !window.confirm(
        '¿Habilitar el ' +
          dateLabel(block.date) +
          ' de ' +
          block.start_time +
          ' a ' +
          block.end_time +
          '?',
      )
    )
      return;
    await api('/blocks/' + id, 'DELETE', {});
    await refresh();
    render();
    toast('Horario desbloqueado.');
    return;
  }
  if (action === 'client-history') {
    const c = state.clients.find((c) => c.id === id);
    const apps = state.appointments.filter((a) => a.client_id === id);
    const paid = state.payments
      .filter((p) => apps.some((a) => a.id === p.appointment_id) && p.status === 'Pagado')
      .reduce((n, p) => n + p.amount, 0);
    openModal(
      'Historial · ' + c.name,
      `${state.user.role === 'admin' ? `<div class="summary-line"><span>Total pagado</span><strong>${money(paid)}</strong></div>` : ''}${table(
        ['Fecha', 'Servicio', 'Manicurista', 'Estado'],
        apps.map((a) => [
          dateLabel(a.date),
          esc(a.service_name),
          esc(a.professional_name),
          badge(a.status),
        ]),
      )}`,
    );
    return;
  }
  if (action === 'forgot') {
    openModal(
      'Recuperar acceso',
      `<div class="stack"><p>Comunícate con la administración de SALONEY para verificar tu identidad y restablecer tu contraseña.</p><p>Teléfono: <strong>${esc(state.settings.phone)}</strong></p><p>Correo: <strong>${esc(state.settings.email)}</strong></p><a class="btn outline" href="mailto:${esc(state.settings.email)}?subject=${encodeURIComponent('SALONEY: recuperar acceso a mi cuenta')}&amp;body=${encodeURIComponent('Hola, necesito ayuda para restablecer mi contraseña de SALONEY.\n\nNombre completo: \nUsuario o correo registrado: \n')}">Solicitar ayuda por correo</a><p class="inline-note">Se abrirá tu aplicación de correo. Revisa los datos y pulsa Enviar.</p><p class="inline-note">La administración puede asignarte una contraseña temporal. Cámbiala después desde Mi perfil.</p></div>`,
    );
    return;
  }
  if (action === 'reminder-response') {
    if (
      el.dataset.status === 'Cancelada' &&
      !window.confirm('¿Cancelar esta cita y liberar el horario?')
    )
      return;
    await api('/notifications/' + id + '/respond', 'POST', { status: el.dataset.status });
    modal.close();
    await refresh();
    await render();
    toast(
      el.dataset.status === 'Cancelada'
        ? 'Cita cancelada. El horario quedó libre.'
        : 'Asistencia confirmada.',
    );
    return;
  }
  if (action === 'notification-detail') {
    const notification = state.notifications.items.find((n) => n.id === id);
    if (!notification) return;
    state.appointments = await api('/appointments');
    await api('/notifications/' + id + '/read', 'POST', {});
    await refreshNotifications();
    detail(notification.appointment_id);
    const appointment = state.appointments.find((a) => a.id === notification.appointment_id);
    if (
      state.user.role === 'cliente' &&
      notification.message.startsWith('Recordatorio:') &&
      appointment &&
      ['Pendiente', 'Confirmada'].includes(appointment.status) &&
      new Date(appointment.date + 'T' + appointment.time + ':00-05:00').getTime() > Date.now()
    ) {
      modal
        .querySelector('.modal-body')
        .insertAdjacentHTML(
          'afterbegin',
          '<div class="card spaced"><p>Tu cita está próxima. ¿Vas a asistir?</p>' +
            button(
              'Confirmar asistencia',
              'reminder-response',
              'data-id="' + id + '" data-status="Confirmada"',
            ) +
            ' ' +
            button(
              'Cancelar cita',
              'reminder-response',
              'data-id="' + id + '" data-status="Cancelada"',
              'outline',
            ) +
            '</div>',
        );
    }
    return;
  }
  if (action === 'notifications' && state.user.role !== 'admin') {
    await refreshNotifications();
    openModal(
      'Notificaciones',
      state.notifications.items.length
        ? '<div class="stack">' +
            state.notifications.items
              .map(
                (n) =>
                  '<button class="notification-item" data-action="notification-detail" data-id="' +
                  n.id +
                  '"><strong>' +
                  (n.read_at ? '' : '● ') +
                  esc(n.message) +
                  '</strong><small>' +
                  esc(new Date(n.created_at).toLocaleString('es-CO', { timeZone: SALON_TIME_ZONE })) +
                  ' · Ver cita</small></button>',
              )
              .join('') +
            '</div>'
        : empty('Aquí aparecerán tus nuevas citas y los cambios de agenda.'),
    );
    return;
  }
  if (action === 'notifications') {
    const pending = state.appointments.filter((a) => a.date >= today() && a.status === 'Pendiente');
    openModal(
      'Citas por confirmar',
      pending.length
        ? pending.slice(0, 10).map(appointmentCard).join('')
        : empty('No hay citas pendientes de confirmación.'),
    );
    return;
  }
  if (action === 'report-pdf' || action === 'invoice-pdf') {
    el.disabled = true;
    const preview = action === 'invoice-pdf' ? window.open('about:blank', '_blank') : null;
    if (preview) {
      preview.opener = null;
      preview.document.title = 'Factura SALONEY';
      preview.document.body.textContent = 'Preparando factura…';
    }
    try {
      const blob = await api(
        action === 'report-pdf'
          ? '/reports.pdf?from=' + reportFrom + '&to=' + reportTo
          : '/appointments/' + id + '/invoice.pdf',
        'GET',
        undefined,
        true,
      );
      const url = URL.createObjectURL(blob);
      if (preview && !preview.closed) {
        preview.location.replace(url);
        setTimeout(() => URL.revokeObjectURL(url), 300000);
        toast('Factura abierta. Puedes descargarla o imprimirla desde el visor PDF.');
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download =
        action === 'report-pdf'
          ? 'SALONEY-reporte-' + reportFrom + '-' + reportTo + '.pdf'
          : 'SALONEY-factura-cita-' + id + '.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('PDF descargado.');
    } catch (error) {
      if (preview && !preview.closed) preview.close();
      throw error;
    } finally {
      el.disabled = false;
    }
    return;
  }
  if (action === 'export') {
    const { apps, payments } = reportData();
    const rows = [
      ['SALONEY', 'Desde', reportFrom, 'Hasta', reportTo],
      [],
      ['Cita', 'Fecha', 'Hora', 'Cliente', 'Servicio', 'Manicurista', 'Estado', 'Valor'],
      ...apps.map((a) => [
        a.id,
        a.date,
        a.time,
        a.client_name,
        a.service_name,
        a.professional_name,
        a.status,
        a.price,
      ]),
    ];
    if (state.user.role === 'admin')
      rows.push(
        [],
        ['Pagos recibidos'],
        ['Cita', 'Fecha', 'Cliente', 'Método', 'Valor'],
        ...payments.map((p) => [p.appointment_id, p.date, p.client_name, p.method, p.amount]),
      );
    const csv =
      '\ufeff' +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                `"${String(v ?? '')
                  .replace(/^[=+@-]/, "'" + '$&')
                  .replaceAll('"', '""')}"`,
            )
            .join(';'),
        )
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `SALONEY-reporte-${reportFrom}-${reportTo}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Reporte exportado.');
    return;
  }
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled) handleAction(el).catch((err) => toast(err.message));
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form)),
    kind = form.dataset.form,
    id = form.dataset.id;
  const submit = form.querySelector('button[type="submit"],button:not([type])');
  const err = form.querySelector('.form-error');
  if (err) err.textContent = '';
  if (submit) submit.disabled = true;
  try {
    if (kind === 'login' || kind === 'register') {
      if (kind === 'register' && data.password !== data.confirm)
        throw new Error('Las contraseñas no coinciden.');
      const r = await api('/' + kind, 'POST', data);
      state.user = r.user;
      announceSessionChange();
      applyTheme(state.user.theme);
      await refresh();
      navigate(state.user.role === 'manicurista' && !state.supplies.length ? 'supplies' : 'dashboard');
      return;
    }
    if (kind === 'booking') {
      Object.assign(booking, data, { whatsapp_opt_in: data.whatsapp_opt_in === 'on' });
      if (booking.edit_id)
        await api('/appointments/' + booking.edit_id, 'PATCH', {
          date: booking.date,
          time: booking.time,
        });
      else {
        const r = await api('/appointments', 'POST', booking);
        booking.result = r.id;
      }
      if (state.user) await refresh();
      const body = `<div class="booking"><section class="card success"><div class="success-icon">${icon('check')}</div><h1>${booking.edit_id ? 'Tu cita fue actualizada' : '¡Tu cita está reservada!'}</h1><p>Reserva #${booking.edit_id || booking.result}<br>${dateLabel(booking.date)} · ${timeLabel(booking.time)} (hora de Colombia)<br>Tu manicurista revisará la solicitud y confirmará la atención.</p>${badge('Pendiente')}${!booking.edit_id && booking.method === 'Transferencia' ? '<div class="spaced">' + receiptLink({ id: booking.result, client_name: state.user?.name || booking.name, service_name: state.services.find((s) => s.id === booking.service_id)?.name, date: booking.date, time: booking.time, price: state.services.find((s) => s.id === booking.service_id)?.price }) + '</div>' : ''}<div class="spaced"><a class="btn" href="#${state.user ? 'appointments' : 'home'}">${state.user ? 'Ver mis citas' : 'Volver al inicio'}</a></div></section></div>`;
      app.innerHTML = state.user
        ? shell(body)
        : publicShell(`<main class="public-section">${body}</main>`);
      booking = {};
      return;
    }
    if (kind === 'report-period') {
      if (data.from > data.to) throw new Error('La fecha inicial debe ser anterior a la final.');
      reportFrom = data.from;
      reportTo = data.to;
      render();
      return;
    }
    if (kind === 'profile-photo') {
      const photo = await prepareProfilePhoto(form.querySelector('[name="photo"]').files[0]);
      const result = await api('/profile/photo', 'PUT', { photo });
      state.user = result.user;
    }
    if (kind === 'profile') {
      const r = await api('/profile', 'PATCH', data);
      state.user = r.user;
      announceSessionChange();
      applyTheme(state.user.theme);
      await refresh();
      render();
      toast('Tu perfil está actualizado.');
      return;
    }
    if (kind === 'delete-user') await api('/users/' + id, 'DELETE', {});
    if (kind === 'confirm-payment') {
      await api('/appointments/' + id + '/confirm-payment', 'POST', {
        ...data,
        received: data.received === 'on' || data.received === true,
      });
    }
    if (kind === 'payment-choice')
      await api('/appointments/' + id + '/payment-choice', 'PATCH', data);
    if (kind === 'settings') await api('/settings', 'PATCH', data);
    if (kind === 'service')
      await api('/services' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', data);
    if (kind === 'delete-service') await api('/services/' + id, 'DELETE', {});
    if (kind === 'user') await api('/users' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', data);
    if (kind === 'take-supply') {
      const items = Object.entries(data).filter(([key, value]) => key.startsWith('supply_') && Number(value) > 0).map(([key, value]) => ({ product_id: Number(key.slice(7)), quantity: Number(value) }));
      if (!items.length) throw new Error('Elige al menos un producto.');
      await api('/supplies', 'POST', { professional_id: data.professional_id, items });
    }
    if (kind === 'finish-supply') await api('/supplies/' + id + '/finish', 'POST', {});
    if (kind === 'product')
      await api('/products' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', data);
    if (kind === 'payment') await api('/payments', 'POST', data);
    if (kind === 'status') await api('/appointments/' + id, 'PATCH', data);
    if (kind === 'stock')
      await api('/movements', 'POST', {
        ...data,
        by_box: data.type === 'in' && Boolean(state.products.find(p => p.id === Number(data.product_id))?.box_size),
        quantity: Number(data.quantity) * (data.type === 'out' ? -1 : 1),
      });
    if (kind === 'block') await api('/blocks', 'POST', data);
    modal.close();
    await refresh();
    await render();
    toast('Cambios guardados correctamente.');
  } catch (error) {
    if (err) err.textContent = error.message;
    else toast(error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
});
function updateList() {
  const target = $('#list-content');
  if (!target) return;
  const r = route();
  target.innerHTML = ['appointments', 'history'].includes(r)
    ? appointmentList(filteredAppointments(r === 'history'), state.user.role === 'cliente')
    : r === 'services'
      ? servicesTable()
      : ['clients', 'professionals', 'users'].includes(r)
        ? peopleTable(r)
        : r === 'inventory'
          ? inventoryTable()
          : r === 'payments'
            ? paymentsTable()
            : '';
}
document.addEventListener('change', async (e) => {
  if (!e.target.matches('input[name="photo"]')) return;
  const file = e.target.files[0];
  if (!file) return;
  const owner = state.user.id;
  const form = e.target.closest('form');
  const picker = document.querySelector('.profile-photo-picker');
  const status = form.querySelector('.photo-save-status');
  picker.disabled = true;
  status.textContent = 'Guardando tu foto…';
  form.querySelector('.form-error').textContent = '';
  try {
    const photo = await prepareProfilePhoto(file);
    if (state.user?.id !== owner) return;
    const result = await api('/profile/photo', 'PUT', { photo });
    if (state.user?.id !== owner) return;
    state.user = result.user;
    await render();
    toast('Foto guardada. Se conservará cuando vuelvas a entrar.');
  } catch (error) {
    status.textContent = 'La foto no se guardó. Tu foto anterior se conserva.';
    form.querySelector('.form-error').textContent = error.message;
  } finally {
    picker.disabled = false;
    e.target.value = '';
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    search = e.target.value;
    updateList();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'status-filter') {
    statusFilter = e.target.value;
    updateList();
  }
  if (e.target.id === 'date-filter') {
    dateFilter = e.target.value;
    updateList();
  }
});
let navigationVersion = 0;
window.addEventListener('hashchange', async () => {
  const version = ++navigationVersion;
  search = '';
  statusFilter = '';
  dateFilter = '';
  modal.close();
  try {
    await refresh();
    if (version === navigationVersion) await render();
  } catch (e) {
    if (version === navigationVersion) {
      const body = `<section class="card connection-error"><h2>No pudimos actualizar esta sección</h2><p>${esc(e.message)}</p>${button('Reintentar', 'reload', '', 'outline')}</section>`;
      app.innerHTML = state.user ? shell(body) : publicShell(body);
    }
  }
  window.scrollTo(0, 0);
});
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.close();
});
document.addEventListener('input', (e) => {});
document.addEventListener('change', (e) => {
  if (e.target.id === 'client-payment-method') {
    const area = e.target.form.querySelector('#transfer-options');
    if (area) area.hidden = e.target.value !== 'Transferencia';
  }
});
setInterval(async () => {
  if (!state.user || document.hidden) return;
  try {
    await api('/presence', 'POST', {});
    state.professionals = await api('/professionals');
    document.querySelectorAll('[data-professional-presence]').forEach((el) => {
      const professional = state.professionals.find(
        (p) => p.id === Number(el.dataset.professionalPresence),
      );
      el.textContent = professional?.online ? '● Activa' : '○ Desconectada';
    });
    if (route() === 'dashboard' && !modal.open) {
      const currentUser = state.user.id;
      await refresh();
      if (state.user?.id === currentUser && route() === 'dashboard' && !modal.open) await render();
    }
    if (state.user.role === 'admin') {
      state.users = await api('/users');
      if (['users', 'professionals'].includes(route())) updateList();
    }
  } catch {
    /* La siguiente navegación mostrará los errores de conexión. */
  }
}, 30000);
// Inicio de la interfaz: recupera la sesión y muestra la primera pantalla.
async function init() {
  try {
    const me = await api('/me');
    state.user = me.user;
    applyTheme(state.user?.theme || 'light');
    if (state.user) await api('/presence', 'POST', {});
    else if (!['home', 'login', 'register', 'services', 'about', 'contact', 'privacy'].includes(location.hash.slice(1))) history.replaceState(null, '', '#login');
    state.demo = me.demo;
    await refresh();
    await render();
  } catch (e) {
    app.innerHTML = `<div class="loading"><div><h2>No pudimos conectar con SALONEY</h2><p>${esc(e.message)}</p><button class="btn spaced" data-action="reload">Reintentar</button></div></div>`;
  }
}
init();

// Recupera la sesión compartida también al volver de una pestaña suspendida.
let checkingSharedSession = false;
async function checkSharedSession() {
  if (document.hidden || checkingSharedSession) return;
  checkingSharedSession = true;
  try {
    const me = await api('/me');
    if ((me.user?.id || null) !== (state.user?.id || null)) location.reload();
  } catch { /* Un corte de conexión no debe cerrar la sesión. */ }
  finally { checkingSharedSession = false; }
}
setInterval(checkSharedSession, 5000);
window.addEventListener('focus', checkSharedSession);
document.addEventListener('visibilitychange', checkSharedSession);

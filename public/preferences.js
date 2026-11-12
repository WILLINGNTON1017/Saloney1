// Preferencias del navegador y panel de pago de la cliente.
export function themeButton() {
  return '<button type="button" class="btn outline" data-action="theme" aria-label="Cambiar modo claro u oscuro">◐ Claro / oscuro</button>';
}
export function applyTheme(theme = 'light') {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
}
// Retira el usuario que versiones anteriores recordaban entre pestañas.
try {
  localStorage.removeItem('saloney-last-login');
} catch {}

export function paymentFields(a = {}, staff = false) {
  const transfer = a.payment_method === 'Transferencia';
  return `<label>¿Cómo quieres pagar?<select name="method" id="client-payment-method"><option>Efectivo</option><option ${transfer ? 'selected' : ''}>Transferencia</option></select></label>
  ${staff ? '' : '<div id="transfer-options" ' + (transfer ? '' : 'hidden') + '><p class="inline-note">Puedes transferir el total antes de la cita o al finalizar el servicio. El salón confirmará el pago cuando reciba el dinero.</p><a class="text-link" href="https://wa.me/573132887785?text=Hola%20SALONEY%2C%20quiero%20los%20datos%20para%20hacer%20una%20transferencia." target="_blank" rel="noopener noreferrer">Solicitar datos de transferencia por WhatsApp</a></div>'}`;
}
export function paymentChoice(a, staff = false) {
  return `<form data-form="payment-choice" data-id="${a.id}" class="form-stack">${paymentFields(a, staff)}<div class="form-error"></div><button class="btn">Guardar método de pago</button></form>`;
}
export function receiptLink(a) {
  const message =
    'Hola SALONEY. Envío comprobante de la cita #' +
    a.id +
    '. Cliente: ' +
    a.client_name +
    '. Servicio: ' +
    a.service_name +
    '. Fecha: ' +
    a.date +
    ' ' +
    a.time +
    '. Valor: $' +
    a.price +
    ' COP' +
    '. Adjunto el comprobante con referencia, fecha y valor de la transferencia.';
  return (
    '<a class="btn outline" href="https://wa.me/573132887785?text=' +
    encodeURIComponent(message) +
    '" target="_blank" rel="noopener noreferrer">Enviar comprobante por WhatsApp</a><p class="inline-note">Se abrirá WhatsApp con los datos de tu cita. Adjunta la imagen del comprobante y envía el mensaje. Enviarlo no confirma automáticamente el pago.</p>'
  );
}

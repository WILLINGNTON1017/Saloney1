const escape = (s) =>
  String(s || '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function socialLinks(settings) {
  return `<div class="social-links" aria-label="Contacto y redes sociales de SALONEY">${[
    ['instagram', 'Instagram'],
    ['facebook', 'Facebook'],
  ]
    .map(([key, title]) => {
      const content = `<span>${title}</span><strong>Vanessa Quintana</strong>`;
      let href = '';
      try {
        const u = new URL(settings[key + '_url']);
        if (
          u.protocol === 'https:' &&
          [key + '.com', 'www.' + key + '.com', 'm.' + key + '.com'].includes(u.hostname)
        )
          href = u.href;
      } catch {}
      return href
        ? `<a class="social-card" href="${escape(href)}" target="_blank" rel="noopener noreferrer" aria-label="${title} de Vanessa Quintana">${content}<span aria-hidden="true">↗</span></a>`
        : `<span class="social-card">${content}</span>`;
    })
    .join(
      '',
    )}<a class="social-card" href="https://wa.me/573132887785?text=Hola%20SALONEY%2C%20quisiera%20hacer%20una%20consulta." target="_blank" rel="noopener noreferrer" aria-label="Escribir al salón por WhatsApp"><span>WhatsApp · Escribir al salón</span><strong>3132887785</strong><span aria-hidden="true">↗</span></a></div>`;
}

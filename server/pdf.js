import PDFDocument from 'pdfkit';
import { serviceTotals } from '../public/service-totals.js';

const cash = (value) => '$ ' + Number(value || 0).toLocaleString('es-CO') + ' COP';
const clean = (value) => String(value ?? '').replace(/[\x00-\x1f]/g, ' ');

async function document(title, salon, draw) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 44,
    bufferPages: true,
    info: { Title: title, Author: 'SALONEY' },
  });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const width = doc.page.width - 88;
  const header = () => {
    doc
      .fillColor('#d52568')
      .font('Helvetica-Bold')
      .fontSize(24)
      .text(clean(salon.name || 'SALONEY'), 44, 36);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#655464')
      .text('Salón de uñas y belleza · ' + clean(salon.phone), 44, 65);
    doc
      .moveTo(44, 85)
      .lineTo(44 + width, 85)
      .strokeColor('#e8c4d4')
      .stroke();
    doc.y = 103;
  };
  header();
  doc.on('pageAdded', header);
  const heading = (text) => {
    if (doc.y > 710) doc.addPage();
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#332538')
      .text(clean(text), 44, doc.y, { width });
    doc.moveDown(0.6);
  };
  const paragraph = (text) => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#493d4b')
      .text(clean(text), 44, doc.y, { width, lineGap: 4 });
    doc.moveDown(0.5);
  };
  const table = (headers, rows, fractions) => {
    const widths = fractions.map((f) => width * f);
    const row = (values, headerRow = false) => {
      doc.font(headerRow ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      const height = Math.max(
        28,
        ...values.map((v, i) => doc.heightOfString(clean(v), { width: widths[i] - 12 }) + 16),
      );
      if (doc.y + height > 764) {
        doc.addPage();
        if (!headerRow) row(headers, true);
      }
      const y = doc.y;
      doc.rect(44, y, width, height).fill(headerRow ? '#f9e5ee' : '#fcfafb');
      let x = 44;
      values.forEach((v, i) => {
        doc
          .font(headerRow ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .fillColor('#392b40')
          .text(clean(v), x + 6, y + 8, { width: widths[i] - 12 });
        x += widths[i];
      });
      doc
        .moveTo(44, y + height)
        .lineTo(44 + width, y + height)
        .strokeColor('#eee1e8')
        .stroke();
      doc.y = y + height;
    };
    row(headers, true);
    if (!rows.length) paragraph('Sin registros para este período.');
    for (const values of rows) row(values);
    doc.y += 20;
  };
  heading(title);
  draw({ heading, paragraph, table });
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#756573')
      .text(`SALONEY · Página ${i + 1} de ${range.count}`, 44, 788, {
        width,
        align: 'right',
        lineBreak: false,
      });
  }
  doc.end();
  return completed;
}

export function paymentPdf(salon, a, p) {
  return document('Factura de venta', salon, ({ heading, paragraph, table }) => {
    paragraph(
      `Factura SAL-${String(p.id).padStart(6, '0')} · Cita #${a.id} · Fecha de pago: ${p.date}`,
    );
    paragraph(`${salon.address || ''} · ${salon.email || ''}`);
    heading('Cliente y atención');
    table(
      ['Dato', 'Información'],
      [
        ['Cliente', a.client_name],
        ['Teléfono', a.client_phone],
        ['Manicurista', a.professional_name],
        ['Fecha de la cita', `${a.date} · ${a.time}`],
      ],
      [0.3, 0.7],
    );
    table(
      ['Servicio', 'Cantidad', 'Total'],
      [[a.service_name, '1', cash(p.amount)]],
      [0.6, 0.15, 0.25],
    );
    heading('Total pagado: ' + cash(p.amount));
    paragraph(`Estado: Pagado · Método: ${p.method}`);
    paragraph('Confirmado por: ' + (a.confirmed_by_name || 'Administración del salón'));
    if (p.confirmed_at)
      paragraph(
        'Registro de confirmación: ' +
          new Date(p.confirmed_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      );
    paragraph('Gracias por confiar en SALONEY.');
    paragraph('Demostración académica de SALONEY. Documento sin validez fiscal.');
  });
}

export function reportPdf(salon, apps, payments, from, to, user) {
  return document('Reporte del salón', salon, ({ heading, paragraph, table }) => {
    paragraph(
      `Período: ${from} al ${to} · ${user.role === 'admin' ? 'Todo el salón' : 'Citas de ' + user.name}`,
    );
    paragraph(`Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
    table(
      ['Indicador', 'Resultado'],
      [
        ['Citas del período', apps.length],
        ['Citas finalizadas', apps.filter((a) => a.status === 'Finalizada').length],
        ['No asistió', apps.filter((a) => a.status === 'No asistió').length],
        ['Valor de servicios realizados', cash(serviceTotals(apps).total)],
        ['Pendiente de cobro de servicios realizados', cash(serviceTotals(apps).pending)],
        [
          'Canceladas / rechazadas',
          apps.filter((a) => ['Cancelada', 'Rechazada'].includes(a.status)).length,
        ],
        ['Ingresos confirmados', cash(payments.reduce((sum, p) => sum + p.amount, 0))],
      ],
      [0.65, 0.35],
    );
    heading('Detalle de citas');
    paragraph('Las citas, incluidas las canceladas, se filtran por su fecha programada.');
    table(
      ['Cita / fecha', 'Cliente', 'Servicio', 'Manicurista', 'Estado', 'Valor'],
      apps.map((a) => [
        `#${a.id} · ${a.date} ${a.time}`,
        a.client_name,
        a.service_name,
        a.professional_name,
        a.status,
        cash(a.price),
      ]),
      [0.18, 0.17, 0.2, 0.17, 0.13, 0.15],
    );
    heading('Citas canceladas y rechazadas');
    table(
      ['Cita', 'Fecha programada', 'Cliente', 'Estado', 'Motivo'],
      apps
        .filter((a) => ['Cancelada', 'Rechazada'].includes(a.status))
        .map((a) => [
          '#' + a.id,
          a.date,
          a.client_name,
          a.status,
          a.reason || 'Sin motivo registrado',
        ]),
      [0.1, 0.18, 0.24, 0.16, 0.32],
    );
    heading('Pagos confirmados');
    paragraph('Los ingresos se calculan por fecha de pago, aunque la cita sea de otro período.');
    table(
      ['Cita', 'Fecha de pago', 'Cliente', 'Método', 'Valor'],
      payments.map((p) => [
        '#' + p.appointment_id,
        p.date,
        p.client_name,
        p.method,
        cash(p.amount),
      ]),
      [0.1, 0.2, 0.3, 0.2, 0.2],
    );
    heading('Total recibido: ' + cash(payments.reduce((sum, p) => sum + p.amount, 0)));
  });
}

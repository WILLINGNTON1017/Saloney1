import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../server/db.js';
import { DatabaseSync } from 'node:sqlite';
import { sendDueReminders, whatsappNumber, twilioSender } from '../server/whatsapp.js';

test('WhatsApp usa la hora de Colombia y evita envíos duplicados, cancelados o recién reservados', async () => {
  const raw = new DatabaseSync(':memory:');
  const db = {
    kind: 'sqlite',
    all: async (q, p = []) => raw.prepare(q).all(...p),
    run: async (q, p = []) => raw.prepare(q).run(...p),
  };
  try {
    await migrate(db);
    raw.exec('PRAGMA foreign_keys=OFF');
    const insert = raw.prepare("INSERT INTO appointments (id,status,professional_id,service_id,date,time,duration,price,created_at,whatsapp_phone,whatsapp_since) VALUES (?,?,1,1,'2026-11-11','10:00',60,30000,?,?,?)");
    const earlier = '2026-11-10T18:00:00Z';
    const phone = whatsappNumber('300 123 4567');
    assert.equal(phone, '+573001234567');
    assert.equal(twilioSender({}), null);
    insert.run(1, 'Confirmada', earlier, phone, earlier);
    insert.run(2, 'Pendiente', earlier, phone, '2026-11-11T13:00:00Z');
    insert.run(3, 'Cancelada', earlier, phone, earlier);
    insert.run(4, 'Confirmada', earlier, '', '');
    const sent = [];
    const check = time => sendDueReminders(db, async a => sent.push(a.id), Date.parse('2026-11-11T' + time + '-05:00'));
    await check('07:59:59');
    assert.deepEqual(sent, []);
    await check('08:00:00');
    await check('08:01:00');
    assert.deepEqual(sent, [1]);
    await check('09:30:00');
    await check('09:30:30');
    assert.deepEqual(sent, [1, 1, 2]);
  } finally { raw.close(); }
});


import { openDatabase } from '../server/db.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync } from 'node:fs';

const sqlitePath = `data/test-${Date.now()}.db`;
let server;
const base = 'http://127.0.0.1:3099';
let admin, client, pro, other;
let appointmentId;
const date = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
async function request(path, { method = 'GET', data, cookie, origin } = {}) {
  const r = await fetch(base + '/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get('set-cookie')?.split(';')[0],
  };
}
async function login(login) {
  const r = await request('/login', { method: 'POST', data: { login, password: 'Saloney2026!' } });
  assert.equal(r.status, 200);
  return r.cookie;
}
before(async () => {
  mkdirSync('data', { recursive: true });
  server = spawn(process.execPath, ['server/index.js'], {
    env: {
      ...process.env,
      PORT: '3099',
      HOST: '127.0.0.1',
      DB_DRIVER: process.env.TEST_DB_DRIVER || 'sqlite',
      SQLITE_PATH: sqlitePath,
      DEMO_SEED: 'true',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stderr.on('data', (d) => {
    output += d;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start ' + output)), 15000);
    server.stdout.on('data', (d) => {
      if (d.toString().includes('SALONEY disponible')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error('Server exited ' + code + output));
    });
  });
  [admin, client, pro, other] = await Promise.all(['admin', 'maria', 'ana', 'laura'].map(login));
});
after(async () => {
  if (server) {
    server.kill();
    await once(server, 'exit');
  }
});

test('autenticación, permisos, reservas y operaciones del salón', async (t) => {
  await t.test('cajas se compran completas y se entregan por unidad', async () => {
    const data = { name: 'Caja de prueba', category: 'Higiene', unit: 'caja', initial_stock: 2, minimum: 1, unit_cost: 25000, box_size: 50 };
    assert.equal((await request('/products', { method: 'POST', cookie: admin, data })).status, 200);
    const product = async () => (await request('/products', { cookie: admin })).data.find(p => p.name === data.name);
    const p = await product();
    assert.equal(p.stock, 100);
    assert.equal(Number(p.unit_cost), 500);
    assert.equal((await request('/supplies', { method: 'POST', cookie: pro, data: { items: [{ product_id: p.id, quantity: 3 }] } })).status, 200);
    assert.equal((await product()).stock, 97);
    assert.equal((await request('/movements', { method: 'POST', cookie: admin, data: { product_id: p.id, by_box: true, quantity: 1, unit_cost: 25000, reason: 'Compra por caja' } })).status, 200);
    assert.equal((await product()).stock, 147);
  });
  await t.test('cantidad inicial, corrección de existencias y conflicto con un conteo anterior', async () => {
    const data = { name: 'Producto de conteo', category: 'Higiene', unit: 'caja', initial_stock: 7, minimum: 2, unit_cost: 8000 };
    assert.equal((await request('/products', { method: 'POST', cookie: admin, data })).status, 200);
    const product = (await request('/products', { cookie: admin })).data.find(p => p.name === data.name);
    assert.equal(product.stock, 7);
    const update = { ...product, stock_before: 7, stock: 9 };
    const path = '/products/' + product.id;
    assert.equal((await request(path, { method: 'PATCH', cookie: admin, data: update })).status, 200);
    assert.equal((await request(path, { method: 'PATCH', cookie: admin, data: { ...update, stock: 4 } })).status, 409);
    const moves = (await request('/movements', { cookie: admin })).data.filter(m => m.product_id === product.id);
    assert.deepEqual(moves.map(m => [m.quantity,m.existencias_despues]), [[2,9],[7,7]]);
    const configure = { ...update, stock_before: 9, stock: 9, box_size: 10, box_size_before: 0 };
    assert.equal((await request(path, { method: 'PATCH', cookie: admin, data: configure })).status, 200);
    assert.equal((await request(path, { method: 'PATCH', cookie: admin, data: configure })).status, 409);
    const configured = (await request('/products', { cookie: admin })).data.find(p => p.id === product.id);
    assert.equal(configured.stock, 90);
    assert.equal(Number(configured.unit_cost), 800);
  });
  await t.test('costos de compra y productos en uso se descuentan al solicitar y no al agotarse', async () => {
    assert.equal((await request('/products', { cookie: client })).status, 403);
    assert.equal((await request('/products', { method: 'POST', cookie: admin, data: {
      name: 'Frasco de prueba', category: 'Esmaltes', minimum: 1, unit: 'frasco', unit_cost: 10000,
    } })).status, 200);
    const products = await request('/products', { cookie: admin });
    const created = products.data.find(p => p.name === 'Frasco de prueba');
    assert.ok(Number.isFinite(Date.parse(created.created_at)));
    const id = created.id;
    await request('/products/' + id, { method: 'PATCH', cookie: admin, data: { ...created, name: 'Frasco editado' } });
    assert.equal((await request('/products', { cookie: admin })).data.find(p => p.id === id).created_at, created.created_at);
    const movement = { product_id: id, quantity: 2, unit_cost: 10000, reason: 'Compra de prueba' };
    assert.equal((await request('/movements', { method: 'POST', cookie: admin, data: movement })).status, 200);
    assert.equal((await request('/movements', { method: 'POST', cookie: admin, data: { ...movement, unit_cost: 20000 } })).status, 200);
    const product = async () => (await request('/products', { cookie: admin })).data.find(p => p.id === id);
    assert.equal(Number((await product()).unit_cost), 15000);
    const taken = await request('/supplies', { method: 'POST', cookie: pro, data: { items: [{ product_id: id, quantity: 4 }] } });
    assert.equal(taken.status, 200);
    assert.equal((await product()).stock, 0);
    assert.equal(Number((await product()).in_use), 4);
    assert.equal((await request('/supplies', { method: 'POST', cookie: pro, data: { items: [{ product_id: id, quantity: 1 }] } })).status, 409);
    assert.equal((await request('/movements', { method: 'POST', cookie: admin, data: { ...movement, quantity: -1 } })).status, 400);
    const finish = '/supplies/' + taken.data.ids[0] + '/finish';
    assert.equal((await request(finish, { method: 'POST', cookie: client, data: {} })).status, 403);
    const anotherPro = await login('valentina');
    assert.equal((await request(finish, { method: 'POST', cookie: anotherPro, data: {} })).status, 404);
    const responses = await Promise.all([1, 2].map(() => request(finish, { method: 'POST', cookie: pro, data: {} })));
    assert.deepEqual(responses.map(r => r.status), [200, 200]);
    assert.equal((await product()).stock, 0);
    const moves = (await request('/movements', { cookie: admin })).data.filter(m => m.product_id === id && m.quantity < 0);
    assert.equal(moves.length, 1);
    assert.equal(Number(moves[0].unit_cost), 15000);
    assert.equal(moves[0].tipo_movimiento, 'Entrega a manicurista');
    assert.equal(moves[0].existencias_antes, 4);
    assert.equal(moves[0].existencias_despues, 0);
    assert.equal(moves[0].id_entrega, taken.data.ids[0]);
    assert.ok(moves[0].manicurista);
  });
  await t.test('el almuerzo excluye intervalos completos y rechaza reservas directas', async () => {
    const r = await request(`/availability?service=1&professional=4&date=${date}`);
    assert.equal(r.status, 200);
    assert.ok(r.data.includes('10:30'));
    assert.ok(r.data.includes('12:30'));
    for (const time of ['11:00', '11:30', '12:00']) {
      assert.ok(!r.data.includes(time));
      assert.equal((await request('/appointments', {
        method: 'POST', cookie: client,
        data: { service_id: 1, professional_id: 4, date, time },
      })).status, 409);
    }
  });
  await t.test('el login reconoce el rol y no expone el hash', async () => {
    const r = await request('/me', { cookie: client });
    assert.equal(r.data.user.role, 'cliente');
    assert.equal(r.data.user.password_hash, undefined);
    assert.equal((await request('/users', { cookie: client })).status, 403);
    assert.equal((await request('/users')).status, 401);
    assert.equal((await request('/payments', { cookie: pro })).status, 403);
  });
  await t.test('registro forzoso como cliente y rechazo de duplicados', async () => {
    const data = {
      name: 'Cliente de prueba',
      username: 'prueba',
      email: 'prueba@example.com',
      phone: '3004445555',
      password: 'Prueba2026!',
      role: 'admin',
      terms: true,
    };
    const r = await request('/register', { method: 'POST', data });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, 'cliente');
    assert.equal((await request('/register', { method: 'POST', data })).status, 409);
  });
  await t.test('rechaza solicitudes de otro origen', async () => {
    assert.equal(
      (
        await request('/appointments', {
          method: 'POST',
          cookie: client,
          origin: 'https://attacker.example',
          data: {},
        })
      ).status,
      403,
    );
  });
  await t.test('dos reservas simultáneas no ocupan el mismo horario', async () => {
    const data = { service_id: 2, professional_id: 3, date, time: '09:00' };
    const results = await Promise.all([
      request('/appointments', { method: 'POST', cookie: client, data }),
      request('/appointments', { method: 'POST', cookie: client, data }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    appointmentId = results.find((r) => r.status === 200).data.id;
  });
  await t.test('notificación privada y lectura persistente de nueva cita', async () => {
    const r = await request('/notifications', { cookie: pro });
    const notes = r.data.items.filter((n) => n.appointment_id === appointmentId);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].read_at, null);
    assert.equal(
      (
        await request('/notifications/' + notes[0].id + '/read', {
          method: 'POST',
          cookie: other,
          data: {},
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request('/notifications/' + notes[0].id + '/read', {
          method: 'POST',
          cookie: pro,
          data: {},
        })
      ).status,
      200,
    );
    assert.ok(
      (await request('/notifications', { cookie: pro })).data.items.find(
        (n) => n.id === notes[0].id,
      ).read_at,
    );
  });
  await t.test('No asistió requiere personal y cita vencida y no crea cobros', async () => {
    assert.equal(
      (
        await request('/appointments/' + appointmentId, {
          method: 'PATCH',
          cookie: client,
          data: { status: 'No asistió' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request('/appointments/' + appointmentId, {
          method: 'PATCH',
          cookie: admin,
          data: { status: 'No asistió' },
        })
      ).status,
      400,
    );
    process.env.DB_DRIVER = process.env.TEST_DB_DRIVER || 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;
    const fixture = await openDatabase();
    let result;
    try {
      result = await fixture.run(
        'INSERT INTO appointments (client_id,professional_id,service_id,date,time,duration,price,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [2, 3, 1, '2020-01-01', '09:00', 60, 30000, 'Confirmada', new Date().toISOString()],
      );
    } finally {
      await fixture.close();
    }
    const id = Number(result.lastInsertRowid);
    assert.equal(
      (
        await request('/appointments/' + id, {
          method: 'PATCH',
          cookie: pro,
          data: { status: 'No asistió' },
        })
      ).status,
      200,
    );
    assert.equal(
      (await request('/appointments', { cookie: client })).data.find((a) => a.id === id).status,
      'No asistió',
    );
    assert.ok(
      !(await request('/payments', { cookie: admin })).data.some((p) => p.appointment_id === id),
    );
    assert.equal(
      (
        await request('/appointments/' + id, {
          method: 'PATCH',
          cookie: admin,
          data: { status: 'Finalizada' },
        })
      ).status,
      400,
    );
  });
  await t.test('la duración bloquea horarios intermedios', async () => {
    const r = await request(`/availability?service=1&professional=3&date=${date}`);
    assert.equal(r.data.includes('09:30'), false);
    assert.equal(r.data.includes('10:00'), false);
    assert.equal(r.data.includes('10:30'), true);
  });
  await t.test('no permite acceder ni cambiar citas de otra cliente', async () => {
    const r = await request('/appointments', { cookie: other });
    assert.ok(!r.data.some((a) => a.id === appointmentId));
    assert.equal(
      (
        await request('/appointments/' + appointmentId, {
          method: 'PATCH',
          cookie: other,
          data: { status: 'Cancelada' },
        })
      ).status,
      403,
    );
  });
  await t.test('la manicurista confirma y finaliza la atención asignada', async () => {
    assert.equal(
      (
        await request('/appointments/' + appointmentId, {
          method: 'PATCH',
          cookie: pro,
          data: { status: 'Finalizada' },
        })
      ).status,
      400,
    );
    for (const status of ['Confirmada', 'En proceso', 'Finalizada'])
      assert.equal(
        (
          await request('/appointments/' + appointmentId, {
            method: 'PATCH',
            cookie: pro,
            data: { status },
          })
        ).status,
        200,
      );
    assert.equal(
      (
        await request('/appointments/' + appointmentId, {
          method: 'PATCH',
          cookie: client,
          data: { status: 'Cancelada' },
        })
      ).status,
      400,
    );
  });
  await t.test(
    'cliente no cambia el medio al finalizar aunque falte confirmar el cobro',
    async () => {
      const r = await request('/appointments/' + appointmentId + '/payment-choice', {
        method: 'PATCH',
        cookie: client,
        data: { method: 'Efectivo' },
      });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /finalizó/);
    },
  );
  await t.test('pago usa el precio de la reserva y no permite duplicar ingresos', async () => {
    const data = {
      appointment_id: appointmentId,
      amount: 1,
      method: 'Efectivo',
      status: 'Pagado',
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()),
    };
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await request('/payments', { method: 'POST', cookie: admin, data })).status,
        200,
      );
    const p = (await request('/payments', { cookie: client })).data.filter(
      (p) => p.appointment_id === appointmentId,
    );
    assert.equal(p.length, 1);
    assert.equal(p[0].amount, 60000);
  });
  await t.test('inventario impide stock negativo y registra movimientos', async () => {
    assert.equal(
      (
        await request('/movements', {
          method: 'POST',
          cookie: admin,
          data: { product_id: 1, quantity: -999, reason: 'Prueba' },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request('/movements', {
          method: 'POST',
          cookie: admin,
          data: { product_id: 1, quantity: 3, reason: 'Compra' },
        })
      ).status,
      200,
    );
    assert.equal(
      (await request('/products', { cookie: admin })).data.find((p) => p.id === 1).stock,
      27,
    );
  });
  await t.test('reservas de visitante exigen contacto', async () => {
    const data = { service_id: 1, professional_id: 4, date, time: '13:00' };
    assert.equal((await request('/appointments', { method: 'POST', data })).status, 400);
    assert.equal(
      (
        await request('/appointments', {
          method: 'POST',
          data: { ...data, name: 'Invitada', phone: '3002223333' },
        })
      ).status,
      200,
    );
  });
  await t.test('bloqueo de disponibilidad excluye los horarios', async () => {
    assert.equal(
      (
        await request('/blocks', {
          method: 'POST',
          cookie: pro,
          data: { date, start_time: '14:00', end_time: '16:00', reason: 'Capacitación' },
        })
      ).status,
      200,
    );
    const slots = (await request(`/availability?service=1&professional=3&date=${date}`)).data;
    assert.ok(!slots.includes('14:00'));
    assert.ok(!slots.includes('13:30'));
    assert.ok(slots.includes('16:00'));
  });
  await t.test('reprogramación y cancelación respetan propiedad y liberan horario', async () => {
    const r = await request('/appointments', {
      method: 'POST',
      cookie: client,
      data: { service_id: 1, professional_id: 4, date, time: '09:00' },
    });
    assert.equal(r.status, 200);
    assert.equal(
      (
        await request('/appointments/' + r.data.id, {
          method: 'PATCH',
          cookie: client,
          data: { date, time: '10:00' },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request('/appointments/' + r.data.id, {
          method: 'PATCH',
          cookie: client,
          data: { status: 'Cancelada' },
        })
      ).status,
      200,
    );
    assert.ok(
      (await request(`/availability?service=1&professional=4&date=${date}`)).data.includes('10:00'),
    );
  });
  await t.test('desactivar servicios conserva citas anteriores', async () => {
    assert.equal(
      (await request('/services/2', { method: 'DELETE', cookie: admin, data: {} })).status,
      200,
    );
    assert.ok(!(await request('/services')).data.some((s) => s.id === 2));
    assert.ok(
      (await request('/appointments', { cookie: client })).data.some((a) => a.id === appointmentId),
    );
  });
  await t.test('el cierre de sesión invalida la cookie', async () => {
    assert.equal(
      (await request('/theme', { method: 'PATCH', data: { theme: 'dark' } })).status,
      401,
    );
    assert.equal(
      (await request('/theme', { method: 'PATCH', cookie: client, data: { theme: 'otro' } }))
        .status,
      400,
    );
    assert.equal(
      (await request('/theme', { method: 'PATCH', cookie: client, data: { theme: 'dark' } }))
        .status,
      200,
    );
    assert.equal((await request('/me', { cookie: client })).data.user.theme, 'dark');
    assert.equal((await request('/me', { cookie: other })).data.user.theme, 'light');
    await request('/logout', { method: 'POST', cookie: client, data: {} });
    assert.equal((await request('/appointments', { cookie: client })).status, 401);
    const again = await login('maria');
    assert.equal((await request('/me', { cookie: again })).data.user.theme, 'dark');
    await request('/logout', { method: 'POST', cookie: again, data: {} });
  });
  await t.test(
    'editar el contacto conserva sesión y restablecer clave renueva el acceso propio',
    async () => {
      const account = (await request('/me', { cookie: admin })).data.user;
      assert.equal(
        (
          await request('/users/' + account.id, {
            method: 'PATCH',
            cookie: admin,
            data: { ...account, name: 'Administrador actualizado' },
          })
        ).status,
        200,
      );
      assert.equal((await request('/users', { cookie: admin })).status, 200);
      const changed = await request('/users/' + account.id, {
        method: 'PATCH',
        cookie: admin,
        data: { ...account, password: 'NuevaAdmin2026!' },
      });
      assert.equal(changed.status, 200);
      assert.ok(changed.cookie);
      assert.equal((await request('/users', { cookie: admin })).status, 401);
      admin = changed.cookie;
      assert.equal((await request('/users', { cookie: admin })).status, 200);
    },
  );
  await t.test('presencia distingue conexión y cierra la sesión de la profesional', async () => {
    assert.equal(
      (await request('/presence', { method: 'POST', cookie: pro, data: {} })).status,
      200,
    );
    assert.ok((await request('/professionals')).data.some((p) => p.id === 3 && p.online));
    await request('/logout', { method: 'POST', cookie: pro, data: {} });
    assert.ok((await request('/professionals')).data.some((p) => p.id === 3 && p.online === false));
    assert.ok(
      (await request('/availability?service=1&professional=3&date=' + date)).data.length > 0,
    );
    assert.equal(
      (await request('/users', { cookie: admin })).data.find((p) => p.id === 3).online,
      false,
    );
  });
  await t.test('preferencia de pago valida propiedad, cuentas y no registra cobros', async () => {
    client = await login('maria');
    const created = await request('/appointments', {
      method: 'POST',
      cookie: client,
      data: { service_id: 1, professional_id: 4, date, time: '16:00' },
    });
    assert.equal(created.status, 200);
    const path = '/appointments/' + created.data.id + '/payment-choice';
    assert.equal(
      (await request(path, { method: 'PATCH', cookie: other, data: { method: 'Efectivo' } }))
        .status,
      403,
    );
    assert.equal(
      (await request(path, { method: 'PATCH', cookie: client, data: { method: 'Tarjeta' } }))
        .status,
      400,
    );
    assert.equal(
      (
        await request(path, {
          method: 'PATCH',
          cookie: client,
          data: { method: 'Transferencia', destination: 'Otro' },
        })
      ).status,
      400,
    );
    for (const destination of ['Nequi', 'Bancolombia'])
      assert.equal(
        (
          await request(path, {
            method: 'PATCH',
            cookie: client,
            data: { method: 'Transferencia', destination },
          })
        ).status,
        200,
      );
    assert.ok(
      !(await request('/payments', { cookie: client })).data.some(
        (p) => p.appointment_id === created.data.id,
      ),
    );
    assert.equal(
      (await request('/appointments', { cookie: client })).data.find(
        (a) => a.id === created.data.id,
      ).payment_destination,
      'Bancolombia',
    );
    assert.equal(
      (await request(path, { method: 'PATCH', cookie: client, data: { method: 'Efectivo' } }))
        .status,
      200,
    );
    assert.equal(
      (
        await request('/appointments/' + appointmentId + '/payment-choice', {
          method: 'PATCH',
          cookie: client,
          data: { method: 'Efectivo' },
        })
      ).status,
      400,
    );
  });
  await t.test('eliminación retira cuentas sin destruir historial ni permitir acceso', async () => {
    const registered = await request('/register', {
      method: 'POST',
      data: {
        name: 'Cuenta eliminable',
        username: 'eliminable',
        email: 'eliminable@example.com',
        phone: '3004445555',
        password: 'Prueba2026!',
        terms: true,
      },
    });
    const id = registered.data.user.id;
    assert.equal(
      (await request('/users/' + id, { method: 'DELETE', cookie: client, data: {} })).status,
      403,
    );
    assert.equal(
      (await request('/users/1', { method: 'DELETE', cookie: admin, data: {} })).status,
      400,
    );
    assert.equal(
      (await request('/users/' + id, { method: 'DELETE', cookie: admin, data: {} })).status,
      200,
    );
    assert.ok(!(await request('/users', { cookie: admin })).data.some((u) => u.id === id));
    assert.ok(!(await request('/clients', { cookie: admin })).data.some((u) => u.id === id));
    assert.equal((await request('/appointments', { cookie: registered.cookie })).status, 401);
    assert.equal(
      (
        await request('/login', {
          method: 'POST',
          data: { login: 'eliminable', password: 'Prueba2026!' },
        })
      ).status,
      401,
    );
    assert.equal(
      (await request('/users/2', { method: 'DELETE', cookie: admin, data: {} })).status,
      400,
    );
  });
  await t.test(
    'reserva guarda el medio, personal confirma y el ingreso no se duplica',
    async () => {
      const assigned = await login('valentina');
      const unassigned = await login('ana');
      const booking = await request('/appointments', {
        method: 'POST',
        cookie: client,
        data: {
          service_id: 1,
          professional_id: 4,
          date,
          time: '17:00',
          method: 'Transferencia',
        },
      });
      assert.equal(booking.status, 200);
      const id = booking.data.id;
      const path = '/appointments/' + id;
      let appointment = (await request('/appointments', { cookie: client })).data.find(
        (a) => a.id === id,
      );
      assert.equal(appointment.payment_method, 'Transferencia');
      assert.equal(appointment.payment_destination, '');
      assert.equal(appointment.payment_status, null);
      assert.equal(
        (
          await request(path + '/payment-choice', {
            method: 'PATCH',
            cookie: unassigned,
            data: { method: 'Efectivo' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(path + '/payment-choice', {
            method: 'PATCH',
            cookie: assigned,
            data: { method: 'Efectivo' },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(path + '/confirm-payment', {
            method: 'POST',
            cookie: client,
            data: { method: 'Efectivo', received: true },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(path + '/confirm-payment', {
            method: 'POST',
            cookie: unassigned,
            data: { method: 'Efectivo', received: true },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(path + '/confirm-payment', {
            method: 'POST',
            cookie: assigned,
            data: { method: 'Efectivo' },
          })
        ).status,
        400,
      );
      const results = await Promise.all(
        [assigned, admin].map((cookie) =>
          request(path + '/confirm-payment', {
            method: 'POST',
            cookie,
            data: { method: 'Transferencia', received: true, amount: 1 },
          }),
        ),
      );
      assert.deepEqual(
        results.map((r) => r.status),
        [200, 200],
      );
      const rows = (await request('/payments', { cookie: admin })).data.filter(
        (p) => p.appointment_id === id,
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].amount, 30000);
      assert.equal(rows[0].method, 'Transferencia');
      assert.equal(rows[0].status, 'Pagado');
      appointment = (await request('/appointments', { cookie: assigned })).data.find(
        (a) => a.id === id,
      );
      assert.ok(appointment.confirmed_by_name);
      assert.equal(appointment.payment_amount, 30000);
      assert.equal(
        (
          await request(path + '/payment-choice', {
            method: 'PATCH',
            cookie: admin,
            data: { method: 'Transferencia', destination: 'Bancolombia' },
          })
        ).status,
        200,
      );
      const corrected = (await request('/payments', { cookie: admin })).data.find(
        (p) => p.appointment_id === id,
      );
      assert.equal(corrected.method, 'Bancolombia');
      assert.equal(corrected.amount, 30000);
      assert.equal(corrected.status, 'Pagado');
    },
  );
  await t.test('PDF de comprobantes y reportes respeta permisos', async () => {
    const invoice = '/api/appointments/' + appointmentId + '/invoice.pdf';
    const downloaded = await fetch(base + invoice, { headers: { Cookie: client } });
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('content-type'), 'application/pdf');
    assert.ok(downloaded.headers.get('content-disposition').includes('.pdf'));
    assert.equal(
      Buffer.from(await downloaded.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      '%PDF-',
    );
    assert.equal((await fetch(base + invoice)).status, 401);
    assert.equal((await fetch(base + invoice, { headers: { Cookie: other } })).status, 403);
    const report = base + '/api/reports.pdf?from=2020-01-01&to=2099-12-31';
    assert.equal((await fetch(report, { headers: { Cookie: client } })).status, 403);
    const adminReport = await fetch(report, { headers: { Cookie: admin } });
    assert.equal(adminReport.status, 200);
    assert.equal(
      Buffer.from(await adminReport.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      '%PDF-',
    );
    assert.equal(
      (
        await fetch(base + '/api/reports.pdf?from=2099-12-31&to=2020-01-01', {
          headers: { Cookie: admin },
        })
      ).status,
      400,
    );
  });
});

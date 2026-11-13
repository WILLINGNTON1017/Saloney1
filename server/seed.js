import { hashPassword, today } from './security.js';
export async function seed(db) {
  if (!(await db.all('SELECT id FROM settings')).length)
    await db.run(
      "INSERT INTO settings (id,name,phone,email,address,cancellation_hours,lead_hours,lead_minutes,opens,closes) VALUES (1, 'SALONEY','3132887785','wmenarenteria003@gmail.com','Medellín, Colombia',6,0,30,'08:00','18:00')",
    );
  if (!(await db.all('SELECT id FROM services')).length) {
    const services = [
      ['Manicure tradicional', 'Limpieza, cuidado de cutícula, exfoliación y esmalte.', 30000, 60],
      ['Uñas en gel', 'Aplicación de gel con acabado brillante y diseño básico.', 60000, 90],
      ['Pedicure', 'Cuidado completo para consentir tus pies.', 40000, 75],
      ['Diseños', 'Detalles y nail art para expresar tu estilo.', 10000, 30],
      ['Esmaltado permanente', 'Color intenso y duradero con acabado impecable.', 30000, 45],
      ['Spa de manos', 'Exfoliación, masaje e hidratación profunda.', 35000, 45],
      ['Spa de pies', 'Relajación y cuidado para tus pies.', 35000, 60],
      ['Retiro de gel', 'Retiro cuidadoso y protección de la uña natural.', 15000, 30],
    ];
    for (const [i, s] of services.entries())
      await db.run(
        'INSERT INTO services (name,description,price,duration,image) VALUES (?,?,?,?,?)',
        [...s, i],
      );
  }
  const demo = process.env.DEMO_SEED !== 'false' && process.env.NODE_ENV !== 'production';
  if ((await db.all('SELECT id FROM users')).length) return;
  if (!demo) {
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12)
      throw new Error(
        'Configura ADMIN_PASSWORD (mínimo 12 caracteres) y ADMIN_EMAIL para crear el administrador.',
      );
    await db.run(
      'INSERT INTO users (name,username,email,phone,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)',
      [
        'Administrador',
        'admin',
        process.env.ADMIN_EMAIL || 'admin@saloney.com',
        '3001234567',
        await hashPassword(process.env.ADMIN_PASSWORD),
        'admin',
        new Date().toISOString(),
      ],
    );
    return;
  }
  const pass = await hashPassword('Saloney2026!');
  const users = [
    ['Administrador', 'admin', 'admin@saloney.com', 'admin', ''],
    ['María López', 'maria', 'maria@saloney.com', 'cliente', ''],
    ['Ana Martínez', 'ana', 'ana@saloney.com', 'manicurista', 'Uñas en gel y diseños'],
    [
      'Valentina Rodríguez',
      'valentina',
      'valentina@saloney.com',
      'manicurista',
      'Manicure y pedicure',
    ],
    ['Laura Gómez', 'laura', 'laura@saloney.com', 'cliente', ''],
    ['Carolina Díaz', 'carolina', 'carolina@saloney.com', 'manicurista', 'Esmaltado y nail art'],
  ];
  for (const [name, username, email, role, specialty] of users)
    await db.run(
      'INSERT INTO users (name,username,email,phone,password_hash,role,specialty,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [name, username, email, '3001234567', pass, role, specialty, new Date().toISOString()],
    );
  for (let i = 0; i < 20; i++) {
    const d = new Date(today() + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + Math.floor(i / 4) - 2);
    const sid = (i % 5) + 1;
    const s = (await db.all('SELECT * FROM services WHERE id=?', [sid]))[0];
    const status =
      i < 8 ? 'Finalizada' : ['Pendiente', 'Confirmada', 'En proceso', 'Confirmada'][i % 4];
    const r = await db.run(
      'INSERT INTO appointments (client_id,professional_id,service_id,date,time,duration,price,status,design,color,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        i % 2 ? 5 : 2,
        i % 2 ? 4 : 3,
        sid,
        d.toISOString().slice(0, 10),
        ['09:00', '11:00', '14:00', '16:00'][i % 4],
        s.duration,
        s.price,
        status,
        'Clásico',
        'Rosado',
        '',
        new Date().toISOString(),
      ],
    );
    if (i < 8)
      await db.run(
        'INSERT INTO payments (appointment_id,amount,method,status,date) VALUES (?,?,?,?,?)',
        [
          Number(r.lastInsertRowid),
          s.price,
          ['Efectivo', 'Tarjeta', 'Transferencia'][i % 3],
          'Pagado',
          d.toISOString().slice(0, 10),
        ],
      );
  }
  for (const p of [
    ['Esmalte gel rosado', 'Esmaltes', 24, 5],
    ['Esmalte gel rojo', 'Esmaltes', 18, 5],
    ['Base de gel', 'Productos', 3, 5],
    ['Top coat', 'Productos', 12, 5],
    ['Limas profesionales', 'Accesorios', 40, 10],
  ])
    await db.run('INSERT INTO products (name,category,stock,minimum) VALUES (?,?,?,?)', p);
}

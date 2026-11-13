import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createReminders } from '../server/reminders.js';
test('recordatorios 24h y 3h sin duplicados, sin avisos para canceladas o ajenas', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec(
    "CREATE TABLE appointments(id INTEGER,client_id INTEGER,service_id INTEGER,date TEXT,time TEXT,status TEXT); CREATE TABLE services(id INTEGER,name TEXT); CREATE TABLE notifications(id INTEGER PRIMARY KEY,user_id INTEGER,appointment_id INTEGER,message TEXT,created_at TEXT); INSERT INTO services VALUES(1,'Manicure'); INSERT INTO appointments VALUES(1,2,1,'2026-09-20','10:00','Confirmada'),(2,2,1,'2026-09-20','10:00','Cancelada'),(3,9,1,'2026-09-20','10:00','Confirmada');",
  );
  const db = {
    all: async (sql, args = []) => raw.prepare(sql).all(...args),
    run: async (sql, args = []) => raw.prepare(sql).run(...args),
  };
  try {
    await createReminders(db, 2, Date.parse('2026-09-19T09:00:00-05:00'));
    assert.equal((await db.all('SELECT * FROM notifications')).length, 0);
    for (let i = 0; i < 2; i++)
      await createReminders(db, 2, Date.parse('2026-09-19T10:00:00-05:00'));
    assert.equal((await db.all('SELECT * FROM notifications')).length, 1);
    for (let i = 0; i < 2; i++)
      await createReminders(db, 2, Date.parse('2026-09-20T07:00:00-05:00'));
    assert.equal((await db.all('SELECT * FROM notifications')).length, 2);
    await createReminders(db, 2, Date.parse('2026-09-20T11:00:00-05:00'));
    assert.equal((await db.all('SELECT * FROM notifications')).length, 2);
  } finally {
    raw.close();
  }
});

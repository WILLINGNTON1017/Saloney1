import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceTotals } from '../public/service-totals.js';

test('finalizar suma el servicio una vez; pagar reduce pendiente sin duplicar trabajo', () => {
  const a = { id: 1, status: 'Confirmada', price: 30000 };
  const cancelled = { id: 2, status: 'Cancelada', price: 60000 };
  assert.deepEqual(serviceTotals([a, cancelled]), { count: 0, total: 0, pending: 0 });
  a.status = 'Finalizada';
  assert.deepEqual(serviceTotals([a, a, cancelled]), { count: 1, total: 30000, pending: 30000 });
  a.payment_status = 'Pagado';
  assert.deepEqual(serviceTotals([a, cancelled]), { count: 1, total: 30000, pending: 0 });
});

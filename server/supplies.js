import { fail, integer } from './security.js';

// La entrega descuenta el almacén. Agotar el producto solo actualiza su estado.
export async function suppliesApi(db, path, method, b, u) {
  if (!u || !['admin', 'manicurista'].includes(u.role)) fail('No tienes permiso para esta acción.', 403);
  if (method === 'GET' && path === '/api/supplies') {
    return db.all(`SELECT s.*,p.name product_name,CASE WHEN s.piece_counted=1 THEN 'unidad' ELSE p.unit END unit,u.name professional_name
      FROM professional_supplies s JOIN products p ON p.id=s.product_id
      JOIN users u ON u.id=s.professional_id ${u.role === 'manicurista' ? 'WHERE s.professional_id=?' : ''}
      ORDER BY s.id DESC`, u.role === 'manicurista' ? [u.id] : []);
  }
  if (method === 'POST' && path === '/api/supplies') {
    const professional = u.role === 'manicurista' ? u.id : integer(b.professional_id, 'Manicurista', 1);
    if (!(await db.all("SELECT id FROM users WHERE id=? AND role='manicurista' AND active=1 AND deleted=0", [professional])).length)
      fail('Selecciona una manicurista activa.');
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100) fail('Selecciona entre 1 y 100 productos.');
    const seen = new Set();
    const ids = [];
    for (const item of b.items) {
      const id = integer(item.product_id, 'Producto', 1);
      const quantity = integer(item.quantity, 'Cantidad', 1, 100000);
      if (seen.has(id)) fail('Un producto no puede repetirse en la solicitud.');
      seen.add(id);
      const [p] = await db.all('SELECT * FROM products WHERE id=? AND active=1', [id]);
      if (!p || quantity > p.stock) fail('No hay suficientes existencias para todos los productos solicitados.', 409);
      const now = new Date().toISOString();
      const result = await db.run('INSERT INTO professional_supplies (product_id,professional_id,quantity,unit_cost,started_at,exhausted_at,piece_counted) VALUES (?,?,?,?,?,?,?)',
        [id, professional, quantity, Number(p.unit_cost), now, '', p.box_size ? 1 : 0]);
      const supplyId = Number(result.lastInsertRowid);
      ids.push(supplyId);
      await db.run('UPDATE products SET stock=stock-? WHERE id=?', [quantity, id]);
      await db.run('INSERT INTO stock_movements (product_id,quantity,reason,user_id,created_at,unit_cost,tipo_movimiento,existencias_antes,existencias_despues,id_entrega) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [id, -quantity, `Entrega a manicurista #${professional} · solicitud #${supplyId}`, u.id, now, Number(p.unit_cost), 'Entrega a manicurista', p.stock, p.stock - quantity, supplyId]);
    }
    return { ids };
  }
  if (method === 'POST' && /^\/api\/supplies\/\d+\/finish$/.test(path)) {
    const [s] = await db.all('SELECT * FROM professional_supplies WHERE id=?', [Number(path.split('/')[3])]);
    if (!s || (u.role === 'manicurista' && s.professional_id !== u.id)) fail('Producto en uso no encontrado.', 404);
    if (s.exhausted_at) return { ok: true };
    await db.run('UPDATE professional_supplies SET exhausted_at=? WHERE id=?', [new Date().toISOString(), s.id]);
    return { ok: true };
  }
  fail('Operación no encontrada.', 404);
}

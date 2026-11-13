export const inventoryCatalog = [
  ['Lima 100/180', 'Limas y pulido', 'unidad', 1500, 20],
  ['Lima 80/100 (acrílico)', 'Limas y pulido', 'unidad', 2000, 10],
  ['Bloque pulidor', 'Limas y pulido', 'unidad', 2500, 10],
  ['Buffer', 'Limas y pulido', 'unidad', 2000, 10],
  ['Fresa para torno', 'Limas y pulido', 'unidad', 10000, 5],
  ['Esmalte semipermanente (por color)', 'Esmaltes', 'frasco', 12000, 5],
  ['Base coat', 'Esmaltes', 'frasco', 18000, 3],
  ['Rubber base', 'Esmaltes', 'frasco', 22000, 2],
  ['Top coat brillante', 'Esmaltes', 'frasco', 18000, 3],
  ['Top coat mate', 'Esmaltes', 'frasco', 18000, 2],
  ['Gel constructor', 'Geles', 'frasco', 30000, 2],
  ['Poligel', 'Geles', 'tubo', 35000, 2],
  ['Slip solution', 'Geles', 'frasco', 15000, 2],
  ['Polvo acrílico', 'Acrílico', 'frasco', 35000, 2],
  ['Monómero', 'Acrílico', 'frasco', 30000, 2],
  ['Tips (caja surtida)', 'Extensiones', 'caja', 15000, 5],
  ['Moldes (forms)', 'Extensiones', 'rollo', 10000, 3],
  ['Pegamento para tips', 'Extensiones', 'unidad', 4000, 5],
  ['Deshidratador', 'Preparación', 'frasco', 12000, 2],
  ['Primer', 'Preparación', 'frasco', 15000, 2],
  ['Alcohol isopropílico', 'Preparación', 'frasco', 12000, 2],
  ['Cleaner (limpiador)', 'Preparación', 'frasco', 14000, 2],
  ['Removedor de cutícula', 'Cuidado', 'frasco', 10000, 2],
  ['Aceite de cutículas', 'Cuidado', 'frasco', 9000, 3],
  ['Crema hidratante', 'Cuidado', 'tarro', 15000, 2],
  ['Quitaesmalte', 'Removedores', 'frasco', 8000, 3],
  ['Removedor de semipermanente', 'Removedores', 'frasco', 10000, 3],
  ['Pigmento cromo / espejo', 'Decoración', 'frasco', 8000, 3],
  ['Glitter', 'Decoración', 'frasco', 5000, 3],
  ['Strass / cristales', 'Decoración', 'bolsa', 8000, 3],
  ['Stickers / calcomanías', 'Decoración', 'paquete', 5000, 5],
  ['Pincel de detalle (liner)', 'Decoración', 'unidad', 6000, 3],
  ['Algodón', 'Consumibles', 'bolsa', 5000, 5],
  ['Toallitas sin pelusa', 'Consumibles', 'paquete', 8000, 4],
  ['Palitos de naranjo', 'Consumibles', 'paquete', 4000, 3],
  ['Papel aluminio para retirar semipermanente', 'Consumibles', 'paquete', 10000, 3],
  ['Separadores de dedos', 'Consumibles', 'paquete', 3000, 3],
  ['Toallas desechables', 'Consumibles', 'paquete', 12000, 3],
  ['Guantes desechables', 'Higiene', 'caja', 25000, 2],
  ['Tapabocas', 'Higiene', 'caja', 8000, 2],
];

export async function loadInventoryCatalog(db) {
  await db.run(db.kind === 'mysql' ? 'START TRANSACTION' : 'BEGIN IMMEDIATE');
  try {
    if (db.kind === 'mysql') await db.all('SELECT id FROM app_lock WHERE id=1 FOR UPDATE');
    const [settings] = await db.all('SELECT catalog_loaded FROM settings WHERE id=1');
    if (!settings.catalog_loaded) {
      for (const [name, category, unit, cost, minimum] of inventoryCatalog) {
        const existing = await db.all('SELECT id FROM products WHERE name=?', [name]);
        if (existing.length) {
          await db.run('UPDATE products SET category=?,unit=?,unit_cost=?,minimum=? WHERE id=?', [category, unit, cost, minimum, existing[0].id]);
        } else {
          await db.run('INSERT INTO products (name,category,unit,unit_cost,minimum,stock,created_at) VALUES (?,?,?,?,?,0,?)', [name, category, unit, cost, minimum, new Date().toISOString()]);
        }
      }
      await db.run('UPDATE settings SET catalog_loaded=1 WHERE id=1');
    }
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}

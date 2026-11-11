const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { computeOrderLinePricing, roundMoney } = require('../utils/units');
const { newGuid } = require('../utils/generators');

async function getCart(userId) {
  const [rows] = await pool.query(
    `SELECT ci.id, ci.vegetable_id, ci.quantity, ci.unit,
            v.name, v.image_url, v.unit AS default_unit, v.pack_size,
            v.base_unit, v.selling_price, v.status, v.is_deleted,
            c.name AS category_name
     FROM cart_items ci
     JOIN vegetables v ON v.id = ci.vegetable_id
     JOIN vegetable_categories c ON c.id = v.category_id
     WHERE ci.user_id = ? AND v.is_deleted = 0 AND v.status = 'ACTIVE'
     ORDER BY ci.created_at ASC`,
    [userId]
  );

  let subtotal = 0;
  const items = rows.map((row) => {
    const pricing = computeOrderLinePricing(row, row.quantity, row.unit);
    subtotal = roundMoney(subtotal + pricing.lineTotal);
    return {
      id: row.id,
      vegetable_id: row.vegetable_id,
      name: row.name,
      category_name: row.category_name,
      image_url: row.image_url,
      default_unit: row.default_unit,
      pack_size: Number(row.pack_size),
      selling_price: Number(row.selling_price),
      quantity: pricing.quantity,
      unit: pricing.unit,
      base_quantity: pricing.baseQuantity,
      base_unit: pricing.baseUnit,
      base_unit_price: pricing.baseUnitPrice,
      line_total: pricing.lineTotal,
    };
  });

  return {
    items,
    itemCount: items.length,
    subtotal,
  };
}

async function setCartItem(userId, { vegetableId, quantity, unit }) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    throw new AppError('Quantity cannot be negative.', 400);
  }

  return withTransaction(async (conn) => {
    const [vegRows] = await conn.query(
      'SELECT * FROM vegetables WHERE id = ? AND is_deleted = 0 AND status = "ACTIVE" LIMIT 1',
      [vegetableId]
    );
    if (vegRows.length === 0) {
      throw new AppError('Vegetable is unavailable or inactive.', 404);
    }
    const veg = vegRows[0];

    if (qty === 0) {
      await conn.query('DELETE FROM cart_items WHERE user_id = ? AND vegetable_id = ?', [
        userId,
        vegetableId,
      ]);
      return;
    }

    const chosenUnit = unit || veg.unit;
    // Validate compatibility and quantity > 0
    computeOrderLinePricing(veg, qty, chosenUnit);

    await conn.query(
      `INSERT INTO cart_items (id, user_id, vegetable_id, quantity, unit)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), unit = VALUES(unit)`,
      [newGuid(), userId, vegetableId, qty, chosenUnit]
    );
  }).then(() => getCart(userId));
}

async function removeCartItem(userId, vegetableId) {
  await pool.query('DELETE FROM cart_items WHERE user_id = ? AND vegetable_id = ?', [
    userId,
    vegetableId,
  ]);
  return getCart(userId);
}

async function clearCart(userId) {
  await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
  return { items: [], itemCount: 0, subtotal: 0 };
}

module.exports = {
  getCart,
  setCartItem,
  removeCartItem,
  clearCart,
};

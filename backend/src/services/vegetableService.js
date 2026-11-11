const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { getBaseUnit } = require('../utils/units');
const { logAudit } = require('../utils/audit');
const { newGuid } = require('../utils/generators');

// ==================== CATEGORIES ====================

async function listCategories(query = {}, actor = null) {
  const { includeDeleted, status, search } = query;
  const conditions = [];
  const params = [];

  if (actor?.role === 'SUPER_ADMIN' && includeDeleted === 'true') {
    // show deleted as well
  } else {
    conditions.push('c.is_deleted = 0');
  }

  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('c.name LIKE ?');
    params.push(`%${search.trim()}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM vegetables v WHERE v.category_id = c.id AND v.is_deleted = 0) AS vegetable_count
     FROM vegetable_categories c
     ${where}
     ORDER BY c.sort_order ASC, c.name ASC`,
    params
  );
  return rows;
}

async function createCategory(data, actor, ipAddress = null) {
  const { name, description = null, imageUrl = null, sortOrder = 0, status = 'ACTIVE' } = data;
  if (!name || !name.trim()) {
    throw new AppError('Category name is required.', 400);
  }

  return withTransaction(async (conn) => {
    const categoryId = newGuid();
    await conn.query(
      `INSERT INTO vegetable_categories (id, name, description, image_url, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [categoryId, name.trim(), description, imageUrl, Number(sortOrder) || 0, status]
    );
    const [rows] = await conn.query('SELECT * FROM vegetable_categories WHERE id = ?', [categoryId]);
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CATEGORY_CREATED',
        entity: 'vegetable_categories',
        entityId: categoryId,
        details: { name: name.trim() },
        ipAddress,
      },
      conn
    );
    return rows[0];
  });
}

async function updateCategory(id, data, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM vegetable_categories WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      throw new AppError('Category not found.', 404);
    }
    const cat = rows[0];
    await conn.query(
      `UPDATE vegetable_categories
       SET name = ?, description = ?, image_url = ?, sort_order = ?, status = ?
       WHERE id = ?`,
      [
        data.name !== undefined ? data.name.trim() : cat.name,
        data.description !== undefined ? data.description : cat.description,
        data.imageUrl !== undefined ? data.imageUrl : cat.image_url,
        data.sortOrder !== undefined ? Number(data.sortOrder) : cat.sort_order,
        data.status !== undefined ? data.status : cat.status,
        id,
      ]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CATEGORY_UPDATED',
        entity: 'vegetable_categories',
        entityId: id,
        details: { name: data.name || cat.name },
        ipAddress,
      },
      conn
    );
    const [updated] = await conn.query('SELECT * FROM vegetable_categories WHERE id = ?', [id]);
    return updated[0];
  });
}

async function softDeleteCategory(id, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM vegetable_categories WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      throw new AppError('Category not found.', 404);
    }
    const [vegRefs] = await conn.query(
      'SELECT id FROM vegetables WHERE category_id = ? AND is_deleted = 0 LIMIT 1',
      [id]
    );
    if (vegRefs.length > 0) {
      throw new AppError('Cannot delete category that still has active or existing vegetables.', 409);
    }
    await conn.query(
      'UPDATE vegetable_categories SET is_deleted = 1, deleted_at = NOW(), status = "INACTIVE" WHERE id = ?',
      [id]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CATEGORY_SOFT_DELETED',
        entity: 'vegetable_categories',
        entityId: id,
        details: { name: rows[0].name },
        ipAddress,
      },
      conn
    );
    return { message: 'Category soft-deleted successfully.' };
  });
}

async function restoreCategory(id, actor, ipAddress = null) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can restore deleted categories.', 403);
  }
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM vegetable_categories WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Category not found.', 404);
    await conn.query(
      'UPDATE vegetable_categories SET is_deleted = 0, deleted_at = NULL, status = "ACTIVE" WHERE id = ?',
      [id]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CATEGORY_RESTORED',
        entity: 'vegetable_categories',
        entityId: id,
        ipAddress,
      },
      conn
    );
    return { message: 'Category restored successfully.' };
  });
}

// ==================== VEGETABLES ====================

const STOCK_SUBQUERY = `
  COALESCE((SELECT SUM(sm.signed_quantity) FROM stock_movements sm WHERE sm.vegetable_id = v.id), 0)
`;

const RESERVED_SUBQUERY = `
  COALESCE((
    SELECT SUM(GREATEST(0, sa.allocated_base_quantity - sa.fulfilled_base_quantity))
    FROM stock_allocations sa
    JOIN customer_orders co ON co.id = sa.order_id
    WHERE sa.vegetable_id = v.id
      AND sa.status IN ('ALLOCATED', 'PARTIALLY_FULFILLED')
      AND co.status NOT IN ('CANCELLED', 'DELIVERED')
  ), 0)
`;

async function listVegetables(query = {}, actor = null, publicCatalog = false) {
  const { page, limit, offset } = parsePagination(query);
  const { search, categoryId, status, unit, includeDeleted } = query;

  const conditions = [];
  const params = [];

  if (!publicCatalog && actor?.role === 'SUPER_ADMIN' && includeDeleted === 'true') {
    // allow deleted
  } else {
    conditions.push('v.is_deleted = 0');
  }

  if (publicCatalog) {
    conditions.push("v.status = 'ACTIVE'");
    conditions.push("c.status = 'ACTIVE'");
    conditions.push('c.is_deleted = 0');
  } else if (status) {
    conditions.push('v.status = ?');
    params.push(status);
  }

  if (categoryId) {
    conditions.push('v.category_id = ?');
    params.push(String(categoryId));
  }
  if (unit) {
    conditions.push('v.unit = ?');
    params.push(unit);
  }
  if (search) {
    conditions.push('(v.name LIKE ? OR v.sku LIKE ? OR v.description LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM vegetables v
     JOIN vegetable_categories c ON c.id = v.category_id
     ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT v.*, c.name AS category_name,
            ${STOCK_SUBQUERY} AS current_stock,
            ${RESERVED_SUBQUERY} AS reserved_stock,
            GREATEST(0, ${STOCK_SUBQUERY} - ${RESERVED_SUBQUERY}) AS available_stock
     FROM vegetables v
     JOIN vegetable_categories c ON c.id = v.category_id
     ${where}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function getVegetableById(id, publicCatalog = false) {
  const extra = publicCatalog ? "AND v.is_deleted = 0 AND v.status = 'ACTIVE'" : '';
  const [rows] = await pool.query(
    `SELECT v.*, c.name AS category_name,
            ${STOCK_SUBQUERY} AS current_stock,
            ${RESERVED_SUBQUERY} AS reserved_stock,
            GREATEST(0, ${STOCK_SUBQUERY} - ${RESERVED_SUBQUERY}) AS available_stock
     FROM vegetables v
     JOIN vegetable_categories c ON c.id = v.category_id
     WHERE v.id = ? ${extra}
     LIMIT 1`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('Vegetable not found.', 404);
  }
  const veg = rows[0];

  if (publicCatalog) {
    return veg;
  }

  const [salesHistory] = await pool.query(
    `SELECT oi.id, co.order_number, co.status AS order_status, co.created_at,
            u.full_name AS customer_name, oi.quantity, oi.unit, oi.base_quantity,
            oi.delivered_base_quantity, oi.base_unit, oi.line_total
     FROM order_items oi
     JOIN customer_orders co ON co.id = oi.order_id
     JOIN users u ON u.id = co.customer_id
     WHERE oi.vegetable_id = ?
     ORDER BY co.created_at DESC
     LIMIT 50`,
    [id]
  );

  const [recentMovements] = await pool.query(
    `SELECT sm.*, u.full_name AS created_by_name
     FROM stock_movements sm
     LEFT JOIN users u ON u.id = sm.created_by
     WHERE sm.vegetable_id = ?
     ORDER BY sm.movement_date DESC, sm.created_at DESC
     LIMIT 30`,
    [id]
  );

  return { ...veg, salesHistory, recentMovements };
}

async function createVegetable(data, actor, ipAddress = null) {
  const {
    categoryId,
    name,
    sku = null,
    description = null,
    imageUrl = null,
    unit = 'KG',
    packSize = 1,
    sellingPrice,
    minStockThreshold = 0,
    status = 'ACTIVE',
  } = data;

  if (!categoryId || !name || sellingPrice === undefined) {
    throw new AppError('Category, vegetable name, and selling price are required.', 400);
  }
  if (Number(sellingPrice) < 0 || Number(packSize) <= 0 || Number(minStockThreshold) < 0) {
    throw new AppError('Prices and thresholds cannot be negative, and pack size must be > 0.', 400);
  }

  const baseUnit = getBaseUnit(unit);

  return withTransaction(async (conn) => {
    const [cat] = await conn.query(
      'SELECT id FROM vegetable_categories WHERE id = ? AND is_deleted = 0',
      [categoryId]
    );
    if (cat.length === 0) {
      throw new AppError('Selected category does not exist.', 404);
    }

    const cleanSku = sku && sku.trim() ? sku.trim().toUpperCase() : null;
    const vegId = newGuid();
    await conn.query(
      `INSERT INTO vegetables (
        id, category_id, name, sku, description, image_url, unit, pack_size,
        base_unit, selling_price, min_stock_threshold, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vegId,
        String(categoryId),
        name.trim(),
        cleanSku,
        description,
        imageUrl,
        unit,
        Number(packSize),
        baseUnit,
        Number(sellingPrice),
        Number(minStockThreshold),
        status,
      ]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'VEGETABLE_CREATED',
        entity: 'vegetables',
        entityId: vegId,
        details: { name: name.trim(), unit, packSize, sellingPrice },
        ipAddress,
      },
      conn
    );

    return vegId;
  }).then((id) => getVegetableById(id));
}

async function updateVegetable(id, data, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM vegetables WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) {
      throw new AppError('Vegetable not found.', 404);
    }
    const veg = rows[0];

    const nextUnit = data.unit !== undefined ? data.unit : veg.unit;
    const nextBaseUnit = getBaseUnit(nextUnit);

    // Prevent switching base_unit (KG <-> PIECE) if stock movements or orders exist
    if (nextBaseUnit !== veg.base_unit) {
      const [refs] = await conn.query(
        'SELECT id FROM stock_movements WHERE vegetable_id = ? LIMIT 1',
        [id]
      );
      if (refs.length > 0) {
        throw new AppError(
          'Cannot switch between weight (KG/GRAM) and PIECE after stock movements exist.',
          409
        );
      }
    }

    const nextPackSize = data.packSize !== undefined ? Number(data.packSize) : Number(veg.pack_size);
    const nextSellingPrice =
      data.sellingPrice !== undefined ? Number(data.sellingPrice) : Number(veg.selling_price);
    const nextThreshold =
      data.minStockThreshold !== undefined
        ? Number(data.minStockThreshold)
        : Number(veg.min_stock_threshold);

    if (nextPackSize <= 0 || nextSellingPrice < 0 || nextThreshold < 0) {
      throw new AppError('Invalid pack size, selling price, or threshold.', 400);
    }

    await conn.query(
      `UPDATE vegetables
       SET category_id = ?, name = ?, sku = ?, description = ?, image_url = ?,
           unit = ?, pack_size = ?, base_unit = ?, selling_price = ?,
           min_stock_threshold = ?, status = ?
       WHERE id = ?`,
      [
        data.categoryId !== undefined ? String(data.categoryId) : veg.category_id,
        data.name !== undefined ? data.name.trim() : veg.name,
        data.sku !== undefined ? (data.sku ? data.sku.trim().toUpperCase() : null) : veg.sku,
        data.description !== undefined ? data.description : veg.description,
        data.imageUrl !== undefined ? data.imageUrl : veg.image_url,
        nextUnit,
        nextPackSize,
        nextBaseUnit,
        nextSellingPrice,
        nextThreshold,
        data.status !== undefined ? data.status : veg.status,
        id,
      ]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'VEGETABLE_UPDATED',
        entity: 'vegetables',
        entityId: id,
        details: {
          name: data.name || veg.name,
          sellingPrice: nextSellingPrice,
          status: data.status || veg.status,
        },
        ipAddress,
      },
      conn
    );
  }).then(() => getVegetableById(id));
}

async function softDeleteVegetable(id, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM vegetables WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Vegetable not found.', 404);
    if (rows[0].is_deleted === 1) throw new AppError('Vegetable is already deleted.', 400);

    const [orderRefs] = await conn.query(
      'SELECT id FROM order_items WHERE vegetable_id = ? LIMIT 1',
      [id]
    );
    const [poRefs] = await conn.query(
      'SELECT id FROM purchase_items WHERE vegetable_id = ? LIMIT 1',
      [id]
    );
    const [smRefs] = await conn.query(
      'SELECT id FROM stock_movements WHERE vegetable_id = ? LIMIT 1',
      [id]
    );

    if (orderRefs.length > 0 || poRefs.length > 0 || smRefs.length > 0) {
      throw new AppError(
        'Cannot delete vegetable referenced by historical orders, purchases, or stock movements. Deactivate it instead.',
        409
      );
    }

    await conn.query(
      'UPDATE vegetables SET is_deleted = 1, deleted_at = NOW(), status = "INACTIVE" WHERE id = ?',
      [id]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'VEGETABLE_SOFT_DELETED',
        entity: 'vegetables',
        entityId: id,
        details: { name: rows[0].name },
        ipAddress,
      },
      conn
    );
    return { message: 'Vegetable soft-deleted successfully.' };
  });
}

async function restoreVegetable(id, actor, ipAddress = null) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can restore deleted vegetables.', 403);
  }
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM vegetables WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Vegetable not found.', 404);
    await conn.query(
      'UPDATE vegetables SET is_deleted = 0, deleted_at = NULL, status = "ACTIVE" WHERE id = ?',
      [id]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'VEGETABLE_RESTORED',
        entity: 'vegetables',
        entityId: id,
        ipAddress,
      },
      conn
    );
    return { message: 'Vegetable restored successfully.' };
  });
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  softDeleteCategory,
  restoreCategory,
  listVegetables,
  getVegetableById,
  createVegetable,
  updateVegetable,
  softDeleteVegetable,
  restoreVegetable,
};

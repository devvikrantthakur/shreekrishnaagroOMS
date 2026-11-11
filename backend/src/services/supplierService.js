const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { roundMoney } = require('../utils/units');
const { logAudit } = require('../utils/audit');
const { newGuid } = require('../utils/generators');

const SUPPLIER_RECEIVED_SUBQUERY = `
  COALESCE((
    SELECT SUM(
      CASE
        WHEN po.status IN ('RECEIVED', 'PARTIALLY_RECEIVED') THEN
          (SELECT COALESCE(SUM((pi.received_base_quantity / NULLIF(pi.base_quantity, 0)) * pi.line_total), 0)
           FROM purchase_items pi WHERE pi.purchase_order_id = po.id)
        ELSE 0
      END
    )
    FROM purchase_orders po
    WHERE po.supplier_id = s.id AND po.status != 'CANCELLED'
  ), 0)
`;

const SUPPLIER_PAID_SUBQUERY = `
  COALESCE((
    SELECT SUM(sp.amount)
    FROM supplier_payments sp
    WHERE sp.supplier_id = s.id AND sp.status = 'SUCCESS'
  ), 0)
`;

async function listSuppliers(query = {}, actor = null) {
  const { page, limit, offset } = parsePagination(query);
  const { search, status, includeDeleted } = query;
  const conditions = [];
  const params = [];

  if (actor?.role === 'SUPER_ADMIN' && includeDeleted === 'true') {
    // show deleted too
  } else {
    conditions.push('s.is_deleted = 0');
  }

  if (status) {
    conditions.push('s.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(s.supplier_name LIKE ? OR s.contact_person LIKE ? OR s.mobile LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM suppliers s ${where}`, params);
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT s.*,
            (${SUPPLIER_RECEIVED_SUBQUERY}) AS total_purchased_received,
            (${SUPPLIER_PAID_SUBQUERY}) AS total_paid,
            (s.opening_balance + (${SUPPLIER_RECEIVED_SUBQUERY}) - (${SUPPLIER_PAID_SUBQUERY})) AS outstanding_payable
     FROM suppliers s
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(
    rows.map((r) => ({
      ...r,
      opening_balance: roundMoney(r.opening_balance),
      total_purchased_received: roundMoney(r.total_purchased_received),
      total_paid: roundMoney(r.total_paid),
      outstanding_payable: roundMoney(r.outstanding_payable),
    })),
    total,
    page,
    limit
  );
}

async function getSupplierById(id) {
  const [rows] = await pool.query(
    `SELECT s.*,
            (${SUPPLIER_RECEIVED_SUBQUERY}) AS total_purchased_received,
            (${SUPPLIER_PAID_SUBQUERY}) AS total_paid,
            (s.opening_balance + (${SUPPLIER_RECEIVED_SUBQUERY}) - (${SUPPLIER_PAID_SUBQUERY})) AS outstanding_payable
     FROM suppliers s
     WHERE s.id = ? LIMIT 1`,
    [id]
  );
  if (rows.length === 0) throw new AppError('Supplier not found.', 404);
  const supplier = rows[0];

  const [purchases] = await pool.query(
    `SELECT id, purchase_number, supplier_invoice_ref, purchase_date, status, total_amount, created_at
     FROM purchase_orders
     WHERE supplier_id = ?
     ORDER BY purchase_date DESC, created_at DESC`,
    [id]
  );

  const [payments] = await pool.query(
    `SELECT sp.*, po.purchase_number
     FROM supplier_payments sp
     LEFT JOIN purchase_orders po ON po.id = sp.purchase_order_id
     WHERE sp.supplier_id = ?
     ORDER BY sp.payment_date DESC, sp.created_at DESC`,
    [id]
  );

  return {
    ...supplier,
    opening_balance: roundMoney(supplier.opening_balance),
    total_purchased_received: roundMoney(supplier.total_purchased_received),
    total_paid: roundMoney(supplier.total_paid),
    outstanding_payable: roundMoney(supplier.outstanding_payable),
    purchases,
    payments,
  };
}

async function createSupplier(data, actor, ipAddress = null) {
  const {
    supplierName,
    contactPerson = null,
    mobile,
    email = null,
    address = null,
    openingBalance = 0,
    status = 'ACTIVE',
  } = data;

  if (!supplierName || !mobile) {
    throw new AppError('Supplier name and mobile number are required.', 400);
  }

  return withTransaction(async (conn) => {
    const [dup] = await conn.query('SELECT id FROM suppliers WHERE mobile = ? LIMIT 1', [
      mobile.trim(),
    ]);
    if (dup.length > 0) {
      throw new AppError('A supplier with this mobile number already exists.', 409);
    }

    const supplierId = newGuid();
    await conn.query(
      `INSERT INTO suppliers (
        id, supplier_name, contact_person, mobile, email, address, opening_balance, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplierId,
        supplierName.trim(),
        contactPerson ? contactPerson.trim() : null,
        mobile.trim(),
        email ? email.trim().toLowerCase() : null,
        address,
        roundMoney(openingBalance || 0),
        status,
      ]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'SUPPLIER_CREATED',
        entity: 'suppliers',
        entityId: supplierId,
        details: { supplierName: supplierName.trim(), mobile: mobile.trim() },
        ipAddress,
      },
      conn
    );

    return supplierId;
  }).then((id) => getSupplierById(id));
}

async function updateSupplier(id, data, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM suppliers WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Supplier not found.', 404);
    const sup = rows[0];

    const nextMobile = data.mobile !== undefined ? data.mobile.trim() : sup.mobile;
    const [dup] = await conn.query('SELECT id FROM suppliers WHERE mobile = ? AND id != ? LIMIT 1', [
      nextMobile,
      id,
    ]);
    if (dup.length > 0) {
      throw new AppError('Another supplier already uses this mobile number.', 409);
    }

    await conn.query(
      `UPDATE suppliers
       SET supplier_name = ?, contact_person = ?, mobile = ?, email = ?,
           address = ?, opening_balance = ?, status = ?
       WHERE id = ?`,
      [
        data.supplierName !== undefined ? data.supplierName.trim() : sup.supplier_name,
        data.contactPerson !== undefined ? data.contactPerson : sup.contact_person,
        nextMobile,
        data.email !== undefined ? data.email : sup.email,
        data.address !== undefined ? data.address : sup.address,
        data.openingBalance !== undefined ? roundMoney(data.openingBalance) : sup.opening_balance,
        data.status !== undefined ? data.status : sup.status,
        id,
      ]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'SUPPLIER_UPDATED',
        entity: 'suppliers',
        entityId: id,
        details: { supplierName: data.supplierName || sup.supplier_name },
        ipAddress,
      },
      conn
    );
  }).then(() => getSupplierById(id));
}

async function softDeleteSupplier(id, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM suppliers WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Supplier not found.', 404);
    if (rows[0].is_deleted === 1) throw new AppError('Supplier is already deleted.', 400);

    const [poRefs] = await conn.query(
      'SELECT id FROM purchase_orders WHERE supplier_id = ? LIMIT 1',
      [id]
    );
    const [payRefs] = await conn.query(
      'SELECT id FROM supplier_payments WHERE supplier_id = ? LIMIT 1',
      [id]
    );
    if (poRefs.length > 0 || payRefs.length > 0) {
      throw new AppError(
        'Cannot delete supplier referenced by purchase orders or supplier payments. Deactivate instead.',
        409
      );
    }

    await conn.query(
      'UPDATE suppliers SET is_deleted = 1, deleted_at = NOW(), status = "INACTIVE" WHERE id = ?',
      [id]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'SUPPLIER_SOFT_DELETED',
        entity: 'suppliers',
        entityId: id,
        ipAddress,
      },
      conn
    );
    return { message: 'Supplier soft-deleted successfully.' };
  });
}

async function restoreSupplier(id, actor, ipAddress = null) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can restore deleted suppliers.', 403);
  }
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM suppliers WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Supplier not found.', 404);
    await conn.query(
      'UPDATE suppliers SET is_deleted = 0, deleted_at = NULL, status = "ACTIVE" WHERE id = ?',
      [id]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'SUPPLIER_RESTORED',
        entity: 'suppliers',
        entityId: id,
        ipAddress,
      },
      conn
    );
    return { message: 'Supplier restored successfully.' };
  });
}

module.exports = {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
  restoreSupplier,
};

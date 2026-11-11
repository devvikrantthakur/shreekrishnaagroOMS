const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { roundMoney } = require('../utils/units');
const { logAudit } = require('../utils/audit');
const { newGuid } = require('../utils/generators');

const EXPENSE_CATEGORIES = [
  'Transportation',
  'Labour',
  'Rent',
  'Packaging',
  'Electricity',
  'Maintenance',
  'Other',
];

async function listExpenses(query = {}, actor = null) {
  const { page, limit, offset } = parsePagination(query);
  const { category, dateFrom, dateTo, search, includeDeleted } = query;

  const conditions = [];
  const params = [];

  if (actor?.role === 'SUPER_ADMIN' && includeDeleted === 'true') {
    // allow deleted
  } else {
    conditions.push('e.is_deleted = 0');
  }

  if (category) {
    conditions.push('e.category = ?');
    params.push(category);
  }
  if (dateFrom) {
    conditions.push('e.expense_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('e.expense_date <= ?');
    params.push(dateTo);
  }
  if (search) {
    conditions.push('(e.title LIKE ? OR e.remarks LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM expenses e ${where}`, params);
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT e.*, u.full_name AS created_by_name
     FROM expenses e
     LEFT JOIN users u ON u.id = e.created_by
     ${where}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [summaryRows] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS total_amount
     FROM expenses e ${where}`,
    params
  );

  return {
    ...paginatedResponse(rows, total, page, limit),
    totalAmount: roundMoney(summaryRows[0].total_amount),
  };
}

async function createExpense(data, actor, ipAddress = null) {
  const { title, category, amount, expenseDate, paymentMethod = 'CASH', remarks = null } = data;
  const amt = roundMoney(amount);

  if (!title || !title.trim() || !EXPENSE_CATEGORIES.includes(category)) {
    throw new AppError('Valid title and expense category are required.', 400);
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new AppError('Expense amount must be greater than zero.', 400);
  }
  if (!['CASH', 'UPI', 'BANK_TRANSFER'].includes(paymentMethod)) {
    throw new AppError('Invalid payment method.', 400);
  }

  const expDate = expenseDate || new Date().toISOString().slice(0, 10);

  return withTransaction(async (conn) => {
    const expenseId = newGuid();
    await conn.query(
      `INSERT INTO expenses (id, title, category, amount, expense_date, payment_method, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [expenseId, title.trim(), category, amt, expDate, paymentMethod, remarks, actor.id]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'EXPENSE_CREATED',
        entity: 'expenses',
        entityId: expenseId,
        details: { title: title.trim(), category, amount: amt, expenseDate: expDate },
        ipAddress,
      },
      conn
    );
    const [rows] = await conn.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    return rows[0];
  });
}

async function updateExpense(id, data, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM expenses WHERE id = ? AND is_deleted = 0 FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Expense not found.', 404);
    const exp = rows[0];

    const nextCategory = data.category !== undefined ? data.category : exp.category;
    if (!EXPENSE_CATEGORIES.includes(nextCategory)) {
      throw new AppError('Invalid expense category.', 400);
    }
    const nextAmount = data.amount !== undefined ? roundMoney(data.amount) : Number(exp.amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new AppError('Expense amount must be greater than zero.', 400);
    }

    await conn.query(
      `UPDATE expenses
       SET title = ?, category = ?, amount = ?, expense_date = ?, payment_method = ?, remarks = ?
       WHERE id = ?`,
      [
        data.title !== undefined ? data.title.trim() : exp.title,
        nextCategory,
        nextAmount,
        data.expenseDate !== undefined ? data.expenseDate : exp.expense_date,
        data.paymentMethod !== undefined ? data.paymentMethod : exp.payment_method,
        data.remarks !== undefined ? data.remarks : exp.remarks,
        id,
      ]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'EXPENSE_UPDATED',
        entity: 'expenses',
        entityId: id,
        details: { title: data.title || exp.title, amount: nextAmount },
        ipAddress,
      },
      conn
    );
    const [updated] = await conn.query('SELECT * FROM expenses WHERE id = ?', [id]);
    return updated[0];
  });
}

async function softDeleteExpense(id, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM expenses WHERE id = ? AND is_deleted = 0 FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Expense not found.', 404);
    await conn.query('UPDATE expenses SET is_deleted = 1, deleted_at = NOW() WHERE id = ?', [id]);
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'EXPENSE_SOFT_DELETED',
        entity: 'expenses',
        entityId: id,
        details: { title: rows[0].title, amount: rows[0].amount },
        ipAddress,
      },
      conn
    );
    return { message: 'Expense soft-deleted successfully.' };
  });
}

async function restoreExpense(id, actor, ipAddress = null) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can restore deleted expenses.', 403);
  }
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM expenses WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new AppError('Expense not found.', 404);
    await conn.query('UPDATE expenses SET is_deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'EXPENSE_RESTORED',
        entity: 'expenses',
        entityId: id,
        ipAddress,
      },
      conn
    );
    return { message: 'Expense restored successfully.' };
  });
}

module.exports = {
  EXPENSE_CATEGORIES,
  listExpenses,
  createExpense,
  updateExpense,
  softDeleteExpense,
  restoreExpense,
};

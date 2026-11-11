const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const { newGuid } = require('../utils/generators');

async function countActiveSuperAdmins(conn = pool) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM users
     WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE' AND is_deleted = 0`
  );
  return Number(rows[0].cnt);
}

async function listUsers(query, actor) {
  const { page, limit, offset } = parsePagination(query);
  const { search, role, status, includeDeleted } = query;

  const conditions = [];
  const params = [];

  if (actor.role === 'SUPER_ADMIN' && includeDeleted === 'true') {
    // allow viewing deleted
  } else {
    conditions.push('u.is_deleted = 0');
  }

  // Regular ADMIN can view customers and admins? Prompt: "View all customers and admins according to permissions."
  // Let ADMIN view CUSTOMER (and ADMIN if needed, or restrict ADMIN from seeing/modifying SUPER_ADMIN)
  if (actor.role !== 'SUPER_ADMIN') {
    conditions.push("u.role != 'SUPER_ADMIN'");
  }

  if (role) {
    conditions.push('u.role = ?');
    params.push(role);
  }
  if (status) {
    conditions.push('u.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)');
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.mobile, u.role, u.status,
            u.is_deleted, u.deleted_at, u.created_at, u.updated_at,
            (SELECT COUNT(*) FROM customer_orders co WHERE co.customer_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(co.total_amount), 0) FROM customer_orders co WHERE co.customer_id = u.id AND co.status != 'CANCELLED') AS total_order_value
     FROM users u
     ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return paginatedResponse(rows, total, page, limit);
}

async function createUser(data, actor, ipAddress = null) {
  const { fullName, email, mobile, password, role = 'CUSTOMER', status = 'ACTIVE' } = data;
  if (!fullName || !email || !mobile || !password) {
    throw new AppError('Full name, email, mobile, and password are required.', 400);
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters.', 400);
  }

  const targetRole = role.toUpperCase();
  if (!['SUPER_ADMIN', 'ADMIN', 'CUSTOMER'].includes(targetRole)) {
    throw new AppError('Invalid role specified.', 400);
  }
  if ((targetRole === 'ADMIN' || targetRole === 'SUPER_ADMIN') && actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can create ADMIN or SUPER_ADMIN accounts.', 403);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMobile = mobile.trim();

  const [dup] = await pool.query(
    'SELECT id FROM users WHERE email = ? OR mobile = ? LIMIT 1',
    [normalizedEmail, normalizedMobile]
  );
  if (dup.length > 0) {
    throw new AppError('Duplicate email or mobile number is not allowed.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return withTransaction(async (conn) => {
    const userId = newGuid();
    await conn.query(
      `INSERT INTO users (id, full_name, email, mobile, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName.trim(), normalizedEmail, normalizedMobile, passwordHash, targetRole, status]
    );
    const [rows] = await conn.query(
      'SELECT id, full_name, email, mobile, role, status, is_deleted, created_at FROM users WHERE id = ?',
      [userId]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'USER_CREATED',
        entity: 'users',
        entityId: userId,
        details: { role: targetRole, email: normalizedEmail, mobile: normalizedMobile },
        ipAddress,
      },
      conn
    );
    return rows[0];
  });
}

async function getUserById(userId, actor) {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, mobile, role, status, is_deleted, deleted_at, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError('User not found.', 404);
  }
  const user = rows[0];
  if (user.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Access denied.', 403);
  }

  const [addresses] = await pool.query(
    `SELECT id, label, recipient_name, mobile, address_line1, address_line2,
            city, state, pincode, latitude, longitude, is_default, is_deleted, created_at
     FROM customer_addresses
     WHERE user_id = ? AND is_deleted = 0
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );

  const [orders] = await pool.query(
    `SELECT id, order_number, status, total_amount, created_at
     FROM customer_orders
     WHERE customer_id = ?
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );

  return { ...user, addresses, orders };
}

async function updateUser(userId, data, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (rows.length === 0) {
      throw new AppError('User not found.', 404);
    }
    const target = rows[0];
    if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new AppError('Only SUPER_ADMIN can edit a SUPER_ADMIN account.', 403);
    }

    const nextName = data.fullName !== undefined ? data.fullName.trim() : target.full_name;
    const nextEmail = data.email !== undefined ? data.email.trim().toLowerCase() : target.email;
    const nextMobile = data.mobile !== undefined ? data.mobile.trim() : target.mobile;
    const nextRole = data.role !== undefined ? data.role.toUpperCase() : target.role;
    const nextStatus = data.status !== undefined ? data.status.toUpperCase() : target.status;

    if (nextRole !== target.role && actor.role !== 'SUPER_ADMIN') {
      throw new AppError('Only SUPER_ADMIN can change user roles.', 403);
    }

    // Protect last active SUPER_ADMIN
    if (
      target.role === 'SUPER_ADMIN' &&
      target.status === 'ACTIVE' &&
      target.is_deleted === 0 &&
      (nextRole !== 'SUPER_ADMIN' || nextStatus !== 'ACTIVE')
    ) {
      const activeCount = await countActiveSuperAdmins(conn);
      if (activeCount <= 1) {
        throw new AppError('Cannot deactivate or demote the last active SUPER_ADMIN.', 400);
      }
    }

    const [dup] = await conn.query(
      'SELECT id FROM users WHERE (email = ? OR mobile = ?) AND id != ? LIMIT 1',
      [nextEmail, nextMobile, userId]
    );
    if (dup.length > 0) {
      throw new AppError('Duplicate email or mobile number is not allowed.', 409);
    }

    let nextPasswordHash = target.password_hash;
    if (data.password && data.password.trim().length > 0) {
      if (data.password.length < 6) {
        throw new AppError('Password must be at least 6 characters.', 400);
      }
      nextPasswordHash = await bcrypt.hash(data.password, 10);
    }

    await conn.query(
      `UPDATE users
       SET full_name = ?, email = ?, mobile = ?, role = ?, status = ?, password_hash = ?
       WHERE id = ?`,
      [nextName, nextEmail, nextMobile, nextRole, nextStatus, nextPasswordHash, userId]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'USER_UPDATED',
        entity: 'users',
        entityId: userId,
        details: {
          full_name: nextName,
          email: nextEmail,
          mobile: nextMobile,
          role: nextRole,
          status: nextStatus,
        },
        ipAddress,
      },
      conn
    );

    const [updated] = await conn.query(
      'SELECT id, full_name, email, mobile, role, status, is_deleted, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );
    return updated[0];
  });
}

async function softDeleteUser(userId, actor, ipAddress = null) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (rows.length === 0) {
      throw new AppError('User not found.', 404);
    }
    const target = rows[0];
    if (target.is_deleted === 1) {
      throw new AppError('User is already deleted.', 400);
    }
    if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new AppError('Only SUPER_ADMIN can delete a SUPER_ADMIN.', 403);
    }
    if (String(userId) === String(actor.id)) {
      throw new AppError('You cannot delete your own account.', 400);
    }
    if (target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE') {
      const activeCount = await countActiveSuperAdmins(conn);
      if (activeCount <= 1) {
        throw new AppError('Cannot delete the last active SUPER_ADMIN.', 400);
      }
    }

    // Check historical transaction references
    const [orderRefs] = await conn.query(
      'SELECT id FROM customer_orders WHERE customer_id = ? LIMIT 1',
      [userId]
    );
    const [poRefs] = await conn.query(
      'SELECT id FROM purchase_orders WHERE created_by = ? LIMIT 1',
      [userId]
    );
    const [payRefs] = await conn.query(
      'SELECT id FROM payments WHERE customer_id = ? LIMIT 1',
      [userId]
    );
    if (orderRefs.length > 0 || poRefs.length > 0 || payRefs.length > 0) {
      throw new AppError(
        'Cannot delete user referenced by historical orders, purchases, or payments. Deactivate the account instead.',
        409
      );
    }

    await conn.query(
      'UPDATE users SET is_deleted = 1, deleted_at = NOW(), status = "INACTIVE" WHERE id = ?',
      [userId]
    );

    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'USER_SOFT_DELETED',
        entity: 'users',
        entityId: userId,
        details: { email: target.email, role: target.role },
        ipAddress,
      },
      conn
    );
    return { message: 'User soft-deleted successfully.' };
  });
}

async function restoreUser(userId, actor, ipAddress = null) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new AppError('Only SUPER_ADMIN can restore deleted users.', 403);
  }
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (rows.length === 0) {
      throw new AppError('User not found.', 404);
    }
    if (rows[0].is_deleted === 0) {
      throw new AppError('User is not deleted.', 400);
    }

    await conn.query(
      'UPDATE users SET is_deleted = 0, deleted_at = NULL, status = "ACTIVE" WHERE id = ?',
      [userId]
    );
    await logAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'USER_RESTORED',
        entity: 'users',
        entityId: userId,
        details: { email: rows[0].email },
        ipAddress,
      },
      conn
    );
    return { message: 'User restored successfully.' };
  });
}

// Address management (self or admin)
async function listAddresses(userId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, label, recipient_name, mobile, address_line1, address_line2,
            city, state, pincode, latitude, longitude, is_default, created_at, updated_at
     FROM customer_addresses
     WHERE user_id = ? AND is_deleted = 0
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

async function createAddress(userId, data) {
  const {
    label = 'Home',
    recipientName,
    mobile,
    addressLine1,
    addressLine2 = null,
    city,
    state,
    pincode,
    latitude = null,
    longitude = null,
    isDefault = false,
  } = data;

  if (!recipientName || !mobile || !addressLine1 || !city || !state || !pincode) {
    throw new AppError('Recipient name, mobile, address line 1, city, state, and pincode are required.', 400);
  }

  const parsedLat = latitude !== null && latitude !== '' && Number.isFinite(Number(latitude)) ? Number(latitude) : null;
  const parsedLng = longitude !== null && longitude !== '' && Number.isFinite(Number(longitude)) ? Number(longitude) : null;

  return withTransaction(async (conn) => {
    const [existing] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM customer_addresses WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );
    const shouldBeDefault = isDefault || Number(existing[0].cnt) === 0 ? 1 : 0;

    if (shouldBeDefault) {
      await conn.query('UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const addressId = newGuid();
    await conn.query(
      `INSERT INTO customer_addresses (
        id, user_id, label, recipient_name, mobile, address_line1, address_line2,
        city, state, pincode, latitude, longitude, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        addressId,
        userId,
        label.trim(),
        recipientName.trim(),
        mobile.trim(),
        addressLine1.trim(),
        addressLine2 ? addressLine2.trim() : null,
        city.trim(),
        state.trim(),
        pincode.trim(),
        parsedLat,
        parsedLng,
        shouldBeDefault,
      ]
    );
    const [rows] = await conn.query('SELECT * FROM customer_addresses WHERE id = ?', [addressId]);
    return rows[0];
  });
}

async function updateAddress(userId, addressId, data) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT * FROM customer_addresses WHERE id = ? AND user_id = ? AND is_deleted = 0 FOR UPDATE',
      [addressId, userId]
    );
    if (rows.length === 0) {
      throw new AppError('Address not found.', 404);
    }
    const addr = rows[0];
    const isDef = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : addr.is_default;
    if (isDef === 1) {
      await conn.query('UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const nextLat =
      data.latitude !== undefined
        ? data.latitude !== null && data.latitude !== '' && Number.isFinite(Number(data.latitude))
          ? Number(data.latitude)
          : null
        : addr.latitude;
    const nextLng =
      data.longitude !== undefined
        ? data.longitude !== null && data.longitude !== '' && Number.isFinite(Number(data.longitude))
          ? Number(data.longitude)
          : null
        : addr.longitude;

    await conn.query(
      `UPDATE customer_addresses
       SET label = ?, recipient_name = ?, mobile = ?, address_line1 = ?, address_line2 = ?,
           city = ?, state = ?, pincode = ?, latitude = ?, longitude = ?, is_default = ?
       WHERE id = ?`,
      [
        data.label ?? addr.label,
        data.recipientName ?? addr.recipient_name,
        data.mobile ?? addr.mobile,
        data.addressLine1 ?? addr.address_line1,
        data.addressLine2 !== undefined ? data.addressLine2 : addr.address_line2,
        data.city ?? addr.city,
        data.state ?? addr.state,
        data.pincode ?? addr.pincode,
        nextLat,
        nextLng,
        isDef,
        addressId,
      ]
    );
    const [updated] = await conn.query('SELECT * FROM customer_addresses WHERE id = ?', [addressId]);
    return updated[0];
  });
}

async function softDeleteAddress(userId, addressId) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT * FROM customer_addresses WHERE id = ? AND user_id = ? AND is_deleted = 0 FOR UPDATE',
      [addressId, userId]
    );
    if (rows.length === 0) {
      throw new AppError('Address not found.', 404);
    }
    await conn.query(
      'UPDATE customer_addresses SET is_deleted = 1, deleted_at = NOW(), is_default = 0 WHERE id = ?',
      [addressId]
    );
    return { message: 'Address deleted successfully.' };
  });
}

module.exports = {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  softDeleteUser,
  restoreUser,
  listAddresses,
  createAddress,
  updateAddress,
  softDeleteAddress,
};

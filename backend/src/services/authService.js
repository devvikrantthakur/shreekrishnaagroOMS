const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { pool, withTransaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { logAudit } = require('../utils/audit');
const { newGuid } = require('../utils/generators');

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function registerCustomer({ fullName, email, mobile, password }, ipAddress = null) {
  if (!fullName || !email || !mobile || !password) {
    throw new AppError('Full name, email, mobile, and password are required.', 400);
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedMobile = String(mobile).trim();

  const [existing] = await pool.query(
    'SELECT id, email, mobile FROM users WHERE email = ? OR mobile = ? LIMIT 1',
    [normalizedEmail, normalizedMobile]
  );
  if (existing.length > 0) {
    throw new AppError('An account with this email or mobile number already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await withTransaction(async (conn) => {
    const userId = newGuid();
    await conn.query(
      `INSERT INTO users (id, full_name, email, mobile, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')`,
      [userId, fullName.trim(), normalizedEmail, normalizedMobile, passwordHash]
    );
    const [rows] = await conn.query(
      'SELECT id, full_name, email, mobile, role, status, is_deleted, created_at FROM users WHERE id = ?',
      [userId]
    );
    await logAudit(
      {
        actorId: userId,
        actorRole: 'CUSTOMER',
        action: 'CUSTOMER_REGISTERED',
        entity: 'users',
        entityId: userId,
        details: { email: normalizedEmail, mobile: normalizedMobile },
        ipAddress,
      },
      conn
    );
    return rows[0];
  });

  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

async function login({ identifier, password }) {
  if (!identifier || !password) {
    throw new AppError('Email/mobile and password are required.', 400);
  }
  const cleanId = String(identifier).trim();
  const [rows] = await pool.query(
    `SELECT id, full_name, email, mobile, password_hash, role, status, is_deleted, created_at
     FROM users
     WHERE (email = ? OR mobile = ?)
     LIMIT 1`,
    [cleanId.toLowerCase(), cleanId]
  );

  if (rows.length === 0) {
    throw new AppError('Invalid credentials.', 401);
  }

  const user = rows[0];
  if (user.is_deleted === 1) {
    throw new AppError('This account has been deleted. Contact support.', 403);
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('This account is deactivated. Contact administrator.', 403);
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Invalid credentials.', 401);
  }

  const token = signToken(user);
  return { user: sanitizeUser(user), token };
}

async function getProfile(userId) {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, mobile, role, status, created_at, updated_at
     FROM users
     WHERE id = ? AND is_deleted = 0 LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError('User not found.', 404);
  }
  const [addresses] = await pool.query(
    `SELECT id, user_id, label, recipient_name, mobile, address_line1, address_line2,
            city, state, pincode, latitude, longitude, is_default, created_at
     FROM customer_addresses
     WHERE user_id = ? AND is_deleted = 0
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return { ...rows[0], addresses };
}

async function updateProfile(userId, { fullName, email, mobile }) {
  const [current] = await pool.query('SELECT * FROM users WHERE id = ? AND is_deleted = 0', [userId]);
  if (current.length === 0) {
    throw new AppError('User not found.', 404);
  }
  const user = current[0];
  const nextName = fullName ? fullName.trim() : user.full_name;
  const nextEmail = email ? email.trim().toLowerCase() : user.email;
  const nextMobile = mobile ? mobile.trim() : user.mobile;

  const [dup] = await pool.query(
    'SELECT id FROM users WHERE (email = ? OR mobile = ?) AND id != ? LIMIT 1',
    [nextEmail, nextMobile, userId]
  );
  if (dup.length > 0) {
    throw new AppError('Email or mobile number already in use by another account.', 409);
  }

  await pool.query(
    'UPDATE users SET full_name = ?, email = ?, mobile = ? WHERE id = ?',
    [nextName, nextEmail, nextMobile, userId]
  );

  return getProfile(userId);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    throw new AppError('Current password and a new password (min 6 chars) are required.', 400);
  }
  const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE id = ? AND is_deleted = 0', [
    userId,
  ]);
  if (rows.length === 0) {
    throw new AppError('User not found.', 404);
  }
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) {
    throw new AppError('Current password is incorrect.', 400);
  }
  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
  return { message: 'Password updated successfully.' };
}

async function reverseGeocode(latRaw, lngRaw) {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError('Valid latitude and longitude are required.', 400);
  }

  // Try OpenStreetMap Nominatim first
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ShreeKrishnaAgroOMS/1.0 (contact@shreekrishnaagro.local)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const line1Parts = [
        addr.house_number,
        addr.building,
        addr.road || addr.street || addr.pedestrian,
        addr.neighbourhood || addr.suburb || addr.residential,
      ].filter(Boolean);
      const line2Parts = [addr.county || addr.state_district, addr.country].filter(Boolean);
      const city =
        addr.city || addr.town || addr.village || addr.municipality || addr.state_district || '';
      const state = addr.state || '';
      const pincode = addr.postcode || '';
      return {
        latitude: Number(lat.toFixed(7)),
        longitude: Number(lng.toFixed(7)),
        addressLine1: line1Parts.join(', ') || (data.display_name ? data.display_name.split(',').slice(0, 2).join(', ').trim() : ''),
        addressLine2: line2Parts.join(', '),
        city,
        state,
        pincode,
        formattedAddress: data.display_name || '',
        provider: 'nominatim',
        fallback: false,
      };
    }
  } catch {
    // Fallback to BigDataCloud
  }

  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      return {
        latitude: Number(lat.toFixed(7)),
        longitude: Number(lng.toFixed(7)),
        addressLine1: data.locality || '',
        addressLine2: data.principalSubdivision || '',
        city: data.city || data.locality || '',
        state: data.principalSubdivision || '',
        pincode: data.postcode || '',
        formattedAddress: [data.locality, data.city, data.principalSubdivision, data.countryName]
          .filter(Boolean)
          .join(', '),
        provider: 'bigdatacloud',
        fallback: false,
      };
    }
  } catch {
    // Fallback to raw coordinates
  }

  return {
    latitude: Number(lat.toFixed(7)),
    longitude: Number(lng.toFixed(7)),
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    formattedAddress: `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    provider: 'coordinates',
    fallback: true,
  };
}

module.exports = {
  registerCustomer,
  login,
  getProfile,
  updateProfile,
  changePassword,
  reverseGeocode,
};

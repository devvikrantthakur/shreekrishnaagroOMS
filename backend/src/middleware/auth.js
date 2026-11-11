const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { pool } = require('../config/db');
const { AppError } = require('./errorHandler');

async function verifyTokenAndLoadUser(token) {
  const decoded = jwt.verify(token, env.jwtSecret);
  const [rows] = await pool.query(
    `SELECT id, full_name, email, mobile, role, status, is_deleted
     FROM users
     WHERE id = ? LIMIT 1`,
    [decoded.userId]
  );
  if (rows.length === 0) {
    throw new AppError('Authentication failed: user not found.', 401);
  }
  const user = rows[0];
  if (user.is_deleted === 1 || user.status !== 'ACTIVE') {
    throw new AppError('Account is inactive or deleted.', 403);
  }
  return user;
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return next(new AppError('Authentication token required.', 401));
    }
    req.user = await verifyTokenAndLoadUser(token);
    return next();
  } catch (err) {
    return next(err.isOperational ? err : new AppError('Invalid or expired token.', 401));
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (token) {
      req.user = await verifyTokenAndLoadUser(token);
    }
  } catch (_) {
    // ignore invalid optional token
  }
  return next();
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Access denied: insufficient permissions.', 403));
    }
    return next();
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  authorizeRoles,
};

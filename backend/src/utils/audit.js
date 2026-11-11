const crypto = require('crypto');
const { pool } = require('../config/db');

async function logAudit(
  { actorId = null, actorRole = null, action, entity, entityId = null, details = null, ipAddress = null },
  conn = null
) {
  const executor = conn || pool;
  await executor.query(
    `INSERT INTO audit_logs (id, actor_id, actor_role, action, entity, entity_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      actorId ? String(actorId) : null,
      actorRole,
      action,
      entity,
      entityId ? String(entityId) : null,
      details ? JSON.stringify(details) : null,
      ipAddress,
    ]
  );
}

module.exports = { logAudit };

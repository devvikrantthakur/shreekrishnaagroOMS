const crypto = require('crypto');

const ALL_TABLES = [
  'company_settings',
  'users',
  'customer_addresses',
  'vegetable_categories',
  'vegetables',
  'suppliers',
  'cart_items',
  'customer_orders',
  'order_items',
  'purchase_orders',
  'purchase_items',
  'supplier_payments',
  'stock_movements',
  'stock_allocations',
  'deliveries',
  'delivery_items',
  'payments',
  'payment_refunds',
  'invoices',
  'expenses',
  'audit_logs',
];

const FK_COLUMNS = [
  { table: 'customer_addresses', column: 'user_id', refTable: 'users', nullable: false },
  { table: 'vegetables', column: 'category_id', refTable: 'vegetable_categories', nullable: false },
  { table: 'cart_items', column: 'user_id', refTable: 'users', nullable: false },
  { table: 'cart_items', column: 'vegetable_id', refTable: 'vegetables', nullable: false },
  { table: 'customer_orders', column: 'customer_id', refTable: 'users', nullable: false },
  { table: 'customer_orders', column: 'address_id', refTable: 'customer_addresses', nullable: true },
  { table: 'customer_orders', column: 'created_by', refTable: 'users', nullable: true },
  { table: 'order_items', column: 'order_id', refTable: 'customer_orders', nullable: false },
  { table: 'order_items', column: 'vegetable_id', refTable: 'vegetables', nullable: false },
  { table: 'purchase_orders', column: 'supplier_id', refTable: 'suppliers', nullable: false },
  { table: 'purchase_orders', column: 'created_by', refTable: 'users', nullable: false },
  { table: 'purchase_items', column: 'purchase_order_id', refTable: 'purchase_orders', nullable: false },
  { table: 'purchase_items', column: 'vegetable_id', refTable: 'vegetables', nullable: false },
  { table: 'supplier_payments', column: 'supplier_id', refTable: 'suppliers', nullable: false },
  { table: 'supplier_payments', column: 'purchase_order_id', refTable: 'purchase_orders', nullable: true },
  { table: 'supplier_payments', column: 'created_by', refTable: 'users', nullable: false },
  { table: 'stock_movements', column: 'vegetable_id', refTable: 'vegetables', nullable: false },
  { table: 'stock_movements', column: 'created_by', refTable: 'users', nullable: true },
  { table: 'stock_allocations', column: 'order_id', refTable: 'customer_orders', nullable: false },
  { table: 'stock_allocations', column: 'order_item_id', refTable: 'order_items', nullable: false },
  { table: 'stock_allocations', column: 'vegetable_id', refTable: 'vegetables', nullable: false },
  { table: 'deliveries', column: 'order_id', refTable: 'customer_orders', nullable: false },
  { table: 'deliveries', column: 'created_by', refTable: 'users', nullable: false },
  { table: 'delivery_items', column: 'delivery_id', refTable: 'deliveries', nullable: false },
  { table: 'delivery_items', column: 'order_item_id', refTable: 'order_items', nullable: false },
  { table: 'delivery_items', column: 'vegetable_id', refTable: 'vegetables', nullable: false },
  { table: 'payments', column: 'order_id', refTable: 'customer_orders', nullable: false },
  { table: 'payments', column: 'customer_id', refTable: 'users', nullable: false },
  { table: 'payments', column: 'created_by', refTable: 'users', nullable: true },
  { table: 'payment_refunds', column: 'payment_id', refTable: 'payments', nullable: false },
  { table: 'payment_refunds', column: 'order_id', refTable: 'customer_orders', nullable: false },
  { table: 'payment_refunds', column: 'customer_id', refTable: 'users', nullable: false },
  { table: 'payment_refunds', column: 'created_by', refTable: 'users', nullable: false },
  { table: 'invoices', column: 'order_id', refTable: 'customer_orders', nullable: false },
  { table: 'invoices', column: 'customer_id', refTable: 'users', nullable: false },
  { table: 'invoices', column: 'created_by', refTable: 'users', nullable: false },
  { table: 'expenses', column: 'created_by', refTable: 'users', nullable: false },
  { table: 'audit_logs', column: 'actor_id', refTable: 'users', nullable: true },
];

const FK_CONSTRAINTS = [
  { table: 'customer_addresses', name: 'fk_customer_addresses_user', column: 'user_id', refTable: 'users' },
  { table: 'vegetables', name: 'fk_vegetables_category', column: 'category_id', refTable: 'vegetable_categories' },
  { table: 'cart_items', name: 'fk_cart_items_user', column: 'user_id', refTable: 'users' },
  { table: 'cart_items', name: 'fk_cart_items_vegetable', column: 'vegetable_id', refTable: 'vegetables' },
  { table: 'customer_orders', name: 'fk_customer_orders_customer', column: 'customer_id', refTable: 'users' },
  { table: 'customer_orders', name: 'fk_customer_orders_address', column: 'address_id', refTable: 'customer_addresses' },
  { table: 'order_items', name: 'fk_order_items_order', column: 'order_id', refTable: 'customer_orders' },
  { table: 'order_items', name: 'fk_order_items_vegetable', column: 'vegetable_id', refTable: 'vegetables' },
  { table: 'purchase_orders', name: 'fk_purchase_orders_supplier', column: 'supplier_id', refTable: 'suppliers' },
  { table: 'purchase_orders', name: 'fk_purchase_orders_creator', column: 'created_by', refTable: 'users' },
  { table: 'purchase_items', name: 'fk_purchase_items_po', column: 'purchase_order_id', refTable: 'purchase_orders' },
  { table: 'purchase_items', name: 'fk_purchase_items_vegetable', column: 'vegetable_id', refTable: 'vegetables' },
  { table: 'supplier_payments', name: 'fk_supplier_payments_supplier', column: 'supplier_id', refTable: 'suppliers' },
  { table: 'supplier_payments', name: 'fk_supplier_payments_po', column: 'purchase_order_id', refTable: 'purchase_orders' },
  { table: 'supplier_payments', name: 'fk_supplier_payments_creator', column: 'created_by', refTable: 'users' },
  { table: 'stock_movements', name: 'fk_stock_movements_vegetable', column: 'vegetable_id', refTable: 'vegetables' },
  { table: 'stock_movements', name: 'fk_stock_movements_creator', column: 'created_by', refTable: 'users' },
  { table: 'stock_allocations', name: 'fk_stock_allocations_order', column: 'order_id', refTable: 'customer_orders' },
  { table: 'stock_allocations', name: 'fk_stock_allocations_item', column: 'order_item_id', refTable: 'order_items' },
  { table: 'stock_allocations', name: 'fk_stock_allocations_vegetable', column: 'vegetable_id', refTable: 'vegetables' },
  { table: 'deliveries', name: 'fk_deliveries_order', column: 'order_id', refTable: 'customer_orders' },
  { table: 'deliveries', name: 'fk_deliveries_creator', column: 'created_by', refTable: 'users' },
  { table: 'delivery_items', name: 'fk_delivery_items_delivery', column: 'delivery_id', refTable: 'deliveries' },
  { table: 'delivery_items', name: 'fk_delivery_items_order_item', column: 'order_item_id', refTable: 'order_items' },
  { table: 'delivery_items', name: 'fk_delivery_items_vegetable', column: 'vegetable_id', refTable: 'vegetables' },
  { table: 'payments', name: 'fk_payments_order', column: 'order_id', refTable: 'customer_orders' },
  { table: 'payments', name: 'fk_payments_customer', column: 'customer_id', refTable: 'users' },
  { table: 'payments', name: 'fk_payments_creator', column: 'created_by', refTable: 'users' },
  { table: 'payment_refunds', name: 'fk_payment_refunds_payment', column: 'payment_id', refTable: 'payments' },
  { table: 'payment_refunds', name: 'fk_payment_refunds_order', column: 'order_id', refTable: 'customer_orders' },
  { table: 'payment_refunds', name: 'fk_payment_refunds_customer', column: 'customer_id', refTable: 'users' },
  { table: 'payment_refunds', name: 'fk_payment_refunds_creator', column: 'created_by', refTable: 'users' },
  { table: 'invoices', name: 'fk_invoices_order', column: 'order_id', refTable: 'customer_orders' },
  { table: 'invoices', name: 'fk_invoices_customer', column: 'customer_id', refTable: 'users' },
  { table: 'invoices', name: 'fk_invoices_creator', column: 'created_by', refTable: 'users' },
  { table: 'expenses', name: 'fk_expenses_creator', column: 'created_by', refTable: 'users' },
];

async function up(conn, database) {
  // 1. Ensure latitude/longitude columns exist on customer_addresses
  const [latCol] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customer_addresses' AND COLUMN_NAME = 'latitude'`,
    [database]
  );
  if (latCol.length === 0) {
    await conn.query(
      `ALTER TABLE customer_addresses
       ADD COLUMN latitude DECIMAL(10,7) NULL AFTER pincode,
       ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude`
    );
  }

  // 2. Update company name & super admin display name to Shree Krishna Agro
  await conn.query(
    `UPDATE company_settings
     SET company_name = 'SHREE KRISHNA AGRO PVT. LTD.'
     WHERE company_name = 'SHRI KRISHNA AGRO PVT. LTD.'`
  );
  await conn.query(
    `UPDATE users
     SET full_name = 'Shree Krishna Super Admin'
     WHERE full_name = 'Shri Krishna Super Admin'`
  );

  // 3. Check if users.id is already CHAR(36)
  const [userCol] = await conn.query(
    `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'`,
    [database]
  );
  if (userCol.length > 0 && userCol[0].DATA_TYPE.toLowerCase() === 'char') {
    console.log('GUID IDs already active in database; skipping BIGINT -> GUID conversion.');
    return;
  }

  console.log('Converting BIGINT primary/foreign keys to CHAR(36) GUIDs...');

  // Build oldId -> newUuid mapping for every table before altering
  const idMaps = new Map();
  for (const table of [...ALL_TABLES, 'schema_migrations']) {
    const [rows] = await conn.query(`SELECT id FROM \`${table}\``);
    const map = new Map();
    for (const r of rows) {
      map.set(String(r.id), crypto.randomUUID());
    }
    idMaps.set(table, map);
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    // Drop all existing foreign keys in this schema
    const [fks] = await conn.query(
      `SELECT DISTINCT TABLE_NAME, CONSTRAINT_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [database]
    );
    for (const fk of fks) {
      await conn.query(
        `ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
      );
    }

    // Alter all id columns to CHAR(36) NOT NULL (removing AUTO_INCREMENT)
    for (const table of [...ALL_TABLES, 'schema_migrations']) {
      await conn.query(`ALTER TABLE \`${table}\` MODIFY COLUMN id CHAR(36) NOT NULL`);
    }

    // Alter all FK and reference columns to CHAR(36)
    for (const fk of FK_COLUMNS) {
      const nullClause = fk.nullable ? 'NULL' : 'NOT NULL';
      await conn.query(
        `ALTER TABLE \`${fk.table}\` MODIFY COLUMN \`${fk.column}\` CHAR(36) ${nullClause}`
      );
    }
    await conn.query('ALTER TABLE stock_movements MODIFY COLUMN reference_id CHAR(36) NULL');
    await conn.query('ALTER TABLE audit_logs MODIFY COLUMN entity_id CHAR(36) NULL');
    await conn.query(
      `ALTER TABLE company_settings MODIFY COLUMN company_name VARCHAR(200) NOT NULL DEFAULT 'SHREE KRISHNA AGRO PVT. LTD.'`
    );

    // Update primary key IDs in every table
    for (const table of [...ALL_TABLES, 'schema_migrations']) {
      const map = idMaps.get(table);
      for (const [oldId, newGuid] of map.entries()) {
        await conn.query(`UPDATE \`${table}\` SET id = ? WHERE id = ?`, [newGuid, oldId]);
      }
    }

    // Update foreign key columns
    for (const fk of FK_COLUMNS) {
      const refMap = idMaps.get(fk.refTable);
      for (const [oldId, newGuid] of refMap.entries()) {
        await conn.query(
          `UPDATE \`${fk.table}\` SET \`${fk.column}\` = ? WHERE \`${fk.column}\` = ?`,
          [newGuid, oldId]
        );
      }
    }

    // Update polymorphic reference_id in stock_movements
    const poMap = idMaps.get('purchase_orders');
    for (const [oldId, newGuid] of poMap.entries()) {
      await conn.query(
        `UPDATE stock_movements
         SET reference_id = ?
         WHERE reference_type IN ('PURCHASE_ORDER', 'PURCHASE_ORDER_CANCEL') AND reference_id = ?`,
        [newGuid, oldId]
      );
    }
    const delivMap = idMaps.get('deliveries');
    for (const [oldId, newGuid] of delivMap.entries()) {
      await conn.query(
        `UPDATE stock_movements
         SET reference_id = ?
         WHERE reference_type = 'DELIVERY' AND reference_id = ?`,
        [newGuid, oldId]
      );
    }

    // Update polymorphic entity_id in audit_logs
    for (const entityTable of ALL_TABLES) {
      const entMap = idMaps.get(entityTable);
      if (!entMap || entMap.size === 0) continue;
      for (const [oldId, newGuid] of entMap.entries()) {
        await conn.query(
          `UPDATE audit_logs SET entity_id = ? WHERE entity = ? AND entity_id = ?`,
          [newGuid, entityTable, oldId]
        );
      }
    }

    // Set DEFAULT (UUID()) on all id columns
    for (const table of [...ALL_TABLES, 'schema_migrations']) {
      await conn.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN id CHAR(36) NOT NULL DEFAULT (UUID())`
      );
    }

    // Re-add foreign key constraints
    for (const fk of FK_CONSTRAINTS) {
      await conn.query(
        `ALTER TABLE \`${fk.table}\`
         ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.refTable}\`(id)`
      );
    }
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('Successfully converted all table IDs and references to CHAR(36) GUIDs.');
}

module.exports = { up };

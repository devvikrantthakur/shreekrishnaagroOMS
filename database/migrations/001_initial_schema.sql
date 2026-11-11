-- Shree Krishna Agro Pvt. Ltd. - Order Management System
-- Migration 001: Initial Schema (MySQL 8) with GUID (CHAR(36)) Primary & Foreign Keys

CREATE TABLE IF NOT EXISTS company_settings (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  company_name VARCHAR(200) NOT NULL DEFAULT 'SHREE KRISHNA AGRO PVT. LTD.',
  address TEXT NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150) NOT NULL,
  gstin VARCHAR(50) NULL,
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'SKA-INV',
  order_prefix VARCHAR(20) NOT NULL DEFAULT 'SKA-ORD',
  purchase_prefix VARCHAR(20) NOT NULL DEFAULT 'SKA-PO',
  delivery_prefix VARCHAR(20) NOT NULL DEFAULT 'SKA-DEL',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('SUPER_ADMIN', 'ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_mobile (mobile),
  INDEX idx_users_role_status (role, status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  label VARCHAR(60) NOT NULL DEFAULT 'Home',
  recipient_name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_addresses_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_customer_addresses_user (user_id, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vegetable_categories (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_vegetable_categories_name (name),
  INDEX idx_vegetable_categories_active (status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vegetables (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  category_id CHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(60) NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  unit ENUM('KG', 'GRAM', 'PIECE') NOT NULL DEFAULT 'KG',
  pack_size DECIMAL(12,3) NOT NULL DEFAULT 1.000,
  base_unit ENUM('KG', 'PIECE') NOT NULL DEFAULT 'KG',
  selling_price DECIMAL(12,2) NOT NULL,
  min_stock_threshold DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vegetables_category FOREIGN KEY (category_id) REFERENCES vegetable_categories(id),
  UNIQUE KEY uk_vegetables_sku (sku),
  INDEX idx_vegetables_category (category_id, status, is_deleted),
  INDEX idx_vegetables_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  supplier_name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(150) NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) NULL,
  address TEXT NULL,
  opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_suppliers_mobile (mobile),
  INDEX idx_suppliers_status (status, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  vegetable_id CHAR(36) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit ENUM('KG', 'GRAM', 'PIECE') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_items_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_cart_items_vegetable FOREIGN KEY (vegetable_id) REFERENCES vegetables(id),
  UNIQUE KEY uk_cart_user_vegetable (user_id, vegetable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_orders (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  order_number VARCHAR(40) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  address_id CHAR(36) NULL,
  delivery_address_snapshot JSON NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  cancelled_reason VARCHAR(255) NULL,
  confirmed_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  delivered_at DATETIME NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_orders_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_customer_orders_address FOREIGN KEY (address_id) REFERENCES customer_addresses(id),
  UNIQUE KEY uk_customer_orders_number (order_number),
  INDEX idx_customer_orders_customer (customer_id, created_at),
  INDEX idx_customer_orders_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  order_id CHAR(36) NOT NULL,
  vegetable_id CHAR(36) NOT NULL,
  vegetable_name_snapshot VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit ENUM('KG', 'GRAM', 'PIECE') NOT NULL,
  pack_size_snapshot DECIMAL(12,3) NOT NULL DEFAULT 1.000,
  selling_price_snapshot DECIMAL(12,2) NOT NULL,
  base_quantity DECIMAL(12,3) NOT NULL,
  base_unit ENUM('KG', 'PIECE') NOT NULL,
  delivered_base_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  base_unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES customer_orders(id),
  CONSTRAINT fk_order_items_vegetable FOREIGN KEY (vegetable_id) REFERENCES vegetables(id),
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_vegetable (vegetable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  purchase_number VARCHAR(40) NOT NULL,
  supplier_id CHAR(36) NOT NULL,
  supplier_invoice_ref VARCHAR(100) NULL,
  purchase_date DATE NOT NULL,
  status ENUM('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'ORDERED',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  cancelled_reason VARCHAR(255) NULL,
  cancelled_at DATETIME NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_purchase_orders_creator FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_purchase_orders_number (purchase_number),
  INDEX idx_purchase_orders_supplier (supplier_id, purchase_date),
  INDEX idx_purchase_orders_status (status, purchase_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_items (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  purchase_order_id CHAR(36) NOT NULL,
  vegetable_id CHAR(36) NOT NULL,
  ordered_quantity DECIMAL(12,3) NOT NULL,
  received_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  unit ENUM('KG', 'GRAM', 'PIECE') NOT NULL,
  base_quantity DECIMAL(12,3) NOT NULL,
  received_base_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  base_unit ENUM('KG', 'PIECE') NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  base_unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_items_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_purchase_items_vegetable FOREIGN KEY (vegetable_id) REFERENCES vegetables(id),
  INDEX idx_purchase_items_po (purchase_order_id),
  INDEX idx_purchase_items_vegetable (vegetable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_payments (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  payment_number VARCHAR(40) NOT NULL,
  supplier_id CHAR(36) NOT NULL,
  purchase_order_id CHAR(36) NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method ENUM('CASH', 'UPI', 'BANK_TRANSFER') NOT NULL,
  transaction_ref VARCHAR(100) NULL,
  payment_date DATETIME NOT NULL,
  status ENUM('SUCCESS', 'REVERSED') NOT NULL DEFAULT 'SUCCESS',
  remarks TEXT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_supplier_payments_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_supplier_payments_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_supplier_payments_creator FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_supplier_payments_number (payment_number),
  INDEX idx_supplier_payments_supplier (supplier_id, payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  vegetable_id CHAR(36) NOT NULL,
  movement_type ENUM('PURCHASE_IN', 'DELIVERY_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'REVERSAL') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  signed_quantity DECIMAL(12,3) NOT NULL,
  base_unit ENUM('KG', 'PIECE') NOT NULL,
  unit_cost DECIMAL(12,2) NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id CHAR(36) NULL,
  movement_date DATETIME NOT NULL,
  remarks TEXT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_movements_vegetable FOREIGN KEY (vegetable_id) REFERENCES vegetables(id),
  CONSTRAINT fk_stock_movements_creator FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_stock_movements_veg_date (vegetable_id, movement_date),
  INDEX idx_stock_movements_ref (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_allocations (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  order_id CHAR(36) NOT NULL,
  order_item_id CHAR(36) NOT NULL,
  vegetable_id CHAR(36) NOT NULL,
  allocated_base_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  fulfilled_base_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  base_unit ENUM('KG', 'PIECE') NOT NULL,
  status ENUM('ALLOCATED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'RELEASED') NOT NULL DEFAULT 'ALLOCATED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_allocations_order FOREIGN KEY (order_id) REFERENCES customer_orders(id),
  CONSTRAINT fk_stock_allocations_item FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CONSTRAINT fk_stock_allocations_vegetable FOREIGN KEY (vegetable_id) REFERENCES vegetables(id),
  UNIQUE KEY uk_stock_allocations_item (order_item_id),
  INDEX idx_stock_allocations_veg_status (vegetable_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deliveries (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  delivery_number VARCHAR(40) NOT NULL,
  order_id CHAR(36) NOT NULL,
  delivery_date DATETIME NOT NULL,
  status ENUM('IN_TRANSIT', 'PARTIAL', 'COMPLETED') NOT NULL DEFAULT 'COMPLETED',
  driver_name VARCHAR(120) NULL,
  driver_phone VARCHAR(30) NULL,
  notes TEXT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_deliveries_order FOREIGN KEY (order_id) REFERENCES customer_orders(id),
  CONSTRAINT fk_deliveries_creator FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_deliveries_number (delivery_number),
  INDEX idx_deliveries_order (order_id, delivery_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_items (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  delivery_id CHAR(36) NOT NULL,
  order_item_id CHAR(36) NOT NULL,
  vegetable_id CHAR(36) NOT NULL,
  delivered_quantity DECIMAL(12,3) NOT NULL,
  unit ENUM('KG', 'GRAM', 'PIECE') NOT NULL,
  delivered_base_quantity DECIMAL(12,3) NOT NULL,
  base_unit ENUM('KG', 'PIECE') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_delivery_items_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  CONSTRAINT fk_delivery_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CONSTRAINT fk_delivery_items_vegetable FOREIGN KEY (vegetable_id) REFERENCES vegetables(id),
  INDEX idx_delivery_items_delivery (delivery_id),
  INDEX idx_delivery_items_order_item (order_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  payment_number VARCHAR(40) NOT NULL,
  order_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method ENUM('CASH', 'UPI', 'BANK_TRANSFER') NOT NULL,
  transaction_ref VARCHAR(100) NULL,
  payment_date DATETIME NOT NULL,
  status ENUM('SUCCESS', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'SUCCESS',
  remarks TEXT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES customer_orders(id),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_payments_creator FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_payments_number (payment_number),
  INDEX idx_payments_order (order_id, status),
  INDEX idx_payments_customer (customer_id, payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_refunds (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  refund_number VARCHAR(40) NOT NULL,
  payment_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  refund_method ENUM('CASH', 'UPI', 'BANK_TRANSFER') NOT NULL,
  transaction_ref VARCHAR(100) NULL,
  refund_date DATETIME NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('SUCCESS', 'CANCELLED') NOT NULL DEFAULT 'SUCCESS',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_payment_refunds_order FOREIGN KEY (order_id) REFERENCES customer_orders(id),
  CONSTRAINT fk_payment_refunds_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_payment_refunds_creator FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_payment_refunds_number (refund_number),
  INDEX idx_payment_refunds_order (order_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  invoice_number VARCHAR(40) NOT NULL,
  order_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  invoice_date DATETIME NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance_due DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('ISSUED', 'CANCELLED', 'CREDIT_NOTE') NOT NULL DEFAULT 'ISSUED',
  notes TEXT NULL,
  cancelled_reason VARCHAR(255) NULL,
  cancelled_at DATETIME NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_order FOREIGN KEY (order_id) REFERENCES customer_orders(id),
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_invoices_creator FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE KEY uk_invoices_number (invoice_number),
  INDEX idx_invoices_order_status (order_id, status),
  INDEX idx_invoices_customer (customer_id, invoice_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(150) NOT NULL,
  category ENUM('Transportation', 'Labour', 'Rent', 'Packaging', 'Electricity', 'Maintenance', 'Other') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method ENUM('CASH', 'UPI', 'BANK_TRANSFER') NOT NULL DEFAULT 'CASH',
  remarks TEXT NULL,
  created_by CHAR(36) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenses_creator FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_expenses_date_cat (expense_date, category, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  actor_id CHAR(36) NULL,
  actor_role VARCHAR(30) NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id CHAR(36) NULL,
  details JSON NULL,
  ip_address VARCHAR(60) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_entity (entity, entity_id),
  INDEX idx_audit_logs_actor (actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

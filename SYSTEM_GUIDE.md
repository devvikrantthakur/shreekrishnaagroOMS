# SHREE KRISHNA AGRO PVT. LTD. — System Flow & Feature Guide

Welcome to the **Shree Krishna Agro Pvt. Ltd.** Order Management, Procurement, Inventory, Delivery, Billing, and Accounting System.  
This document explains the end-to-end workflows, features, and business rules for both **Customers (Users)** and **Administrators (`ADMIN` / `SUPER_ADMIN`)**.

---

## 1. User Roles & Access Control

| Role | Access Scope | Account Creation |
|---|---|---|
| **CUSTOMER** | Storefront, persistent cart, saved addresses (with GPS location), checkout, order tracking, payments, invoice PDFs, profile | Public registration (`/register`) or created by Admin |
| **ADMIN** | Admin Console (`/admin`): orders, deliveries, purchase requirements, suppliers, purchase orders, inventory ledger, payments, invoices, expenses, reports, customer management | Created only by `SUPER_ADMIN` |
| **SUPER_ADMIN** | Full `ADMIN` access + create/manage `ADMIN` accounts, change roles, view & restore soft-deleted records, protected against last-admin deletion/demotion | Seeded via `npm run seed` |

---

## 2. End-to-End Business Flow

```
[Customer Registers / Logs In]
         │
         ▼
[Browse Vegetables & Select Units (KG / GRAM / PIECE)] ──► [Persistent Cart]
         │
         ▼
[Select Saved Address or Detect Current GPS Location] ──► [Place Order (PENDING)]
                                                                   │
         ┌─────────────────────────────────────────────────────────┘
         ▼
[Admin Reviews & Confirms Order (CONFIRMED)]
         │
         ▼
[Automatic Purchase Shortage Calculation]
  Shortage = MAX(0, Unallocated Confirmed Demand − Available Unallocated Stock)
         │
         ├──► If Shortage > 0: [Generate PO] ──► [Receive Stock (PURCHASE_IN)]
         │
         ▼
[Allocate Stock (Optional Reservation)] ──► [Record Partial / Full Delivery (DELIVERY_OUT)]
         │                                           │
         ▼                                           ▼
[Issue Tax Invoice (PDF)] ◄────────────── [Record Payments / Refunds]
         │
         ▼
[Real-Time P&L, COGS, Dues, Payables & Audit Reports]
```

---

## 3. Customer (User) Flow & Features

### 3.1 Registration, Login & Top-Right Profile Header
- **Register (`/register`)**: Create a customer account with Full Name, Email, Mobile Number, and Password.
- **Login (`/login`)**: Sign in using Email or Mobile Number + Password.
- **Top-Right User Badge**: Once signed in, your full name and avatar initial are displayed at the top-right corner of the header bar for quick access to your profile.

### 3.2 Browsing Vegetables & Unit Selection
- **Storefront (`/`)**: Search by vegetable name/SKU, filter by **Category** pills, or filter by **Unit** (`KG`, `GRAM`, `PIECE`).
- **Quick Cart Controls**: Tap **ADD** on any vegetable card and use `+` / `-` buttons to adjust pack quantities.
- **Custom Unit Conversion (`/vegetables/:id`)**: Open any vegetable detail page to switch between compatible units (e.g., buy a `KG` vegetable in `GRAM` or `KG`; `PIECE` items stay in `PIECE`).

### 3.3 Delivery Address & Current Location Detection
- Available in **Profile → Saved Delivery Addresses (`/profile`)** and **Checkout (`/checkout`)**.
- **Use Current Location / Detect Current Location**:
  1. Click **Use Current Location** (or **Detect Current Location** inside the address modal).
  2. Allow browser GPS location access when prompted.
  3. The system automatically detects your latitude/longitude and resolves your street, city, state, and pincode via `/api/v1/auth/reverse-geocode`.
  4. Review/edit any field (e.g., shop name, landmark) and click **Save Address** (or click **Detect & Save Now** to auto-fill and save immediately).
- Addresses with GPS coordinates display a **GPS Saved** indicator and a **View Map** link.
- Every placed order stores an immutable JSON snapshot of the selected delivery address (including coordinates if present).

### 3.4 Checkout, Order Tracking, Payments & Invoices
- **Checkout (`/checkout`)**: Review cart items, normalized base quantities, select or detect a delivery address, add optional delivery notes, and **Place Order**.
- **My Orders (`/orders` & `/orders/:id`)**:
  - Track live status: `PENDING` → `CONFIRMED` → `PROCESSING` → `PARTIALLY_DELIVERED` → `DELIVERED` (or `CANCELLED`).
  - View ordered vs. delivered quantities per vegetable and delivery dispatch timestamps.
- **Payments (`/payments` & Order Detail)**:
  - Pay full or partial balance using `UPI`, `CASH`, or `BANK_TRANSFER`.
  - View net paid amount, refunds, and remaining balance due.
- **Tax Invoice PDF**: Download your branded Tax Invoice PDF whenever an invoice has been issued for your order.

---

## 4. Admin & Super Admin Flow & Features

### 4.1 Executive Dashboard (`/admin`)
- Displays 12 real-time KPI cards: Today's Orders, Pending Orders, Total Delivered Sales, Total Purchases, Received Payments, Customer Dues, Available Stock & Valuation, Items Requiring Purchase, Total Expenses, Gross Profit, Net Profit, and Total Orders.
- Includes a 14-day Delivered Sales Trend chart, Purchase Shortages preview, and Recent Orders list.

### 4.2 Order Management (`/admin/orders` & `/admin/orders/:id`)
- Filter orders by status, payment status (`PAID`, `PARTIALLY_PAID`, `UNPAID`), date range, or customer/order search.
- **Order Actions**:
  - **Confirm Order** (`PENDING` → `CONFIRMED`) or **Mark Processing** (`PROCESSING`).
  - **Edit Items**: Before any delivery is recorded, add/remove items, adjust quantities/units, or apply a discount; totals recalculate automatically.
  - **Allocate Stock**: Transaction-locked (`SELECT ... FOR UPDATE`) stock reservation for the order.
  - **Cancel Order**: Releases any unfulfilled stock allocations while preserving order history (blocked if already partially delivered).

### 4.3 Automatic Purchase Requirements (`/admin/purchase-requirements`)
- Live procurement planner using the formula:
  ```
  Total Confirmed Demand = Undelivered base qty across CONFIRMED, PROCESSING, PARTIALLY_DELIVERED orders
  Available Unallocated Stock = MAX(0, Current Stock − Allocated Stock)
  Unallocated Demand = MAX(0, Total Confirmed Demand − Allocated Stock)
  Purchase Shortage = MAX(0, Unallocated Demand − Available Unallocated Stock)
  ```
- Also displays `Pending Unconfirmed Demand` and `Incoming PO Stock`.
- Select shortage items, adjust PO quantities and estimated unit costs, and click **Generate PO** to create a Purchase Order directly.

### 4.4 Suppliers & Purchase Orders (`/admin/suppliers`, `/admin/purchases`)
- **Suppliers**: Manage farm suppliers, opening balances, total received purchases, payments made, and outstanding payables. Record supplier payments on `/admin/suppliers/:id`.
- **Purchase Orders**:
  - Create manual POs or generate from Purchase Requirements.
  - **Receive Stock (Partial or Full)**: Receiving quantities records `PURCHASE_IN` entries in `stock_movements` with unit cost for weighted-average COGS.
  - **Cancel PO**: If stock was previously received, creates a `REVERSAL` ledger movement (prevented if current stock is insufficient because stock was already delivered).

### 4.5 Inventory Ledger & Deliveries (`/admin/inventory`, `/admin/deliveries`)
- **Inventory & Ledger**:
  - Stock is **never** edited directly; it is always computed as `SUM(signed_quantity)` from `stock_movements`.
  - Record manual adjustments (`ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `RETURN_IN`) with mandatory audit remarks.
- **Deliveries**:
  - **Delivery Queue** shows all `CONFIRMED`, `PROCESSING`, and `PARTIALLY_DELIVERED` orders with remaining quantities and live stock availability.
  - Record partial or full deliveries with optional driver name/phone; automatically creates `DELIVERY_OUT` stock movements, updates `delivered_base_quantity`, fulfills allocations, and transitions order status to `PARTIALLY_DELIVERED` or `DELIVERED`.

### 4.6 Payments, Refunds, Invoices & Expenses
- **Payments (`/admin/payments`)**: Record customer receipts (`CASH`, `UPI`, `BANK_TRANSFER`) and issue partial or full **Refunds** (automatically marking fully refunded payments as `REVERSED`).
- **Invoices (`/admin/invoices`)**: Issue unique Tax Invoices per order (duplicate active invoices are prevented), download PDF invoices, or cancel / issue `CREDIT_NOTE`.
- **Expenses (`/admin/expenses`)**: Track operational expenses (`Transportation`, `Labour`, `Rent`, `Packaging`, `Electricity`, `Maintenance`, `Other`) with soft-delete and `SUPER_ADMIN` restore.

### 4.7 Financial Reports, Exports & Audit Logs (`/admin/reports`, `/admin/audit-logs`)
- **11 Reports**: Profit & Loss Statement, Sales Report (Daily/Weekly/Monthly/Yearly), Purchase Report, Vegetable-wise Sales & Margin, Vegetable-wise Purchases, Customer-wise Sales, Customer Dues, Supplier Payables, Payment Collections, Expense Report, and Inventory Valuation.
- **Exports**: Download reports as **CSV** or **PDF** (generated with Shree Krishna Agro branding).
- **Audit Logs**: Immutable log of all administrative and financial actions, recording actor GUID, role, action, target entity GUID, JSON details, and IP address.

---

## 5. Database Architecture (GUID Primary & Foreign Keys)
- All 21 application tables (plus `schema_migrations`) use **36-character GUIDs (`CHAR(36)`)** as primary keys (`id`) and foreign keys (`user_id`, `customer_id`, `vegetable_id`, `order_id`, etc.).
- Master tables (`users`, `customer_addresses`, `vegetable_categories`, `vegetables`, `suppliers`, `expenses`) implement soft delete (`is_deleted`, `deleted_at`) with referential integrity guards.

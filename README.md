# SHREE KRISHNA AGRO PVT. LTD. — Complete Order Management System

A full-stack, MySQL-backed Order Management, Procurement, Inventory Ledger, Delivery, Billing, and Accounting System built with React (Vite + Tailwind CSS), Node.js (Express.js), and MySQL 8 (with `CHAR(36)` GUID primary/foreign keys).

> **User & Admin System Guide:** See [SYSTEM_GUIDE.md](./SYSTEM_GUIDE.md) for a complete walkthrough of all customer and admin features & flows.

## Project Structure

```
shreekrishnagrostore/
├── database/
│   ├── migrations/001_initial_schema.sql   # Normalized MySQL 8 schema (21 tables)
│   ├── seeds/seed.js                       # Configurable SUPER_ADMIN & sample vegetables seed
│   └── migrate.js                          # Migration runner
├── backend/
│   ├── src/
│   │   ├── config/                         # env & mysql2 connection pool + transaction helper
│   │   ├── middleware/                     # JWT auth, RBAC, Multer image upload, error handling
│   │   ├── utils/                          # Unit normalization (KG/GRAM/PIECE), audit logs, PDFKit
│   │   ├── services/                       # Business logic & transactional workflows
│   │   ├── controllers/                    # REST controllers
│   │   └── routes/                         # Express v1 routes
│   ├── uploads/vegetables/                 # Vegetable images (local/uploaded)
│   └── tests/integration.test.js           # Unit + Live MySQL E2E tests
├── frontend/
│   └── src/
│       ├── api/                            # Axios client with JWT + file download helper
│       ├── context/                        # AuthContext, CartContext, ToastContext
│       ├── components/                     # CustomerLayout, AdminLayout, Modals, Tables, Badges
│       └── pages/                          # Customer Storefront + 15+ Admin & Report modules
├── API_DOCS.md
└── .env.example
```

## Prerequisites

- **Node.js** 18+ (tested on v22.13.0)
- **MySQL 8.0+**

## Setup & Installation

### 1. Configure Environment Variables

Copy `backend/.env.example` to `backend/.env` (and/or root `.env.example` to `.env`) and set your MySQL credentials and JWT secret:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=shri_krishna_agro

PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=replace_with_a_long_random_secret_string
JWT_EXPIRES_IN=7d

# Optional seed overrides
SEED_SUPER_ADMIN_NAME=Shree Krishna Super Admin
SEED_SUPER_ADMIN_EMAIL=superadmin@shrikrishnaagro.local
SEED_SUPER_ADMIN_MOBILE=9000000001
SEED_SUPER_ADMIN_PASSWORD=ChangeMe@123!
```

### 2. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Run Database Migrations & Seed Initial Data

```bash
cd backend
npm run migrate
npm run seed
```

This creates the `shri_krishna_agro` database, applies all 21 GUID-based (`CHAR(36)`) tables from `database/migrations/001_initial_schema.sql` (and `002_guid_ids_and_location.js` for upgrades), seeds `company_settings`, creates the initial `SUPER_ADMIN` user (using your configured `SEED_SUPER_ADMIN_*` environment variables), 5 vegetable categories, 12 sample vegetables across `KG`, `GRAM`, and `PIECE` units, a sample supplier, and opening stock ledger movements.

> **Security Note:** Change the seeded `SUPER_ADMIN` password immediately after first login in production. Public registration creates `CUSTOMER` accounts only; `ADMIN` accounts can only be created inside the Admin Console by a `SUPER_ADMIN`.

### 4. Start Backend & Frontend Servers

In terminal 1 (Backend API on port `5000`):
```bash
cd backend
npm run dev
```

In terminal 2 (Frontend Vite dev server on port `5173`):
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

## Running Tests

- **Unit tests (unit conversion, pack-size pricing normalization, purchase cost math):**
  ```bash
  cd backend
  npm test
  ```
- **Full Live Database & Express API E2E Integration Test:**
  ```bash
  cd backend
  RUN_DB_TESTS=true npm test
  ```
  (Requires `backend/.env` pointing to a migrated MySQL 8 database.)

## Key Implemented Business Rules

- **Role-Based Access Control:** `SUPER_ADMIN`, `ADMIN`, `CUSTOMER`. Customers cannot access `/api/v1/admin/*` routes. The last active `SUPER_ADMIN` cannot be deleted, deactivated, or demoted.
- **Soft Delete & Referential Integrity:** Master tables (`users`, `customer_addresses`, `vegetable_categories`, `vegetables`, `suppliers`, `expenses`) use `is_deleted` and `deleted_at`. Records referenced by historical orders, purchases, or stock movements cannot be deleted; `SUPER_ADMIN` can restore soft-deleted records. Financial/transactional records (`customer_orders`, `payments`, `invoices`, `purchase_orders`, `stock_movements`, `deliveries`) preserve full history.
- **Automatic Purchase Shortage Formula:**
  `Purchase Shortage = MAX(0, Unallocated Confirmed Demand - Available Unallocated Stock)`
  Aggregates undelivered quantities from `CONFIRMED`, `PROCESSING`, and `PARTIALLY_DELIVERED` orders, excludes cancelled orders and delivered quantities, accounts for stock allocations, and supports generating POs directly with manual quantity adjustments.
- **Inventory Ledger & Concurrency Safety:** All stock balances are calculated from `stock_movements` (`PURCHASE_IN`, `DELIVERY_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `RETURN_IN`, `REVERSAL`) using `SELECT ... FOR UPDATE` transactions to prevent over-allocation or negative stock deductions.
- **Accounting & Profit/Loss:** Sales revenue is recognized from actual delivered quantities, COGS uses weighted-average received purchase cost (excluding unsold inventory), Gross Profit = Net Sales − COGS, and Net Profit = Gross Profit − Business Expenses. Exportable to CSV and PDF.

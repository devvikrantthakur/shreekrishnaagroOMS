# SHREE KRISHNA AGRO PVT. LTD. — REST API Documentation

Base URL: `/api/v1`

Authentication: `Authorization: Bearer <JWT_TOKEN>`

All primary and foreign key IDs are 36-character GUID strings (`CHAR(36)`).

## 1. Authentication & Customer Profile
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a new `CUSTOMER` account |
| POST | `/auth/login` | Public | Login with email or mobile + password |
| POST | `/auth/logout` | Public | Logout session |
| GET | `/auth/me` | Auth | Get logged-in profile and addresses |
| PUT | `/auth/me` | Auth | Update profile details |
| PUT | `/auth/change-password` | Auth | Change password |
| GET/POST | `/auth/addresses` | Auth | List or add customer delivery addresses (supports optional `latitude` / `longitude`) |
| PUT/DELETE | `/auth/addresses/:addressId` | Auth | Update or soft-delete address |
| GET | `/auth/reverse-geocode?lat=&lng=` | Auth | Resolve GPS coordinates into structured street, city, state, and pincode |

## 2. Public Catalog & Cart
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/catalog/categories` | Public | Active non-deleted vegetable categories |
| GET | `/catalog/vegetables` | Public | Search, filter, paginate active vegetables |
| GET | `/catalog/vegetables/:id` | Public | Vegetable details & stock indicator |
| GET | `/cart` | Auth | Get persistent cart items & subtotal |
| PUT | `/cart` | Auth | Set vegetable quantity/unit in cart (`0` removes) |
| DELETE | `/cart/:vegetableId` | Auth | Remove item from cart |
| DELETE | `/cart` | Auth | Clear cart |

## 3. Customer Orders, Payments & Invoices
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/orders` | Auth | Place order from cart with delivery address |
| GET | `/orders` | Auth | List orders (customer-scoped for `CUSTOMER`) |
| GET | `/orders/:id` | Auth | Get order details, items, deliveries, payments, invoice |
| GET | `/payments` | Auth | Payment history (customer-scoped) |
| POST | `/payments` | Auth | Record payment (`CASH`, `UPI`, `BANK_TRANSFER`) |
| GET | `/invoices` | Auth | List invoices (customer-scoped) |
| GET | `/invoices/:id/pdf` | Auth | Download PDF invoice |

## 4. Admin Endpoints (`/api/v1/admin/*`)
Requires `ADMIN` or `SUPER_ADMIN` role (`CUSTOMER` receives `403 Forbidden`).

### Dashboard & Audit
- `GET /admin/dashboard` — Executive metrics, 14-day sales chart, shortages preview, recent orders
- `GET /admin/audit-logs` — Paginated audit log trail

### User & Address Management
- `GET /admin/users`, `POST /admin/users`, `GET /admin/users/:id`, `PUT /admin/users/:id`, `DELETE /admin/users/:id`
- `POST /admin/users/:id/restore` (`SUPER_ADMIN` only)
- `GET/POST /admin/users/:id/addresses`, `PUT/DELETE /admin/users/:id/addresses/:addressId`

### Categories & Vegetables
- `GET/POST /admin/categories`, `PUT/DELETE /admin/categories/:id`, `POST /admin/categories/:id/restore`
- `GET/POST /admin/vegetables` (`multipart/form-data` image upload supported), `GET/PUT/DELETE /admin/vegetables/:id`, `POST /admin/vegetables/:id/restore`

### Order Management
- `GET /admin/orders`, `POST /admin/orders`, `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status` — `CONFIRMED`, `PROCESSING`, `CANCELLED`
- `PUT /admin/orders/:id/items` — Edit eligible order items & recalculate totals
- `POST /admin/orders/:id/allocate` — Transaction-locked stock allocation

### Automatic Purchase Requirements
- `GET /admin/purchase-requirements` — Computes confirmed demand, current stock, allocated stock, available unallocated stock, and purchase shortage
- `POST /admin/purchase-requirements/generate-po` — Generates PO from shortages/adjusted quantities

### Suppliers & Purchases
- `GET/POST /admin/suppliers`, `GET/PUT/DELETE /admin/suppliers/:id`, `POST /admin/suppliers/:id/restore`
- `POST /admin/supplier-payments` — Record supplier payments
- `GET/POST /admin/purchases`, `GET /admin/purchases/:id`
- `POST /admin/purchases/:id/receive` — Partial or full receipt into `stock_movements`
- `POST /admin/purchases/:id/cancel` — Cancel PO with stock `REVERSAL` if previously received

### Inventory & Deliveries
- `GET /admin/inventory` — Stock summary, reserved stock, available stock, weighted avg cost & valuation
- `GET /admin/inventory/movements` — Ledger movements history
- `POST /admin/inventory/adjustments` — `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `RETURN_IN`
- `GET /admin/deliveries/queue` — Undelivered confirmed/processing/partial orders
- `GET/POST /admin/deliveries`, `GET /admin/deliveries/:id` — Record partial/full deliveries & deduct stock

### Payments, Invoices & Expenses
- `GET/POST /admin/payments`, `POST /admin/payments/refunds`
- `GET /admin/invoices`, `POST /admin/invoices/order/:orderId`, `POST /admin/invoices/:id/cancel`, `GET /admin/invoices/:id/pdf`
- `GET/POST /admin/expenses`, `PUT/DELETE /admin/expenses/:id`, `POST /admin/expenses/:id/restore`

### Reports & Exports
- `GET /admin/reports/sales?granularity=daily|weekly|monthly|yearly`
- `GET /admin/reports/purchases`
- `GET /admin/reports/vegetable-sales`
- `GET /admin/reports/vegetable-purchases`
- `GET /admin/reports/customer-sales`
- `GET /admin/reports/customer-dues`
- `GET /admin/reports/supplier-payables`
- `GET /admin/reports/payment-collections`
- `GET /admin/reports/expenses`
- `GET /admin/reports/inventory-valuation`
- `GET /admin/reports/pnl`
- `GET /admin/reports/export?type=<report>&format=csv|pdf`

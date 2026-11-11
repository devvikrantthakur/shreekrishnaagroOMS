const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getBaseUnit,
  toBaseQuantity,
  fromBaseQuantity,
  computeOrderLinePricing,
  computePurchaseCostPerBaseUnit,
} = require('../src/utils/units');

// ==================== UNIT & PRICING NORMALIZATION TESTS ====================
test('Unit normalization converts KG, GRAM, PIECE accurately', () => {
  assert.equal(getBaseUnit('KG'), 'KG');
  assert.equal(getBaseUnit('GRAM'), 'KG');
  assert.equal(getBaseUnit('PIECE'), 'PIECE');

  assert.equal(toBaseQuantity(2.5, 'KG', 'KG'), 2.5);
  assert.equal(toBaseQuantity(500, 'GRAM', 'KG'), 0.5);
  assert.equal(toBaseQuantity(250, 'GRAM', 'KG'), 0.25);
  assert.equal(toBaseQuantity(3, 'PIECE', 'PIECE'), 3);
  assert.equal(fromBaseQuantity(0.5, 'GRAM'), 500);

  assert.throws(() => toBaseQuantity(1, 'PIECE', 'KG'));
  assert.throws(() => toBaseQuantity(0, 'KG', 'KG'));
  assert.throws(() => toBaseQuantity(-5, 'KG', 'KG'));
});

test('Order line pricing snapshots pack sizes and normalizes base unit prices', () => {
  // 250g pack @ Rs 18 -> 500g should be Rs 36.00 (0.500 KG @ Rs 72/KG)
  const palak = {
    unit: 'GRAM',
    pack_size: 250,
    base_unit: 'KG',
    selling_price: 18,
  };
  const pricing = computeOrderLinePricing(palak, 500, 'GRAM');
  assert.equal(pricing.baseQuantity, 0.5);
  assert.equal(pricing.baseUnit, 'KG');
  assert.equal(pricing.baseUnitPrice, 72);
  assert.equal(pricing.lineTotal, 36);

  // 1 KG pack @ Rs 42 -> 1.5 KG should be Rs 63.00
  const tomato = {
    unit: 'KG',
    pack_size: 1,
    base_unit: 'KG',
    selling_price: 42,
  };
  const tomatoPricing = computeOrderLinePricing(tomato, 1.5, 'KG');
  assert.equal(tomatoPricing.baseQuantity, 1.5);
  assert.equal(tomatoPricing.lineTotal, 63);
});

test('Purchase cost per base unit handles GRAM -> KG conversion', () => {
  assert.equal(computePurchaseCostPerBaseUnit(0.05, 'GRAM', 'KG'), 50);
  assert.equal(computePurchaseCostPerBaseUnit(28, 'KG', 'KG'), 28);
  assert.equal(computePurchaseCostPerBaseUnit(22, 'PIECE', 'PIECE'), 22);
});

// ==================== LIVE DB + EXPRESS INTEGRATION TESTS ====================
const runLiveDbTests = process.env.RUN_DB_TESTS === 'true';

test('Live MySQL & Express E2E Workflow', { skip: !runLiveDbTests }, async () => {
  const http = require('node:http');
  const crypto = require('node:crypto');
  const app = require('../src/app');
  const { pool } = require('../src/config/db');
  const bcrypt = require('bcryptjs');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  async function req(method, path, body = null, token = null) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, data };
  }

  try {
    // Ensure a test SUPER_ADMIN exists
    const testAdminEmail = `test_sa_${Date.now()}@ska.local`;
    const testAdminId = crypto.randomUUID();
    const hash = await bcrypt.hash('TestPass@123', 10);
    await pool.query(
      `INSERT INTO users (id, full_name, email, mobile, password_hash, role, status)
       VALUES (?, 'Test Super Admin', ?, ?, ?, 'SUPER_ADMIN', 'ACTIVE')`,
      [testAdminId, testAdminEmail, `99${String(Date.now()).slice(-8)}`, hash]
    );

    const saLogin = await req('POST', '/auth/login', {
      identifier: testAdminEmail,
      password: 'TestPass@123',
    });
    assert.equal(saLogin.status, 200);
    const saToken = saLogin.data.data.token;

    // 1. Customer Registration
    const custEmail = `cust_${Date.now()}@ska.local`;
    const custMobile = `98${String(Date.now()).slice(-8)}`;
    const custReg = await req('POST', '/auth/register', {
      fullName: 'Test Customer',
      email: custEmail,
      mobile: custMobile,
      password: 'Password123',
    });
    assert.equal(custReg.status, 201);
    const custToken = custReg.data.data.token;

    // 2. Customer forbidden from admin APIs
    const forbidden = await req('GET', '/admin/dashboard', null, custToken);
    assert.equal(forbidden.status, 403);

    // 3. Create Category & Vegetable (Admin)
    const catRes = await req(
      'POST',
      '/admin/categories',
      { name: `TestCat-${Date.now()}` },
      saToken
    );
    assert.equal(catRes.status, 201);
    const catId = catRes.data.data.id;

    const vegRes = await req(
      'POST',
      '/admin/vegetables',
      {
        categoryId: catId,
        name: `TestTomato-${Date.now()}`,
        unit: 'KG',
        packSize: 1,
        sellingPrice: 50,
      },
      saToken
    );
    assert.equal(vegRes.status, 201);
    const vegId = vegRes.data.data.id;

    // 4. Add initial stock = 6 KG via Purchase Order + Receipt
    const supRes = await req(
      'POST',
      '/admin/suppliers',
      { supplierName: `TestFarm-${Date.now()}`, mobile: `97${String(Date.now()).slice(-8)}` },
      saToken
    );
    assert.equal(supRes.status, 201);
    const supId = supRes.data.data.id;

    const po1 = await req(
      'POST',
      '/admin/purchases',
      {
        supplierId: supId,
        items: [{ vegetableId: vegId, quantity: 6, unit: 'KG', unitCost: 30 }],
      },
      saToken
    );
    assert.equal(po1.status, 201);
    const po1ItemId = po1.data.data.items[0].id;
    const recv1 = await req(
      'POST',
      `/admin/purchases/${po1.data.data.id}/receive`,
      { items: [{ purchaseItemId: po1ItemId, receiveQuantity: 6 }] },
      saToken
    );
    assert.equal(recv1.status, 200);

    // 5. Customer adds address, adds 18 KG to cart, places order
    const addrRes = await req(
      'POST',
      '/auth/addresses',
      {
        label: 'Home',
        recipientName: 'Test Customer',
        mobile: custMobile,
        addressLine1: '123 Market Rd',
        city: 'Nashik',
        state: 'Maharashtra',
        pincode: '422001',
        latitude: 19.9975,
        longitude: 73.7898,
      },
      custToken
    );
    assert.equal(addrRes.status, 201);
    assert.match(addrRes.data.data.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.equal(Number(addrRes.data.data.latitude), 19.9975);

    const cartRes = await req(
      'PUT',
      '/cart',
      { vegetableId: vegId, quantity: 18, unit: 'KG' },
      custToken
    );
    assert.equal(cartRes.status, 200);

    const ordRes = await req(
      'POST',
      '/orders',
      { addressId: addrRes.data.data.id },
      custToken
    );
    assert.equal(ordRes.status, 201);
    const orderId = ordRes.data.data.id;
    assert.equal(ordRes.data.data.total_amount, 900);

    // 6. Confirm Order & Check Purchase Requirement Shortage (18 - 6 = 12 KG)
    const confRes = await req(
      'PATCH',
      `/admin/orders/${orderId}/status`,
      { status: 'CONFIRMED' },
      saToken
    );
    assert.equal(confRes.status, 200);

    const prRes = await req('GET', '/admin/purchase-requirements', null, saToken);
    assert.equal(prRes.status, 200);
    const match = prRes.data.data.items.find((i) => i.vegetable_id === vegId);
    assert.ok(match);
    assert.equal(match.total_confirmed_demand, 18);
    assert.equal(match.current_stock, 6);
    assert.equal(match.purchase_shortage, 12);

    // 7. Purchase & Receive remaining 12 KG @ Rs 30/KG
    const po2 = await req(
      'POST',
      '/admin/purchase-requirements/generate-po',
      {
        supplierId: supId,
        items: [{ vegetableId: vegId, quantity: 12, unit: 'KG', unitCost: 30 }],
      },
      saToken
    );
    assert.equal(po2.status, 201);
    const po2Detail = await req('GET', `/admin/purchases/${po2.data.data.id}`, null, saToken);
    await req(
      'POST',
      `/admin/purchases/${po2.data.data.id}/receive`,
      { items: [{ purchaseItemId: po2Detail.data.data.items[0].id, receiveQuantity: 12 }] },
      saToken
    );

    // 8. Partial Delivery of 10 KG
    const ordDetail = await req('GET', `/admin/orders/${orderId}`, null, saToken);
    const oiId = ordDetail.data.data.items[0].id;
    const deliv1 = await req(
      'POST',
      '/admin/deliveries',
      {
        orderId,
        items: [{ orderItemId: oiId, deliverQuantity: 10, unit: 'KG' }],
      },
      saToken
    );
    assert.equal(deliv1.status, 201);
    assert.equal(deliv1.data.data.status, 'PARTIAL');

    // 9. Payment & Invoice PDF
    const payRes = await req(
      'POST',
      '/admin/payments',
      { orderId, amount: 500, paymentMethod: 'UPI', transactionRef: 'UPI-TEST-1' },
      saToken
    );
    assert.equal(payRes.status, 201);
    assert.equal(payRes.data.data.orderPaymentSummary.balanceDue, 400);

    const invRes = await req('POST', `/admin/invoices/order/${orderId}`, {}, saToken);
    assert.equal(invRes.status, 201);
    const invId = invRes.data.data.invoice.id;

    // Duplicate invoice prevented
    const dupInv = await req('POST', `/admin/invoices/order/${orderId}`, {}, saToken);
    assert.equal(dupInv.status, 409);

    const pdfRes = await req('GET', `/admin/invoices/${invId}/pdf`, null, saToken);
    assert.equal(pdfRes.status, 200);
    assert.ok(pdfRes.data.byteLength > 500);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});

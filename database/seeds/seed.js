const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function requireFromBackend(pkg) {
  return require(require.resolve(pkg, {
    paths: [__dirname, path.resolve(__dirname, '../../backend/node_modules')],
  }));
}

const bcrypt = requireFromBackend('bcryptjs');
const mysql = requireFromBackend('mysql2/promise');

function loadEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const candidates = isProd
    ? [
        path.resolve(__dirname, '../../backend/.env.production'),
        path.resolve(__dirname, '../../.env.production'),
        path.resolve(__dirname, '../../backend/.env'),
        path.resolve(__dirname, '../../.env'),
      ]
    : [
        path.resolve(__dirname, '../../backend/.env'),
        path.resolve(__dirname, '../../.env'),
      ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      requireFromBackend('dotenv').config({ path: envPath });
      return;
    }
  }
}

loadEnv();

function buildSvgImage(title, bgHex, accentHex, emojiText) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgHex}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" rx="24" fill="url(#g)"/>
  <circle cx="200" cy="128" r="70" fill="${accentHex}" opacity="0.16"/>
  <circle cx="200" cy="128" r="52" fill="${accentHex}" opacity="0.25"/>
  <text x="200" y="144" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="${accentHex}">${emojiText}</text>
  <text x="200" y="232" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="#14532d">${title}</text>
  <text x="200" y="258" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="600" text-anchor="middle" fill="#166534">SHREE KRISHNA AGRO FRESH</text>
</svg>`;
}

async function seedDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'shri_krishna_agro';

  const superAdminName = process.env.SEED_SUPER_ADMIN_NAME || 'Shree Krishna Super Admin';
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@shrikrishnaagro.local';
  const superAdminMobile = process.env.SEED_SUPER_ADMIN_MOBILE || '9000000001';
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || 'ChangeMe@123!';

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    await conn.beginTransaction();

    // 1. Company settings
    const [existingSettings] = await conn.query('SELECT id FROM company_settings LIMIT 1');
    if (existingSettings.length === 0) {
      await conn.query(
        `INSERT INTO company_settings (id, company_name, address, phone, email, gstin)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          'SHREE KRISHNA AGRO PVT. LTD.',
          'Plot 42, APMC Market Yard, Nashik Road, Maharashtra - 422101',
          '+91 98200 11223',
          'billing@shrikrishnaagro.local',
          '27AABCS1429B1ZS',
        ]
      );
    }

    // 2. Super Admin
    let superAdminId;
    const [existingAdmin] = await conn.query(
      'SELECT id FROM users WHERE email = ? OR role = "SUPER_ADMIN" LIMIT 1',
      [superAdminEmail]
    );
    if (existingAdmin.length === 0) {
      const hash = await bcrypt.hash(superAdminPassword, 10);
      superAdminId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO users (id, full_name, email, mobile, password_hash, role, status)
         VALUES (?, ?, ?, ?, ?, 'SUPER_ADMIN', 'ACTIVE')`,
        [superAdminId, superAdminName, superAdminEmail, superAdminMobile, hash]
      );
    } else {
      superAdminId = existingAdmin[0].id;
    }

    // 3. Categories
    const categories = [
      { name: 'Daily Staples', description: 'Everyday kitchen essentials like potato, onion, tomato', sort_order: 1 },
      { name: 'Leafy Greens', description: 'Fresh farm-picked spinach, coriander, fenugreek and greens', sort_order: 2 },
      { name: 'Gourds & Beans', description: 'Bottle gourd, okra, cluster beans, French beans', sort_order: 3 },
      { name: 'Root & Bulb', description: 'Carrots, radish, beetroot, garlic and ginger', sort_order: 4 },
      { name: 'Exotic & Herbs', description: 'Capsicum, broccoli, cauliflower and fresh herbs', sort_order: 5 },
    ];

    const categoryMap = {};
    for (const cat of categories) {
      const [found] = await conn.query(
        'SELECT id FROM vegetable_categories WHERE name = ? LIMIT 1',
        [cat.name]
      );
      if (found.length === 0) {
        const catId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO vegetable_categories (id, name, description, sort_order, status)
           VALUES (?, ?, ?, ?, 'ACTIVE')`,
          [catId, cat.name, cat.description, cat.sort_order]
        );
        categoryMap[cat.name] = catId;
      } else {
        categoryMap[cat.name] = found[0].id;
      }
    }

    // 4. Generate local SVG vegetable images in backend/uploads/vegetables
    const uploadVegDir = path.resolve(__dirname, '../../backend/uploads/vegetables');
    fs.mkdirSync(uploadVegDir, { recursive: true });

    const sampleVegetables = [
      {
        name: 'Fresh Red Tomato',
        sku: 'VEG-TOM-001',
        category: 'Daily Staples',
        unit: 'KG',
        pack_size: 1.0,
        base_unit: 'KG',
        selling_price: 42.0,
        min_stock_threshold: 25.0,
        cost_price: 28.0,
        initial_stock: 40.0,
        description: 'Juicy farm-fresh red tomatoes ideal for curries, salads and gravies.',
        bg: '#fee2e2',
        accent: '#dc2626',
        code: 'TOM',
        file: 'tomato.jpg',
      },
      {
        name: 'Agra Potato',
        sku: 'VEG-POT-002',
        category: 'Daily Staples',
        unit: 'KG',
        pack_size: 1.0,
        base_unit: 'KG',
        selling_price: 32.0,
        min_stock_threshold: 40.0,
        cost_price: 21.0,
        initial_stock: 65.0,
        description: 'Clean, medium-sized starchy potatoes suitable for daily cooking.',
        bg: '#fef3c7',
        accent: '#b45309',
        code: 'POT',
        file: 'potato.jpg',
      },
      {
        name: 'Nashik Red Onion',
        sku: 'VEG-ONI-003',
        category: 'Daily Staples',
        unit: 'KG',
        pack_size: 1.0,
        base_unit: 'KG',
        selling_price: 48.0,
        min_stock_threshold: 30.0,
        cost_price: 34.0,
        initial_stock: 55.0,
        description: 'Crisp, aromatic Nashik red onions sourced directly from farmers.',
        bg: '#fce7f3',
        accent: '#be185d',
        code: 'ONI',
        file: 'onion.jpg',
      },
      {
        name: 'Fresh Palak (Spinach)',
        sku: 'VEG-SPN-004',
        category: 'Leafy Greens',
        unit: 'GRAM',
        pack_size: 250.0,
        base_unit: 'KG',
        selling_price: 18.0,
        min_stock_threshold: 10.0,
        cost_price: 40.0,
        initial_stock: 18.0,
        description: 'Tender, iron-rich green spinach leaves harvested early morning.',
        bg: '#dcfce7',
        accent: '#15803d',
        code: 'PLK',
        file: 'palak.jpg',
      },
      {
        name: 'Green Coriander (Dhaniya)',
        sku: 'VEG-COR-005',
        category: 'Leafy Greens',
        unit: 'GRAM',
        pack_size: 100.0,
        base_unit: 'KG',
        selling_price: 12.0,
        min_stock_threshold: 5.0,
        cost_price: 65.0,
        initial_stock: 10.0,
        description: 'Fragrant fresh coriander bunch for garnishing and chutneys.',
        bg: '#d1fae5',
        accent: '#047857',
        code: 'COR',
        file: 'coriander.jpg',
      },
      {
        name: 'Bhindi (Lady Finger)',
        sku: 'VEG-BHD-006',
        category: 'Gourds & Beans',
        unit: 'GRAM',
        pack_size: 500.0,
        base_unit: 'KG',
        selling_price: 34.0,
        min_stock_threshold: 15.0,
        cost_price: 44.0,
        initial_stock: 22.0,
        description: 'Tender, snap-fresh green lady fingers.',
        bg: '#ecfccb',
        accent: '#4d7c0f',
        code: 'BHD',
        file: 'bhindi.jpg',
      },
      {
        name: 'Bottle Gourd (Lauki)',
        sku: 'VEG-LUK-007',
        category: 'Gourds & Beans',
        unit: 'PIECE',
        pack_size: 1.0,
        base_unit: 'PIECE',
        selling_price: 35.0,
        min_stock_threshold: 15.0,
        cost_price: 22.0,
        initial_stock: 28.0,
        description: 'Fresh, tender bottle gourd (~600-800g per piece).',
        bg: '#dcfce7',
        accent: '#16a34a',
        code: 'LKI',
        file: 'lauki.jpg',
      },
      {
        name: 'Ooty Carrot',
        sku: 'VEG-CAR-008',
        category: 'Root & Bulb',
        unit: 'GRAM',
        pack_size: 500.0,
        base_unit: 'KG',
        selling_price: 36.0,
        min_stock_threshold: 15.0,
        cost_price: 46.0,
        initial_stock: 20.0,
        description: 'Sweet and crunchy orange Ooty carrots.',
        bg: '#ffedd5',
        accent: '#ea580c',
        code: 'CAR',
        file: 'carrot.jpg',
      },
      {
        name: 'Fresh Ginger',
        sku: 'VEG-GNG-009',
        category: 'Root & Bulb',
        unit: 'GRAM',
        pack_size: 250.0,
        base_unit: 'KG',
        selling_price: 35.0,
        min_stock_threshold: 8.0,
        cost_price: 92.0,
        initial_stock: 12.0,
        description: 'Aromatic fresh ginger root.',
        bg: '#fef9c3',
        accent: '#a16207',
        code: 'GNG',
        file: 'ginger.jpg',
      },
      {
        name: 'Green Capsicum',
        sku: 'VEG-CAP-010',
        category: 'Exotic & Herbs',
        unit: 'GRAM',
        pack_size: 500.0,
        base_unit: 'KG',
        selling_price: 45.0,
        min_stock_threshold: 12.0,
        cost_price: 58.0,
        initial_stock: 16.0,
        description: 'Crisp, glossy green bell peppers.',
        bg: '#dcfce7',
        accent: '#15803d',
        code: 'CAP',
        file: 'capsicum.jpg',
      },
      {
        name: 'Cauliflower (Gobhi)',
        sku: 'VEG-CAU-011',
        category: 'Exotic & Herbs',
        unit: 'PIECE',
        pack_size: 1.0,
        base_unit: 'PIECE',
        selling_price: 40.0,
        min_stock_threshold: 15.0,
        cost_price: 25.0,
        initial_stock: 24.0,
        description: 'Tightly packed snowy white cauliflower head.',
        bg: '#f1f5f9',
        accent: '#334155',
        code: 'CAU',
        file: 'cauliflower.jpg',
      },
      {
        name: 'Fresh Broccoli',
        sku: 'VEG-BRO-012',
        category: 'Exotic & Herbs',
        unit: 'PIECE',
        pack_size: 1.0,
        base_unit: 'PIECE',
        selling_price: 65.0,
        min_stock_threshold: 10.0,
        cost_price: 42.0,
        initial_stock: 14.0,
        description: 'Nutrient-dense green broccoli florets.',
        bg: '#d1fae5',
        accent: '#065f46',
        code: 'BRO',
        file: 'broccoli.jpg',
      },
    ];

    const vegIds = [];
    for (const v of sampleVegetables) {
      const imgPath = path.join(uploadVegDir, v.file);
      let effectiveFile = v.file;
      if (!fs.existsSync(imgPath)) {
        const svgFallback = v.file.replace(/\.\w+$/, '.svg');
        fs.writeFileSync(
          path.join(uploadVegDir, svgFallback),
          buildSvgImage(v.name, v.bg, v.accent, v.code),
          'utf8'
        );
        effectiveFile = svgFallback;
      }
      const imageUrl = `/uploads/vegetables/${effectiveFile}`;

      const [existingVeg] = await conn.query(
        'SELECT id FROM vegetables WHERE sku = ? LIMIT 1',
        [v.sku]
      );
      if (existingVeg.length === 0) {
        const vegId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO vegetables (
            id, category_id, name, sku, description, image_url,
            unit, pack_size, base_unit, selling_price, min_stock_threshold, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [
            vegId,
            categoryMap[v.category],
            v.name,
            v.sku,
            v.description,
            imageUrl,
            v.unit,
            v.pack_size,
            v.base_unit,
            v.selling_price,
            v.min_stock_threshold,
          ]
        );
        vegIds.push({ id: vegId, ...v });
      } else {
        await conn.query('UPDATE vegetables SET image_url = ? WHERE id = ?', [
          imageUrl,
          existingVeg[0].id,
        ]);
      }
    }

    // 5. Sample Supplier & Opening Stock Purchase Order (if no suppliers exist yet)
    const [existingSuppliers] = await conn.query('SELECT id FROM suppliers LIMIT 1');
    if (existingSuppliers.length === 0 && vegIds.length > 0) {
      const supplierId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO suppliers (id, supplier_name, contact_person, mobile, email, address, opening_balance, status)
         VALUES (?, ?, ?, ?, ?, ?, 0.00, 'ACTIVE')`,
        [
          supplierId,
          'Sahyadri Farmers Co-op',
          'Ramesh Patil',
          '9822001100',
          'sahyadri@coop.local',
          'APMC Yard Gate 2, Nashik, Maharashtra',
        ]
      );

      const totalPurchase = vegIds.reduce(
        (sum, item) => sum + item.initial_stock * item.cost_price,
        0
      );

      const poId = crypto.randomUUID();
      await conn.query(
        `INSERT INTO purchase_orders (
          id, purchase_number, supplier_id, supplier_invoice_ref, purchase_date,
          status, total_amount, notes, created_by
        ) VALUES (?, 'SKA-PO-INIT-001', ?, 'INIT-OPENING-001', CURDATE(), 'RECEIVED', ?, 'Initial opening stock seed purchase', ?)`,
        [poId, supplierId, totalPurchase.toFixed(2), superAdminId]
      );

      for (const item of vegIds) {
        const lineTotal = (item.initial_stock * item.cost_price).toFixed(2);
        await conn.query(
          `INSERT INTO purchase_items (
            id, purchase_order_id, vegetable_id, ordered_quantity, received_quantity,
            unit, base_quantity, received_base_quantity, base_unit, unit_cost, base_unit_cost, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            poId,
            item.id,
            item.initial_stock,
            item.initial_stock,
            item.base_unit,
            item.initial_stock,
            item.initial_stock,
            item.base_unit,
            item.cost_price,
            item.cost_price,
            lineTotal,
          ]
        );

        await conn.query(
          `INSERT INTO stock_movements (
            id, vegetable_id, movement_type, quantity, signed_quantity, base_unit,
            unit_cost, reference_type, reference_id, movement_date, remarks, created_by
          ) VALUES (?, ?, 'PURCHASE_IN', ?, ?, ?, ?, 'PURCHASE_ORDER', ?, NOW(), 'Opening seed stock', ?)`,
          [
            crypto.randomUUID(),
            item.id,
            item.initial_stock,
            item.initial_stock,
            item.base_unit,
            item.cost_price,
            poId,
            superAdminId,
          ]
        );
      }
    }

    await conn.commit();
    console.log('Database seeded successfully.');
    console.log(`Super Admin Email: ${superAdminEmail}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };

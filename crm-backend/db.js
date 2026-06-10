const knex = require('knex');
const path = require('path');

const usePostgres = process.env.DB_CLIENT === 'pg' || !!process.env.PG_HOST || !!process.env.PG_USER;
let pgDbCheckPromise = null;

async function ensureDatabaseExists() {
  const { Client } = require('pg');
  const connectionConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: 'postgres'
  };

  const client = new Client(connectionConfig);
  try {
    await client.connect();
    const dbName = process.env.PG_DATABASE || 'xeno_crm';
    
    // Check if database exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`[DB] Database "${dbName}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`[DB] Database "${dbName}" created successfully.`);
    }
  } catch (err) {
    console.error('[DB] Failed to ensure database exists:', err.message);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

if (usePostgres) {
  pgDbCheckPromise = ensureDatabaseExists();
}

const db = usePostgres
  ? knex({
      client: 'pg',
      connection: {
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT) || 5432,
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || 'postgres',
        database: process.env.PG_DATABASE || 'xeno_crm'
      }
    })
  : knex({
      client: 'sqlite3',
      connection: {
        filename: path.join(__dirname, 'crm.db')
      },
      useNullAsDefault: true
    });

// Helper to seed data if tables are empty
async function initializeDatabase() {
  if (usePostgres && pgDbCheckPromise) {
    await pgDbCheckPromise;
  }
  // Create Customers Table
  const hasCustomers = await db.schema.hasTable('customers');
  if (!hasCustomers) {
    await db.schema.createTable('customers', (table) => {
      table.increments('id').primary();
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('email').unique().notNullable();
      table.string('phone').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('Created customers table');
  }

  // Create Orders Table
  const hasOrders = await db.schema.hasTable('orders');
  if (!hasOrders) {
    await db.schema.createTable('orders', (table) => {
      table.increments('id').primary();
      table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('CASCADE');
      table.float('amount').notNullable();
      table.integer('item_count').notNullable();
      table.text('items').notNullable(); // Stored as a JSON string
      table.timestamp('purchase_date').notNullable();
    });
    console.log('Created orders table');
  }

  // Create Segments Table
  const hasSegments = await db.schema.hasTable('segments');
  if (!hasSegments) {
    await db.schema.createTable('segments', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('description');
      table.text('rules').notNullable(); // JSON filters config
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('Created segments table');
  }

  // Create Campaigns Table
  const hasCampaigns = await db.schema.hasTable('campaigns');
  if (!hasCampaigns) {
    await db.schema.createTable('campaigns', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('segment_id').unsigned().references('id').inTable('segments').onDelete('SET NULL');
      table.string('channel').notNullable();
      table.text('message_template').notNullable();
      table.string('status').defaultTo('draft'); // draft, sending, completed
      table.integer('sent_count').defaultTo(0);
      table.integer('delivered_count').defaultTo(0);
      table.integer('failed_count').defaultTo(0);
      table.integer('opened_count').defaultTo(0);
      table.integer('clicked_count').defaultTo(0);
      table.integer('converted_count').defaultTo(0);
      table.float('revenue').defaultTo(0.0);
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('Created campaigns table');
  }

  // Create Communications Table
  const hasCommunications = await db.schema.hasTable('communications');
  if (!hasCommunications) {
    await db.schema.createTable('communications', (table) => {
      table.increments('id').primary();
      table.integer('campaign_id').unsigned().references('id').inTable('campaigns').onDelete('CASCADE');
      table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('CASCADE');
      table.string('recipient').notNullable();
      table.text('message_body').notNullable();
      table.string('status').defaultTo('sent');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('Created communications table');
  }

  // Seeding logic for new databases
  const countRes = await db('customers').count('id as count').first();
  if (countRes.count === 0) {
    console.log('Database empty, seeding realistic customer and order data...');
    await seedData();
  }
}

async function seedData() {
  const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle', 'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah', 'Edward', 'Stephanie', 'Ronald', 'Rebecca', 'Timothy', 'Sharon', 'Jason', 'Laura', 'Jeffrey', 'Cynthia', 'Ryan', 'Kathleen', 'Jacob', 'Amy', 'Gary', 'Shirley', 'Nicholas', 'Angela', 'Eric', 'Helen', 'Jonathan', 'Anna', 'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Nicole', 'Scott', 'Emma', 'Brandon', 'Samantha', 'Benjamin', 'Katherine', 'Samuel', 'Christine', 'Gregory', 'Debra', 'Alexander', 'Rachel', 'Frank', 'Catherine', 'Patrick', 'Carolyn', 'Raymond', 'Janet', 'Jack', 'Ruth', 'Dennis', 'Maria', 'Jerry', 'Heather'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'];
  
  const catalog = [
    // Coffee
    { name: 'Organic Coffee Beans', price: 18.99, category: 'coffee' },
    { name: 'Espresso Roast Coffee', price: 14.99, category: 'coffee' },
    { name: 'Cold Brew Blend', price: 16.99, category: 'coffee' },
    { name: 'French Press Maker', price: 35.00, category: 'coffee' },
    { name: 'Paper Coffee Filters', price: 5.99, category: 'coffee' },
    // Apparel
    { name: 'Classic White Tee', price: 24.99, category: 'apparel' },
    { name: 'Denim Jacket', price: 89.99, category: 'apparel' },
    { name: 'Cozy Hooded Sweatshirt', price: 49.99, category: 'apparel' },
    { name: 'Sport Socks (3-pack)', price: 12.00, category: 'apparel' },
    { name: 'Beanie Hat', price: 19.99, category: 'apparel' },
    // Beauty
    { name: 'Hydrating Face Cream', price: 28.00, category: 'beauty' },
    { name: 'Vitamin C Serum', price: 32.00, category: 'beauty' },
    { name: 'Gentle Skin Cleanser', price: 18.00, category: 'beauty' },
    { name: 'Lip Balm Set', price: 10.00, category: 'beauty' },
    { name: 'Clay Face Mask', price: 22.00, category: 'beauty' }
  ];

  const customersToInsert = [];
  for (let i = 0; i < 100; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@xeno-example.com`;
    const phone = `+1555${(1000000 + i).toString().substring(1)}`;
    
    const createdDaysAgo = Math.floor(Math.random() * 90) + 90;
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - createdDaysAgo);

    customersToInsert.push({
      first_name: fn,
      last_name: ln,
      email,
      phone,
      created_at: createdDate.toISOString()
    });
  }

  const customerIds = [];
  for (const c of customersToInsert) {
    const result = await db('customers').insert(c).returning('id');
    const id = typeof result[0] === 'object' ? result[0].id : result[0];
    customerIds.push(id);
  }

  const ordersToInsert = [];
  const now = new Date();

  for (let i = 0; i < 250; i++) {
    const customerIdx = Math.floor(Math.pow(Math.random(), 1.5) * customerIds.length);
    const customerId = customerIds[customerIdx];
    const itemCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
    const selectedItems = [];
    let orderAmount = 0;

    for (let j = 0; j < itemCount; j++) {
      const item = catalog[Math.floor(Math.random() * catalog.length)];
      selectedItems.push({
        name: item.name,
        price: item.price,
        category: item.category
      });
      orderAmount += item.price;
    }

    // Purchase date scattered in the last 120 days
    const daysAgo = Math.floor(Math.random() * 120);
    const purchaseDate = new Date();
    purchaseDate.setDate(now.getDate() - daysAgo);

    // Make sure purchase date is after customer creation date
    const customer = customersToInsert[customerIdx];
    const createdDate = new Date(customer.created_at);
    if (purchaseDate < createdDate) {
      purchaseDate.setDate(createdDate.getDate() + 1);
    }

    ordersToInsert.push({
      customer_id: customerId,
      amount: parseFloat(orderAmount.toFixed(2)),
      item_count: itemCount,
      items: JSON.stringify(selectedItems),
      purchase_date: purchaseDate.toISOString()
    });
  }

  // Insert orders in batches
  await db.batchInsert('orders', ordersToInsert, 50);
  console.log('Seeded 100 customers and 250 orders.');

  // Create a couple of default segments so the app has content on first run
  const defaultSegments = [
    {
      name: 'VIP Coffee Lovers',
      description: 'Customers who spent over $100 total and bought Coffee Beans.',
      rules: JSON.stringify({
        minTotalSpend: 100,
        purchasedItems: ['Coffee Beans']
      })
    },
    {
      name: 'Inactive Shoppers',
      description: 'Customers who have not purchased anything in the last 45 days.',
      rules: JSON.stringify({
        inactiveDaysMin: 45
      })
    },
    {
      name: 'One-time Buyers (Apparel)',
      description: 'Customers with exactly 1 order, purchasing apparel items.',
      rules: JSON.stringify({
        maxPurchaseCount: 1,
        purchasedItems: ['Classic White Tee', 'Denim Jacket', 'Cozy Hooded Sweatshirt', 'Sport Socks', 'Beanie Hat']
      })
    }
  ];

  for (const s of defaultSegments) {
    await db('segments').insert(s);
  }
  console.log('Seeded default segments.');
}

// Segmentation Query Builder
async function querySegmentCustomers(rules) {
  let query = db('customers')
    .select('customers.*')
    .leftJoin('orders', 'customers.id', '=', 'orders.customer_id')
    .groupBy('customers.id');

  const conditions = typeof rules === 'string' ? JSON.parse(rules) : rules;

  // Track if we need HAVING clauses
  const havingConditions = [];

  // Minimum total spend
  if (conditions.minTotalSpend !== undefined) {
    query = query.sum('orders.amount as total_spend');
    havingConditions.push(`SUM(orders.amount) >= ${parseFloat(conditions.minTotalSpend)}`);
  } else {
    query = query.sum('orders.amount as total_spend');
  }

  // Minimum purchase count
  if (conditions.minPurchaseCount !== undefined) {
    query = query.count('orders.id as order_count');
    havingConditions.push(`COUNT(orders.id) >= ${parseInt(conditions.minPurchaseCount)}`);
  } else if (conditions.maxPurchaseCount !== undefined) {
    query = query.count('orders.id as order_count');
    havingConditions.push(`COUNT(orders.id) <= ${parseInt(conditions.maxPurchaseCount)}`);
  } else {
    query = query.count('orders.id as order_count');
  }

  // Inactivity in days
  if (conditions.inactiveDaysMin !== undefined) {
    const days = parseInt(conditions.inactiveDaysMin);
    query = query.max('orders.purchase_date as last_purchase');
    
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - days);
    
    havingConditions.push(`(MAX(orders.purchase_date) <= '${thresholdDate.toISOString()}' OR MAX(orders.purchase_date) IS NULL)`);
  } else {
    query = query.max('orders.purchase_date as last_purchase');
  }

  // Apply HAVING conditions
  if (havingConditions.length > 0) {
    query = query.havingRaw(havingConditions.join(' AND '));
  }

  // Fetch results
  let customers = await query;

  // Post-filter in Javascript for item-specific inclusion/exclusion (due to complexity of searching JSON array strings in SQLite)
  if (conditions.purchasedItems && conditions.purchasedItems.length > 0) {
    const itemsToMatch = conditions.purchasedItems.map(i => i.toLowerCase());
    const validCustomerIds = [];
    
    // Fetch all customer orders to check items
    for (const customer of customers) {
      const orders = await db('orders').where({ customer_id: customer.id });
      let matches = false;
      for (const order of orders) {
        try {
          const itemsArray = JSON.parse(order.items);
          const hasMatch = itemsArray.some(item => 
            itemsToMatch.some(match => item.name.toLowerCase().includes(match) || item.category.toLowerCase().includes(match))
          );
          if (hasMatch) {
            matches = true;
            break;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
      if (matches) {
        validCustomerIds.push(customer.id);
      }
    }
    customers = customers.filter(c => validCustomerIds.includes(c.id));
  }

  if (conditions.excludedItems && conditions.excludedItems.length > 0) {
    const itemsToExclude = conditions.excludedItems.map(i => i.toLowerCase());
    const excludedCustomerIds = [];

    for (const customer of customers) {
      const orders = await db('orders').where({ customer_id: customer.id });
      let matches = false;
      for (const order of orders) {
        try {
          const itemsArray = JSON.parse(order.items);
          const hasMatch = itemsArray.some(item => 
            itemsToExclude.some(match => item.name.toLowerCase().includes(match) || item.category.toLowerCase().includes(match))
          );
          if (hasMatch) {
            matches = true;
            break;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
      if (matches) {
        excludedCustomerIds.push(customer.id);
      }
    }
    customers = customers.filter(c => !excludedCustomerIds.includes(c.id));
  }

  return customers;
}

module.exports = {
  db,
  initializeDatabase,
  querySegmentCustomers
};

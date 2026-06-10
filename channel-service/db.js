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
    const dbName = process.env.PG_SIMULATOR_DATABASE || 'xeno_simulator';
    
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
        database: process.env.PG_SIMULATOR_DATABASE || 'xeno_simulator'
      }
    })
  : knex({
      client: 'sqlite3',
      connection: {
        filename: path.join(__dirname, 'simulator.db')
      },
      useNullAsDefault: true
    });

async function initializeDatabase() {
  if (usePostgres && pgDbCheckPromise) {
    await pgDbCheckPromise;
  }

  // Outbox table for simulated status logs
  const hasOutbox = await db.schema.hasTable('outbox');
  if (!hasOutbox) {
    await db.schema.createTable('outbox', (table) => {
      table.integer('id').primary(); // Matches the CRM's communication_id
      table.integer('campaign_id').notNullable();
      table.string('recipient').notNullable();
      table.text('message_body').notNullable();
      table.string('channel').notNullable();
      table.string('status').defaultTo('queued'); // queued, sent, delivered, failed, opened, clicked, converted
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
    console.log('Created simulator outbox table');
  }

  // Reliable callback queue with backoff retries
  const hasCallbacks = await db.schema.hasTable('callbacks_queue');
  if (!hasCallbacks) {
    await db.schema.createTable('callbacks_queue', (table) => {
      table.increments('id').primary();
      table.integer('communication_id').notNullable();
      table.string('status').notNullable(); // delivered, failed, opened, clicked, converted
      table.text('payload').notNullable(); // JSON payload sent to CRM
      table.integer('retry_count').defaultTo(0);
      table.string('callback_status').defaultTo('pending'); // pending, success, failed
      table.timestamp('next_attempt_at').defaultTo(db.fn.now());
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('Created simulator callbacks_queue table');
  }
}

module.exports = {
  db,
  initializeDatabase
};

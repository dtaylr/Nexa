import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'nexacore.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_accounts (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    accountNumber TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'GBP',
    type TEXT NOT NULL DEFAULT 'current',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_transfers (
    id TEXT PRIMARY KEY,
    fromAccountId TEXT REFERENCES fin_accounts(id),
    toAccountId TEXT REFERENCES fin_accounts(id),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'GBP',
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    auditId TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_audit_log (
    id TEXT PRIMARY KEY,
    transferId TEXT REFERENCES fin_transfers(id),
    action TEXT NOT NULL,
    metadata TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hlt_patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER REFERENCES users(id),
    nhsNumber TEXT,
    dateOfBirth TEXT,
    firstName TEXT,
    lastName TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hlt_appointments (
    id TEXT PRIMARY KEY,
    patientId INTEGER REFERENCES hlt_patients(id),
    doctorId TEXT,
    datetime TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hlt_medications (
    id TEXT PRIMARY KEY,
    patientId INTEGER REFERENCES hlt_patients(id),
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    unit TEXT NOT NULL,
    frequency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hlt_records (
    id TEXT PRIMARY KEY,
    patientId INTEGER REFERENCES hlt_patients(id),
    type TEXT NOT NULL,
    content TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    inventory INTEGER NOT NULL DEFAULT 0,
    imageUrl TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_carts (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_cart_items (
    id TEXT PRIMARY KEY,
    cartId TEXT REFERENCES com_carts(id),
    productId TEXT REFERENCES com_products(id),
    quantity INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS com_promotions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discountType TEXT NOT NULL,
    discountValue REAL NOT NULL,
    maxUses INTEGER,
    currentUses INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS com_cart_promotions (
    id TEXT PRIMARY KEY,
    cartId TEXT REFERENCES com_carts(id),
    promotionId TEXT REFERENCES com_promotions(id),
    appliedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_orders (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    cartId TEXT REFERENCES com_carts(id),
    status TEXT NOT NULL DEFAULT 'pending',
    total REAL NOT NULL,
    emailSent INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_order_items (
    id TEXT PRIMARY KEY,
    orderId TEXT REFERENCES com_orders(id),
    productId TEXT REFERENCES com_products(id),
    quantity INTEGER NOT NULL,
    price REAL NOT NULL
  );
`);

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(dataDir, '1platform.db');

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
    currency TEXT NOT NULL DEFAULT 'USD',
    type TEXT NOT NULL DEFAULT 'current',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_transfers (
    id TEXT PRIMARY KEY,
    fromAccountId TEXT REFERENCES fin_accounts(id),
    toAccountId TEXT REFERENCES fin_accounts(id),
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
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
    category TEXT,
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

  CREATE TABLE IF NOT EXISTS hlt_lab_results (
    id TEXT PRIMARY KEY,
    patientId INTEGER REFERENCES hlt_patients(id),
    testName TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    referenceMin REAL,
    referenceMax REAL,
    status TEXT NOT NULL DEFAULT 'normal',
    orderedBy TEXT,
    collectedAt TEXT,
    reportedAt TEXT DEFAULT (datetime('now')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS hlt_prescriptions (
    id TEXT PRIMARY KEY,
    patientId INTEGER REFERENCES hlt_patients(id),
    medicationName TEXT NOT NULL,
    dosage TEXT NOT NULL,
    unit TEXT NOT NULL,
    frequency TEXT NOT NULL,
    prescribedBy TEXT NOT NULL,
    prescribedAt TEXT DEFAULT (datetime('now')),
    expiresAt TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    refillsRemaining INTEGER DEFAULT 0,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS hlt_messages (
    id TEXT PRIMARY KEY,
    senderId INTEGER REFERENCES users(id),
    recipientId INTEGER REFERENCES users(id),
    patientId INTEGER REFERENCES hlt_patients(id),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    attachmentUrl TEXT,
    isRead INTEGER DEFAULT 0,
    sentAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hlt_insurance (
    id TEXT PRIMARY KEY,
    patientId INTEGER REFERENCES hlt_patients(id),
    provider TEXT NOT NULL,
    policyNumber TEXT NOT NULL,
    groupNumber TEXT,
    memberName TEXT NOT NULL,
    effectiveDate TEXT NOT NULL,
    expirationDate TEXT,
    copay REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS hlt_billing (
    id TEXT PRIMARY KEY,
    patientId INTEGER REFERENCES hlt_patients(id),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    serviceDate TEXT NOT NULL,
    dueDate TEXT,
    paidAt TEXT,
    insuranceCovered REAL DEFAULT 0,
    patientResponsibility REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hlt_notification_prefs (
    id INTEGER PRIMARY KEY,
    patientId INTEGER UNIQUE REFERENCES hlt_patients(id),
    emailAppointments INTEGER DEFAULT 1,
    smsAppointments INTEGER DEFAULT 1,
    emailLabResults INTEGER DEFAULT 1,
    smsLabResults INTEGER DEFAULT 0,
    emailBilling INTEGER DEFAULT 1,
    emailMessages INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS hlt_mfa_sessions (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    code TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_cards (
    id TEXT PRIMARY KEY,
    accountId TEXT REFERENCES fin_accounts(id),
    userId INTEGER REFERENCES users(id),
    cardType TEXT NOT NULL DEFAULT 'virtual',
    lastFour TEXT NOT NULL,
    cardholderName TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    dailyLimit INTEGER NOT NULL DEFAULT 50000,
    spendToday INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_beneficiaries (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    accountNumber TEXT NOT NULL,
    sortCode TEXT NOT NULL,
    reference TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fin_fraud_events (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    accountId TEXT,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'low',
    description TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_wishlist (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    productId TEXT REFERENCES com_products(id),
    addedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_returns (
    id TEXT PRIMARY KEY,
    orderId TEXT REFERENCES com_orders(id),
    userId INTEGER REFERENCES users(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    requestedAt TEXT DEFAULT (datetime('now')),
    resolvedAt TEXT,
    refundAmount REAL
  );

  CREATE TABLE IF NOT EXISTS com_loyalty (
    id TEXT PRIMARY KEY,
    userId INTEGER UNIQUE REFERENCES users(id),
    points INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'bronze',
    totalEarned INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS com_loyalty_transactions (
    id TEXT PRIMARY KEY,
    userId INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// Migrate existing databases — add columns that may have been added after initial creation
try { db.exec(`ALTER TABLE com_products ADD COLUMN category TEXT`); } catch {}

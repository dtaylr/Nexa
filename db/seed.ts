import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'nexacore.db');

// Load schema by importing the db module
require('../apps/api/src/db');

const db = new Database(DB_PATH);

function seed() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  if (existing.count > 0) {
    console.log('Database already seeded. Run with --force to reseed.');
    if (!process.argv.includes('--force')) return;
    clearAll();
  }

  console.log('Seeding NexaCore database...');

  const hash = (p: string) => bcrypt.hashSync(p, 10);

  // --- Users ---
  const aliceId = insertUser('alice@nexacore.dev', hash('password123'), 'banker');
  const bobId = insertUser('bob@nexacore.dev', hash('password123'), 'banker');
  const patientOneId = insertUser('patient.one@nexacore.dev', hash('password123'), 'patient');
  const patientTwoId = insertUser('patient.two@nexacore.dev', hash('password123'), 'patient');
  const shopperOneId = insertUser('shopper@nexacore.dev', hash('password123'), 'shopper');

  // --- Finance ---
  const aliceCurrentId = uuidv4();
  const aliceSavingsId = uuidv4();
  const bobCurrentId = uuidv4();
  const nexaHouseId = uuidv4();

  db.prepare(`INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, ?, ?)`).run(
    aliceCurrentId, aliceId, '60161331001234', 1_000_000, 'GBP', 'current'
  );
  db.prepare(`INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, ?, ?)`).run(
    aliceSavingsId, aliceId, '60161331005678', 5_000_000, 'GBP', 'savings'
  );
  db.prepare(`INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, ?, ?)`).run(
    bobCurrentId, bobId, '60161331009012', 250_000, 'GBP', 'current'
  );
  db.prepare(`INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, ?, ?)`).run(
    nexaHouseId, bobId, '60161331003456', 10_000, 'GBP', 'current'
  );

  // Seed some transactions with amounts that trigger float bug (0.1 + 0.2)
  const t1 = uuidv4(); const a1 = uuidv4();
  const t2 = uuidv4(); const a2 = uuidv4();
  const t3 = uuidv4(); const a3 = uuidv4();

  db.prepare(`INSERT INTO fin_transfers (id, fromAccountId, toAccountId, amount, currency, reference, status, auditId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    t1, aliceCurrentId, bobCurrentId, 10, 'GBP', 'Coffee money', 'PENDING', a1
  );
  db.prepare(`INSERT INTO fin_audit_log (id, transferId, action, metadata) VALUES (?, ?, ?, ?)`).run(
    a1, t1, 'TRANSFER_CREATED', JSON.stringify({ amountInPence: 10, currency: 'GBP' })
  );

  db.prepare(`INSERT INTO fin_transfers (id, fromAccountId, toAccountId, amount, currency, reference, status, auditId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    t2, bobCurrentId, aliceCurrentId, 20, 'GBP', 'Lunch split', 'PENDING', a2
  );
  db.prepare(`INSERT INTO fin_audit_log (id, transferId, action, metadata) VALUES (?, ?, ?, ?)`).run(
    a2, t2, 'TRANSFER_CREATED', JSON.stringify({ amountInPence: 20, currency: 'GBP' })
  );

  // Amounts chosen to trigger IEEE 754 trap in monthly summary: 0.10 + 0.20
  db.prepare(`INSERT INTO fin_transfers (id, fromAccountId, toAccountId, amount, currency, reference, status, auditId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    t3, aliceCurrentId, nexaHouseId, 10, 'GBP', 'Jan standing order', 'PENDING', a3
  );
  db.prepare(`INSERT INTO fin_audit_log (id, transferId, action, metadata) VALUES (?, ?, ?, ?)`).run(
    a3, t3, 'TRANSFER_CREATED', JSON.stringify({ amountInPence: 10, currency: 'GBP' })
  );

  // --- Health ---
  // Sequential integer IDs are assigned by autoincrement — IDOR-friendly
  db.prepare(`INSERT INTO hlt_patients (userId, nhsNumber, dateOfBirth, firstName, lastName) VALUES (?, ?, ?, ?, ?)`).run(
    patientOneId, '485 777 3456', '1982-04-15', 'Margaret', 'Holloway'
  );
  db.prepare(`INSERT INTO hlt_patients (userId, nhsNumber, dateOfBirth, firstName, lastName) VALUES (?, ?, ?, ?, ?)`).run(
    patientTwoId, '323 456 7890', '1975-11-28', 'David', 'Okonkwo'
  );

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO hlt_appointments (id, patientId, doctorId, datetime, status, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), 1, 'dr-chen-001', nextWeek, 'scheduled', 'Annual cardiovascular review'
  );
  db.prepare(`INSERT INTO hlt_appointments (id, patientId, doctorId, datetime, status, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), 2, 'dr-patel-002', lastMonth, 'completed', 'Follow-up on blood pressure medication'
  );

  // BUG HLT-001: dosage stored as TEXT — "10" not 10
  db.prepare(`INSERT INTO hlt_medications (id, patientId, name, dosage, unit, frequency, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), 1, 'Lisinopril', '10', 'mg', 'Once daily', 'active'
  );
  db.prepare(`INSERT INTO hlt_medications (id, patientId, name, dosage, unit, frequency, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), 1, 'Atorvastatin', '20', 'mg', 'Once daily at bedtime', 'active'
  );
  db.prepare(`INSERT INTO hlt_medications (id, patientId, name, dosage, unit, frequency, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), 2, 'Amlodipine', '5', 'mg', 'Once daily', 'active'
  );

  db.prepare(`INSERT INTO hlt_records (id, patientId, type, content) VALUES (?, ?, ?, ?)`).run(
    uuidv4(), 1, 'consultation', JSON.stringify({ summary: 'BP 128/82, within target range. Continue current medication.' })
  );
  db.prepare(`INSERT INTO hlt_records (id, patientId, type, content) VALUES (?, ?, ?, ?)`).run(
    uuidv4(), 2, 'lab_result', JSON.stringify({ hba1c: 48, unit: 'mmol/mol', interpretation: 'Normal' })
  );

  // --- Commerce ---
  const productIds = {
    shoes: uuidv4(),
    jacket: uuidv4(),
    bag: uuidv4(),
    watch: uuidv4(),
    rare: uuidv4(),
  };

  // BUG COM-006: prices stored as REAL — floating point drift can occur
  db.prepare(`INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)`).run(
    productIds.shoes, 'Running Shoes V2', 'Lightweight responsive running shoe, neutral cushioning', 89.99, 47,
    '/images/running-shoes-v2.jpg'
  );
  db.prepare(`INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)`).run(
    productIds.jacket, 'Waterproof Trail Jacket', '3-layer Gore-Tex shell, seam-sealed, packable', 149.99, 23,
    '/images/trail-jacket.jpg'
  );
  db.prepare(`INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)`).run(
    productIds.bag, 'Technical Backpack 28L', 'Hydration-compatible, laptop sleeve, weatherproof', 74.95, 31,
    '/images/technical-backpack.jpg'
  );
  db.prepare(`INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)`).run(
    productIds.watch, 'GPS Sport Watch', 'Multi-sport GPS, heart rate, 24-hour battery', 199.99, 12,
    '/images/gps-sport-watch.jpg'
  );
  // Single-unit item — used for concurrent purchase race condition test (COM-002)
  db.prepare(`INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)`).run(
    'PROD-999', 'Limited Edition Cap', 'Last one in stock — signed by the team', 29.99, 1,
    '/images/limited-cap.jpg'
  );

  db.prepare(`INSERT INTO com_promotions (id, code, discountType, discountValue, maxUses) VALUES (?, ?, ?, ?, ?)`).run(
    uuidv4(), 'SAVE10', 'percentage', 10, 100
  );
  db.prepare(`INSERT INTO com_promotions (id, code, discountType, discountValue, maxUses) VALUES (?, ?, ?, ?, ?)`).run(
    uuidv4(), 'FLAT5', 'fixed', 5, 50
  );

  console.log('Seed complete.');
  console.log('  Users: alice@nexacore.dev, bob@nexacore.dev (password: password123)');
  console.log('  Patients: patient.one@nexacore.dev, patient.two@nexacore.dev');
  console.log('  Shopper: shopper@nexacore.dev');
}

function insertUser(email: string, passwordHash: string, role: string): number {
  const result = db.prepare(
    'INSERT OR IGNORE INTO users (email, passwordHash, role) VALUES (?, ?, ?)'
  ).run(email, passwordHash, role);
  if (result.lastInsertRowid) return result.lastInsertRowid as number;
  return (db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any).id;
}

function clearAll() {
  [
    'com_order_items', 'com_orders', 'com_cart_promotions', 'com_cart_items',
    'com_carts', 'com_promotions', 'com_products',
    'hlt_records', 'hlt_medications', 'hlt_appointments', 'hlt_patients',
    'fin_audit_log', 'fin_transfers', 'fin_accounts', 'users',
  ].forEach(t => db.prepare(`DELETE FROM ${t}`).run());
}

seed();

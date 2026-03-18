import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

export function makeToken(user: { id: number; email: string; role: string }, expiresIn: number = 3600) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn });
}

export function makeExpiredToken(user: { id: number; email: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) - 60 },
    JWT_SECRET
  );
}

export function makeRecentlyExpiredToken(user: { id: number; email: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) - 10 },
    JWT_SECRET
  );
}

export function seedUser(db: Database.Database, email: string, role: string): number {
  const hash = bcrypt.hashSync('password', 10);
  const r = db.prepare('INSERT INTO users (email, passwordHash, role) VALUES (?, ?, ?)').run(email, hash, role);
  return r.lastInsertRowid as number;
}

export function seedAccount(db: Database.Database, userId: number, balancePence: number, id = uuidv4()): string {
  db.prepare(
    "INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, 'USD', 'current')"
  ).run(id, userId, `601613${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`, balancePence);
  return id;
}

export function getAccountBalance(db: Database.Database, accountId: string): number {
  return (db.prepare('SELECT balance FROM fin_accounts WHERE id = ?').get(accountId) as any).balance;
}

export function seedInventory(db: Database.Database, productId: string, quantity: number) {
  db.prepare('UPDATE com_products SET inventory = ? WHERE id = ?').run(quantity, productId);
}

// Seeds the standard demo users used by login-based integration tests
export function seedStandardUsers(db: Database.Database) {
  const users = [
    { email: 'alice@1platform.dev', password: 'password123', role: 'banker' },
    { email: 'bob@1platform.dev', password: 'password123', role: 'banker' },
    { email: 'patient.one@1platform.dev', password: 'password123', role: 'patient' },
    { email: 'patient.two@1platform.dev', password: 'password123', role: 'patient' },
    { email: 'shopper@1platform.dev', password: 'password123', role: 'shopper' },
  ];

  const ids: Record<string, number> = {};
  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 1); // bcrypt cost=1 for test speed
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email) as any;
    if (existing) { ids[u.email] = existing.id; continue; }
    const r = db.prepare('INSERT INTO users (email, passwordHash, role) VALUES (?, ?, ?)').run(u.email, hash, u.role);
    ids[u.email] = r.lastInsertRowid as number;
  }

  // Seed patient records for login-based health tests
  for (const [email, data] of [
    ['patient.one@1platform.dev', { nhs: '485 777 3456', dob: '1982-04-15', first: 'Margaret', last: 'Holloway' }],
    ['patient.two@1platform.dev', { nhs: '323 456 7890', dob: '1975-11-28', first: 'David', last: 'Okonkwo' }],
  ] as const) {
    const existing = db.prepare('SELECT id FROM hlt_patients WHERE userId = ?').get(ids[email]);
    if (!existing) {
      db.prepare('INSERT INTO hlt_patients (userId, nhsNumber, dateOfBirth, firstName, lastName) VALUES (?, ?, ?, ?, ?)')
        .run(ids[email], data.nhs, data.dob, data.first, data.last);
    }
  }

  // Seed finance accounts for alice
  const aliceAccountExists = db.prepare('SELECT id FROM fin_accounts WHERE userId = ?').get(ids['alice@1platform.dev']);
  if (!aliceAccountExists) {
    db.prepare("INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, 'USD', 'current')")
      .run('acc-alice-current', ids['alice@1platform.dev'], '60161331001234', 1_000_000);
    db.prepare("INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, 'USD', 'savings')")
      .run('acc-alice-savings', ids['alice@1platform.dev'], '60161331005678', 5_000_000);
    db.prepare("INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, 'USD', 'current')")
      .run('acc-bob-current', ids['bob@1platform.dev'], '60161331009012', 250_000);
  }

  // Seed lab results for patient 1 so regression tests can find expected records
  const p1Id = ids['patient.one@1platform.dev'];
  const p1Patient = db.prepare('SELECT id FROM hlt_patients WHERE userId = ?').get(p1Id) as any;
  if (p1Patient) {
    const labExists = db.prepare('SELECT id FROM hlt_lab_results WHERE patientId = ?').get(p1Patient.id);
    if (!labExists) {
      const labData = [
        [p1Patient.id, 'Total Cholesterol',       215,  'mg/dL',    0,  200,  'abnormal', 'Dr. Test',  new Date().toISOString(), 'Borderline high'],
        [p1Patient.id, 'HbA1c',                   5.6,  '%',        4,  5.7,  'normal',   'Dr. Test',  new Date().toISOString(), null],
        [p1Patient.id, 'Troponin I',               0.04, 'ng/mL',   0,  0.04, 'critical', 'Dr. Test',  new Date().toISOString(), 'CRITICAL: borderline'],
        [p1Patient.id, 'Hemoglobin',               13.8, 'g/dL',    12, 17.5, 'normal',   'Dr. Test',  new Date().toISOString(), null],
      ];
      for (const [pid, name, val, unit, rMin, rMax, status, by, at, notes] of labData) {
        db.prepare('INSERT INTO hlt_lab_results (id,patientId,testName,value,unit,referenceMin,referenceMax,status,orderedBy,collectedAt,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
          .run(uuidv4(), pid, name, val, unit, rMin, rMax, status, by, at, notes);
      }
    }

    // Seed prescriptions for patient 1
    const rxExists = db.prepare('SELECT id FROM hlt_prescriptions WHERE patientId = ?').get(p1Patient.id);
    if (!rxExists) {
      const future = new Date(Date.now() + 90 * 86400000).toISOString();
      const past   = new Date(Date.now() - 30 * 86400000).toISOString();
      db.prepare('INSERT INTO hlt_prescriptions (id,patientId,medicationName,dosage,unit,frequency,prescribedBy,expiresAt,status,refillsRemaining) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(uuidv4(), p1Patient.id, 'Lisinopril', '10', 'mg', 'Once daily', 'Dr. Test', future, 'active', 3);
      db.prepare('INSERT INTO hlt_prescriptions (id,patientId,medicationName,dosage,unit,frequency,prescribedBy,expiresAt,status,refillsRemaining) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(uuidv4(), p1Patient.id, 'Aspirin', '75', 'mg', 'Once daily', 'Dr. Test', past, 'expired', 0);
    }

    // Seed appointments for patient 1
    const apptExists = db.prepare('SELECT id FROM hlt_appointments WHERE patientId = ?').get(p1Patient.id);
    if (!apptExists) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      db.prepare('INSERT INTO hlt_appointments (id,patientId,doctorId,datetime,status,notes) VALUES (?,?,?,?,?,?)')
        .run(uuidv4(), p1Patient.id, 'Dr. Test', tomorrow, 'scheduled', 'Test appointment');
    }

    // Seed medications for DOSAGE_TYPE_MISMATCH test (dosage stored as TEXT)
    const medExists = db.prepare('SELECT id FROM hlt_medications WHERE patientId = ?').get(p1Patient.id);
    if (!medExists) {
      db.prepare('INSERT INTO hlt_medications (id,patientId,name,dosage,unit,frequency,status) VALUES (?,?,?,?,?,?,?)')
        .run(uuidv4(), p1Patient.id, 'Lisinopril', '10', 'mg', 'Once daily', 'active');
    }
  }

  // Seed products for commerce tests
  const productExists = db.prepare("SELECT id FROM com_products WHERE id = 'PROD-TEST-001'").get();
  if (!productExists) {
    db.prepare('INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)')
      .run('PROD-TEST-001', 'Test Product', 'A product for testing', 29.99, 50, null);
    db.prepare('INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)')
      .run('PROD-TEST-002', 'Test Product 2', 'Another product for testing', 49.99, 10, null);
    db.prepare('INSERT INTO com_products (id, name, description, price, inventory, imageUrl) VALUES (?, ?, ?, ?, ?, ?)')
      .run('PROD-999', 'Limited Edition Cap', 'Last one in stock', 29.99, 1, null);
  }

  return ids;
}

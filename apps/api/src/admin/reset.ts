import { Request, Response } from 'express';
import { db } from '../db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const pastDate = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const futureDate = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function clearAll() {
  const tables = [
    'com_loyalty_transactions', 'com_loyalty', 'com_returns', 'com_wishlist',
    'com_order_items', 'com_orders', 'com_cart_promotions', 'com_cart_items',
    'com_carts', 'com_promotions', 'com_products',
    'fin_fraud_events', 'fin_beneficiaries', 'fin_cards',
    'hlt_mfa_sessions', 'hlt_notification_prefs', 'hlt_billing', 'hlt_insurance',
    'hlt_messages', 'hlt_prescriptions', 'hlt_lab_results',
    'hlt_records', 'hlt_medications', 'hlt_appointments', 'hlt_patients',
    'fin_audit_log', 'fin_transfers', 'fin_accounts', 'users',
  ];
  for (const t of tables) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch {}
  }
  try { db.prepare(`DELETE FROM sqlite_sequence`).run(); } catch {}
}

function insertUser(email: string, passwordHash: string, role: string): number {
  const r = db.prepare('INSERT OR IGNORE INTO users (email,passwordHash,role) VALUES (?,?,?)').run(email, passwordHash, role);
  if (r.lastInsertRowid) return r.lastInsertRowid as number;
  return (db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any).id;
}

export function resetAndReseed(_req: Request, res: Response) {
  // Pre-compute hashes outside the transaction (bcrypt is CPU-bound)
  const pw = bcrypt.hashSync('password123', 10);

  const run = db.transaction(() => {
    clearAll();

    const aliceId = insertUser('alice@1platform.dev', pw, 'banker');
    const bobId = insertUser('bob@1platform.dev', pw, 'banker');
    const p1Id = insertUser('patient.one@1platform.dev', pw, 'patient');
    const p2Id = insertUser('patient.two@1platform.dev', pw, 'patient');
    const shopId = insertUser('shopper@1platform.dev', pw, 'shopper');

    const aliceCurrentId = uuidv4(), aliceSavingsId = uuidv4(), aliceIsaId = uuidv4();
    const bobCurrentId = uuidv4(), nexaHouseId = uuidv4();

    const acctInsert = db.prepare(`INSERT INTO fin_accounts (id,userId,accountNumber,balance,currency,type) VALUES (?,?,?,?,?,?)`);
    acctInsert.run(aliceCurrentId, aliceId, '60161331001234', 1_000_000 + rnd(0, 50000), 'USD', 'current');
    acctInsert.run(aliceSavingsId, aliceId, '60161331005678', 5_000_000 + rnd(0, 200000), 'USD', 'savings');
    acctInsert.run(aliceIsaId, aliceId, '60161331007890', 2_000_000 + rnd(0, 100000), 'USD', 'isa');
    acctInsert.run(bobCurrentId, bobId, '60161331009012', 250_000 + rnd(0, 20000), 'USD', 'current');
    acctInsert.run(nexaHouseId, bobId, '60161331003456', 10_000 + rnd(0, 5000), 'USD', 'current');

    const transferData = [
      { from: bobCurrentId, to: aliceCurrentId, amount: 350000, ref: 'Salary — March', daysAgo: 2, status: 'COMPLETED' },
      { from: bobCurrentId, to: aliceCurrentId, amount: 350000, ref: 'Salary — February', daysAgo: 32, status: 'COMPLETED' },
      { from: bobCurrentId, to: aliceCurrentId, amount: 350000, ref: 'Salary — January', daysAgo: 62, status: 'COMPLETED' },
      { from: bobCurrentId, to: aliceCurrentId, amount: 350000, ref: 'Salary — December', daysAgo: 93, status: 'COMPLETED' },
      { from: bobCurrentId, to: aliceCurrentId, amount: 350000, ref: 'Salary — November', daysAgo: 123, status: 'COMPLETED' },
      { from: bobCurrentId, to: aliceCurrentId, amount: 350000, ref: 'Salary — October', daysAgo: 153, status: 'COMPLETED' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 95000, ref: 'Rent — March', daysAgo: 3, status: 'COMPLETED' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 95000, ref: 'Rent — February', daysAgo: 33, status: 'COMPLETED' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 95000, ref: 'Rent — January', daysAgo: 63, status: 'COMPLETED' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 95000, ref: 'Rent — December', daysAgo: 94, status: 'COMPLETED' },
      { from: aliceCurrentId, to: bobCurrentId, amount: 5000, ref: 'Netflix split', daysAgo: 5, status: 'COMPLETED' },
      { from: aliceCurrentId, to: bobCurrentId, amount: 5000, ref: 'Netflix split', daysAgo: 35, status: 'COMPLETED' },
      { from: aliceCurrentId, to: bobCurrentId, amount: 5000, ref: 'Netflix split', daysAgo: 65, status: 'COMPLETED' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 18000, ref: 'Council tax', daysAgo: 7, status: 'COMPLETED' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 18000, ref: 'Council tax', daysAgo: 37, status: 'COMPLETED' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 18000, ref: 'Council tax', daysAgo: 67, status: 'COMPLETED' },
      { from: aliceCurrentId, to: aliceSavingsId, amount: 50000, ref: 'Monthly savings', daysAgo: 4, status: 'COMPLETED' },
      { from: aliceCurrentId, to: aliceSavingsId, amount: 50000, ref: 'Monthly savings', daysAgo: 34, status: 'COMPLETED' },
      { from: aliceCurrentId, to: aliceSavingsId, amount: 50000, ref: 'Monthly savings', daysAgo: 64, status: 'COMPLETED' },
      { from: aliceCurrentId, to: bobCurrentId, amount: rnd(1000, 5000), ref: 'Dinner', daysAgo: 8, status: 'COMPLETED' },
      { from: bobCurrentId, to: aliceCurrentId, amount: rnd(1000, 3000), ref: 'Petrol', daysAgo: 11, status: 'COMPLETED' },
      { from: aliceCurrentId, to: bobCurrentId, amount: rnd(500, 2000), ref: 'Coffee', daysAgo: 14, status: 'COMPLETED' },
      { from: aliceCurrentId, to: bobCurrentId, amount: rnd(2000, 8000), ref: 'Groceries', daysAgo: 17, status: 'COMPLETED' },
      { from: aliceCurrentId, to: bobCurrentId, amount: 10, ref: 'Coffee money', daysAgo: 0, status: 'PENDING' },
      { from: aliceCurrentId, to: nexaHouseId, amount: 10, ref: 'Jan standing order', daysAgo: 1, status: 'PENDING' },
      // BUG SUMMARY_FLOAT_DRIFT: amounts that trigger float trap
      { from: aliceCurrentId, to: bobCurrentId, amount: 10, ref: 'Precise transfer 0.10', daysAgo: 20, status: 'COMPLETED' },
      { from: bobCurrentId, to: aliceCurrentId, amount: 20, ref: 'Precise transfer 0.20', daysAgo: 20, status: 'COMPLETED' },
    ];
    for (const t of transferData) {
      const tid = uuidv4(), aid = uuidv4();
      const createdAt = pastDate(t.daysAgo);
      db.prepare(`INSERT INTO fin_transfers (id,fromAccountId,toAccountId,amount,currency,reference,status,auditId,createdAt) VALUES (?,?,?,?,?,?,?,?,?)`).run(tid, t.from, t.to, t.amount, 'USD', t.ref, t.status, aid, createdAt);
      db.prepare(`INSERT INTO fin_audit_log (id,transferId,action,metadata,createdAt) VALUES (?,?,?,?,?)`).run(aid, tid, 'TRANSFER_CREATED', JSON.stringify({ amount: t.amount, ref: t.ref }), createdAt);
    }

    const cardInsert = db.prepare(`INSERT INTO fin_cards (id,accountId,userId,cardType,lastFour,cardholderName,expiresAt,status,dailyLimit) VALUES (?,?,?,?,?,?,?,?,?)`);
    cardInsert.run(uuidv4(), aliceCurrentId, aliceId, 'debit', `${rnd(1000, 9999)}`, 'Alice Smith', '2027-12-31', 'active', 50000);
    cardInsert.run(uuidv4(), aliceSavingsId, aliceId, 'virtual', `${rnd(1000, 9999)}`, 'Alice Smith', '2026-06-30', 'frozen', 20000);
    cardInsert.run(uuidv4(), aliceIsaId, aliceId, 'virtual', `${rnd(1000, 9999)}`, 'Alice Smith', '2025-12-31', 'active', 10000);

    const benefInsert = db.prepare(`INSERT INTO fin_beneficiaries (id,userId,name,accountNumber,sortCode,reference) VALUES (?,?,?,?,?,?)`);
    benefInsert.run(uuidv4(), aliceId, 'Bob Jones', '60161331009012', '601613', 'Rent split');
    benefInsert.run(uuidv4(), aliceId, '1Platform Housing', '60161331003456', '601613', 'Monthly standing order');
    benefInsert.run(uuidv4(), aliceId, 'EnergyPlus Ltd', '20304050607080', '203040', 'Electricity bill');
    benefInsert.run(uuidv4(), aliceId, 'City Gym', '11223344556677', '112233', 'Membership');

    const fraudInsert = db.prepare(`INSERT INTO fin_fraud_events (id,userId,accountId,type,severity,description,resolved) VALUES (?,?,?,?,?,?,?)`);
    fraudInsert.run(uuidv4(), aliceId, aliceCurrentId, 'UNUSUAL_LOCATION', 'low', 'Sign-in from new device in Manchester', 1);
    fraudInsert.run(uuidv4(), aliceId, aliceCurrentId, 'LARGE_TRANSACTION', 'medium', 'Transfer of $500+ to new payee — please verify this was you', 0);
    fraudInsert.run(uuidv4(), aliceId, aliceCurrentId, 'CARD_NOT_PRESENT', 'low', 'Online purchase attempted with card not registered for 3D Secure', 1);

    db.prepare(`INSERT INTO hlt_patients (userId,nhsNumber,dateOfBirth,firstName,lastName) VALUES (?,?,?,?,?)`).run(p1Id, '485 777 3456', '1982-04-15', 'Margaret', 'Holloway');
    db.prepare(`INSERT INTO hlt_patients (userId,nhsNumber,dateOfBirth,firstName,lastName) VALUES (?,?,?,?,?)`).run(p2Id, '323 456 7890', '1975-11-28', 'David', 'Okonkwo');

    const apptData = [
      [1, 'Dr. Sarah Chen',   futureDate(7),   'scheduled',  'Annual cardiovascular review'],
      [1, 'Dr. Raj Patel',    futureDate(21),  'scheduled',  'Blood pressure follow-up'],
      [1, 'Dr. Sarah Chen',   pastDate(30),    'completed',  'Lipid panel review — results discussed'],
      [1, 'Dr. Sarah Chen',   pastDate(90),    'completed',  'Routine check-up'],
      [2, 'Dr. Raj Patel',    pastDate(30),    'completed',  'Follow-up on blood pressure medication'],
      [2, 'Dr. Amara Diallo', futureDate(14),  'scheduled',  'Annual wellness visit'],
    ];
    for (const [pid, doc, dt, status, notes] of apptData) {
      db.prepare(`INSERT INTO hlt_appointments (id,patientId,doctorId,datetime,status,notes) VALUES (?,?,?,?,?,?)`).run(uuidv4(), pid, doc, dt, status, notes);
    }

    for (const [pid, name, dose, unit, freq, status] of [
      [1, 'Lisinopril',   '10',  'mg', 'Once daily',           'active'],
      [1, 'Atorvastatin', '20',  'mg', 'Once daily at bedtime','active'],
      [1, 'Aspirin',      '75',  'mg', 'Once daily',           'active'],
      [2, 'Amlodipine',   '5',   'mg', 'Once daily',           'active'],
      [2, 'Metformin',    '500', 'mg', 'Twice daily with food','active'],
    ] as const) {
      db.prepare(`INSERT INTO hlt_medications (id,patientId,name,dosage,unit,frequency,status) VALUES (?,?,?,?,?,?,?)`).run(uuidv4(), pid, name, dose, unit, freq, status);
    }

    for (const [pid, name, val, unit, rMin, rMax, status, by, at, notes] of [
      [1, 'HbA1c',                   5.6,  '%',        4.0, 5.7,  'normal',   'Dr. Sarah Chen', pastDate(7),  'Within normal range'],
      [1, 'Total Cholesterol',       215,  'mg/dL',    0,   200,  'abnormal', 'Dr. Sarah Chen', pastDate(7),  'Borderline high — dietary review recommended'],
      [1, 'Blood Pressure Systolic', 132,  'mmHg',     90,  120,  'abnormal', 'Dr. Sarah Chen', pastDate(1),  'Slightly elevated'],
      [1, 'Hemoglobin',              13.8, 'g/dL',     12,  17.5, 'normal',   'Dr. Raj Patel',  pastDate(14), null],
      [1, 'Troponin I',              0.04, 'ng/mL',    0,   0.04, 'critical', 'Dr. Sarah Chen', pastDate(0),  'CRITICAL: borderline — urgent follow-up required'],
      [1, 'Fasting Glucose',         5.2,  'mmol/L',   3.9, 5.5,  'normal',   'Dr. Raj Patel',  pastDate(45), 'Within target range'],
      [1, 'eGFR',                    82,   'mL/min',   60,  120,  'normal',   'Dr. Sarah Chen', pastDate(30), 'Kidney function normal'],
      [2, 'HbA1c',                   48,   'mmol/mol', 20,  41,   'abnormal', 'Dr. Raj Patel',  pastDate(10), 'Pre-diabetic range — lifestyle review advised'],
      [2, 'Blood Pressure Systolic', 145,  'mmHg',     90,  120,  'abnormal', 'Dr. Raj Patel',  pastDate(5),  'Hypertension stage 1'],
    ] as const) {
      db.prepare(`INSERT INTO hlt_lab_results (id,patientId,testName,value,unit,referenceMin,referenceMax,status,orderedBy,collectedAt,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(uuidv4(), pid, name, val, unit, rMin, rMax, status, by, at, notes);
    }

    for (const [pid, med, dose, unit, freq, by, exp, status, refills] of [
      [1, 'Lisinopril',   '10', 'mg', 'Once daily',           'Dr. Sarah Chen', futureDate(90),  'active',  3],
      [1, 'Atorvastatin', '20', 'mg', 'Once daily at bedtime','Dr. Sarah Chen', futureDate(180), 'active',  0],
      [1, 'Aspirin',      '75', 'mg', 'Once daily',           'Dr. Sarah Chen', pastDate(30),    'expired', 0],
      [2, 'Amlodipine',   '5',  'mg', 'Once daily',           'Dr. Raj Patel',  futureDate(60),  'active',  2],
      [2, 'Metformin',    '500','mg', 'Twice daily with food', 'Dr. Raj Patel',  futureDate(120), 'active',  5],
    ] as const) {
      db.prepare(`INSERT INTO hlt_prescriptions (id,patientId,medicationName,dosage,unit,frequency,prescribedBy,expiresAt,status,refillsRemaining) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uuidv4(), pid, med, dose, unit, freq, by, exp, status, refills);
    }

    for (const [senderId, recipId, patientId, subject, body, isRead, sentAt] of [
      [p1Id, null, 1, 'Lab results available',      'Your recent blood panel results are now available. Your HbA1c is within normal range but your cholesterol is slightly elevated.', 1, pastDate(7)],
      [p1Id, null, 1, 'Appointment reminder',        'Reminder: upcoming appointment next week for your annual cardiovascular review. Please fast for 12 hours beforehand.',            1, pastDate(5)],
      [p1Id, null, 1, 'Prescription renewal approved','Your renewal request for Lisinopril 10mg has been approved and sent to your pharmacy.',                                         1, pastDate(2)],
      [p1Id, null, 1, 'Follow-up required',           'Following your recent Troponin I result, we recommend scheduling a follow-up appointment as soon as possible.',                0, pastDate(0)],
      [p2Id, null, 2, 'Blood pressure update',        'Your latest readings show blood pressure in the hypertensive range. We have increased your Amlodipine dose.',                  1, pastDate(5)],
      [p2Id, null, 2, 'Diabetes screening',           'Your HbA1c indicates pre-diabetic levels. We recommend a dietary consultation.',                                               0, pastDate(1)],
    ] as const) {
      db.prepare(`INSERT INTO hlt_messages (id,senderId,recipientId,patientId,subject,body,isRead,sentAt) VALUES (?,?,?,?,?,?,?,?)`).run(uuidv4(), senderId, recipId, patientId, subject, body, isRead, sentAt);
    }

    db.prepare(`INSERT INTO hlt_insurance (id,patientId,provider,policyNumber,groupNumber,memberName,effectiveDate,expirationDate,copay,status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uuidv4(), 1, 'NexaHealth Insurance', 'NH-2024-448871', 'GRP-001', 'Margaret Holloway', '2024-01-01', '2026-12-31', 20, 'active');
    db.prepare(`INSERT INTO hlt_insurance (id,patientId,provider,policyNumber,groupNumber,memberName,effectiveDate,expirationDate,copay,status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uuidv4(), 2, 'BUPA Health', 'BUP-5839204', 'GRP-002', 'David Okonkwo', '2023-06-01', '2025-05-31', 15, 'active');

    for (const [pid, desc, amount, status, svcDate, dueDate, insCov, patResp] of [
      [1, 'Annual cardiovascular review',            250.00, 'paid',    pastDate(90), pastDate(75),   200.00, 50.00],
      [1, 'Blood panel — HbA1c + cholesterol + CBC', 180.00, 'pending', pastDate(7),  futureDate(14), 144.00, 36.00],
      [1, 'Prescription administration fee',          12.50, 'paid',    pastDate(30), pastDate(15),     0.00, 12.50],
      [1, 'Urgent care visit',                       350.00, 'pending', pastDate(3),  futureDate(28), 280.00, 70.00],
      [2, 'Hypertension consultation',               180.00, 'paid',    pastDate(30), pastDate(15),   153.00, 27.00],
      [2, 'Diabetes screening panel',                220.00, 'pending', pastDate(10), futureDate(21), 187.00, 33.00],
    ] as const) {
      db.prepare(`INSERT INTO hlt_billing (id,patientId,description,amount,status,serviceDate,dueDate,insuranceCovered,patientResponsibility) VALUES (?,?,?,?,?,?,?,?,?)`).run(uuidv4(), pid, desc, amount, status, svcDate, dueDate, insCov, patResp);
    }

    db.prepare(`INSERT OR IGNORE INTO hlt_notification_prefs (patientId,emailAppointments,smsAppointments,emailLabResults,smsLabResults,emailBilling,emailMessages) VALUES (?,?,?,?,?,?,?)`).run(1, 1, 1, 1, 0, 1, 1);
    db.prepare(`INSERT OR IGNORE INTO hlt_notification_prefs (patientId,emailAppointments,smsAppointments,emailLabResults,smsLabResults,emailBilling,emailMessages) VALUES (?,?,?,?,?,?,?)`).run(2, 1, 0, 1, 0, 1, 0);

    const lf = (keywords: string, lock: number) =>
      `https://loremflickr.com/400/260/${keywords}?lock=${lock}`;

    const products: [string, string, number, number, string, string][] = [
      // Electronics (8)
      ['GPS Sport Watch',                    'Multi-sport GPS, heart rate, 24-hour battery',              199.99, 12 + rnd(0,5),  lf('smartwatch,fitness',          1),  'Electronics'],
      ['Wireless Noise-Cancelling Headphones','Active noise cancellation, 30h battery, premium sound',   149.99, 18 + rnd(0,5),  lf('headphones,audio',            2),  'Electronics'],
      ['Smart Home Hub',                     'Voice control, compatible with 1000+ devices',               79.99, 25 + rnd(0,5),  lf('smart,speaker,home',          3),  'Electronics'],
      ['Portable Charger 20000mAh',          'Fast charge, USB-C + USB-A, airline approved',               39.99, 45 + rnd(0,10), lf('powerbank,charger,usb',       4),  'Electronics'],
      ['Action Camera 4K',                   'Waterproof to 30m, image stabilisation, wide angle',         89.99, 15 + rnd(0,5),  lf('action,camera,gopro',         5),  'Electronics'],
      ['Mechanical Keyboard TKL',            'Tactile switches, RGB backlight, tenkeyless layout',         85.00, 30 + rnd(0,8),  lf('mechanical,keyboard,rgb',     6),  'Electronics'],
      ['USB-C Monitor 24"',                  '1080p IPS, 75Hz, USB-C power delivery, VESA mount',         219.99, 15 + rnd(0,5),  lf('computer,monitor,screen',     7),  'Electronics'],
      ['Wireless Earbuds Pro',               'Active noise cancellation, 6h battery, IP54 rated',          119.99, 25 + rnd(0,8),  lf('earbuds,wireless,earphones',  8),  'Electronics'],
      // Clothing (7)
      ['Running Shoes V2',                   'Lightweight responsive running shoe, neutral cushioning',     89.99, 47 + rnd(0,10), lf('running,shoes,sneakers',      9),  'Clothing'],
      ['Waterproof Trail Jacket',            '3-layer Gore-Tex shell, seam-sealed, packable',             149.99, 23 + rnd(0,5),  lf('hiking,jacket,outdoor',      10),  'Clothing'],
      ['Merino Wool Base Layer',             'Temperature regulating, odour resistant, 100% merino',       59.99, 35 + rnd(0,10), lf('wool,sweater,merino',         11),  'Clothing'],
      ['Performance Shorts',                'Quick-dry fabric, 7-inch inseam, phone pocket',               34.99, 60 + rnd(0,15), lf('sport,shorts,running',        12),  'Clothing'],
      ['Compression Socks Pack',             'Graduated compression, 3 pairs, moisture-wicking',           22.99, 80 + rnd(0,20), lf('socks,compression,sport',     13),  'Clothing'],
      ['Cycling Jersey Pro',                'Race-fit, UPF 50+, three rear pockets, reflective trim',      69.99, 20 + rnd(0,5),  lf('cycling,jersey,bicycle',      14),  'Clothing'],
      // only 1 in stock — used for race condition tests
      ['Limited Edition Cap',               'Last one in stock — signed by the team',                       29.99, 1,              lf('snapback,cap,hat',            15),  'Clothing'],
      // Sports (7)
      ['Technical Backpack 28L',            'Hydration-compatible, laptop sleeve, weatherproof',            74.95, 31 + rnd(0,8),  lf('backpack,hiking,outdoor',     16),  'Sports'],
      ['Foam Roller Pro',                   'High-density EVA, deep tissue massage, textured',               24.99, 80 + rnd(0,20), lf('foam,roller,fitness',         17),  'Sports'],
      ['Resistance Bands Set',              '5 levels of resistance, latex-free, includes guide',            19.99, 120 + rnd(0,20),lf('resistance,bands,workout',    18),  'Sports'],
      ['Yoga Mat Premium',                  '6mm thick, non-slip, alignment guides, carry strap',            45.99, 50 + rnd(0,10), lf('yoga,mat,exercise',           19),  'Sports'],
      ['Adjustable Dumbbells 20kg',         'Quick-lock dial, 10 weight settings, compact storage',         129.99, 12 + rnd(0,5),  lf('dumbbells,weights,gym',       20),  'Sports'],
      ['Pull-Up Bar Doorframe',             'No-screw install, 120kg max load, foam grips',                  34.99, 40 + rnd(0,10), lf('pullup,bar,gym',              21),  'Sports'],
      ['Speed Jump Rope',                   'Ball-bearing handles, adjustable cable, speed training',        14.99, 75 + rnd(0,20), lf('jump,rope,skipping',          22),  'Sports'],
      // Home (7)
      ['Smart LED Desk Lamp',               'Adjustable colour temp, USB charging port, touch dim',          49.99, 40 + rnd(0,10), lf('desk,lamp,light',             23),  'Home'],
      ['Pour-Over Coffee Set',              'Borosilicate carafe + kettle, barista-grade',                   65.00, 28 + rnd(0,8),  lf('coffee,pourover,brewing',     24),  'Home'],
      ['Air Purifier HEPA',                'HEPA H13 filter, quiet mode, covers 50m²',                     129.99, 20 + rnd(0,5),  lf('air,purifier,home',           25),  'Home'],
      ['Bamboo Desk Organiser',             'Sustainable bamboo, 6 compartments, cable routing',              32.99, 65 + rnd(0,15), lf('desk,organizer,office',       26),  'Home'],
      ['Aromatherapy Diffuser',             '400ml ultrasonic, 7-colour LED, auto shut-off, 8h runtime',     27.99, 55 + rnd(0,15), lf('diffuser,aromatherapy,spa',   27),  'Home'],
      ['Smart Plug 4-Pack',                'Energy monitoring, schedule timer, works with Alexa & Google',   29.99, 35 + rnd(0,10), lf('smart,plug,outlet',           28),  'Home'],
      ['Whiteboard Planner A3',             'Weekly dry-erase planner, magnetic, includes marker set',        18.99, 60 + rnd(0,15), lf('whiteboard,office,planning',  29),  'Home'],
      // Books (6)
      ['Clean Code',                        'A handbook of agile software craftsmanship — Robert C. Martin', 29.99, 55 + rnd(0,10), lf('programming,book,code',       30),  'Books'],
      ['Designing Data-Intensive Applications','The big ideas behind reliable, scalable systems',             44.99, 40 + rnd(0,10), lf('data,book,technology',        31),  'Books'],
      ['Atomic Habits',                     'An easy & proven way to build good habits — James Clear',        14.99, 90 + rnd(0,20), lf('book,habits,reading',         32),  'Books'],
      ['The Pragmatic Programmer',          'From journeyman to master, 20th anniversary edition',            39.99, 35 + rnd(0,10), lf('programming,book,software',   33),  'Books'],
      ['Staff Engineer',                    'Leadership beyond the management track — Will Larson',           32.99, 28 + rnd(0,8),  lf('book,leadership,engineering', 34),  'Books'],
      ['System Design Interview',           'An insider guide — scalable systems, vol. 1',                    34.99, 45 + rnd(0,10), lf('book,computer,study',         35),  'Books'],
    ];

    const productIds: Record<string, string> = {};
    for (const [name, desc, price, inv, image, cat] of products) {
      const id = uuidv4();
      productIds[name] = id;
      db.prepare(`INSERT INTO com_products (id,name,description,price,inventory,imageUrl,category) VALUES (?,?,?,?,?,?,?)`).run(id, name, desc, price, inv, image, cat);
    }
    db.prepare(`INSERT OR IGNORE INTO com_products (id,name,description,price,inventory,imageUrl,category) VALUES (?,?,?,?,?,?,?)`).run('PROD-999', 'Limited Edition Cap', 'Last one in stock — signed by the team', 29.99, 1, lf('snapback,cap,hat', 15), 'Clothing');

    const promoInsert = db.prepare(`INSERT INTO com_promotions (id,code,discountType,discountValue,maxUses) VALUES (?,?,?,?,?)`);
    promoInsert.run(uuidv4(), 'SAVE10', 'percentage', 10, 100);
    promoInsert.run(uuidv4(), 'FLAT5', 'fixed', 5, 50);
    promoInsert.run(uuidv4(), 'WELCOME20', 'percentage', 20, 200);
    promoInsert.run(uuidv4(), 'SUMMER15', 'percentage', 15, 75);

    const ordersToSeed = [
      { status: 'delivered', daysAgo: 60, items: [['Running Shoes V2', 1], ['Merino Wool Base Layer', 2]] as [string, number][] },
      { status: 'delivered', daysAgo: 45, items: [['Clean Code', 1], ['Atomic Habits', 1]] as [string, number][] },
      { status: 'delivered', daysAgo: 30, items: [['Foam Roller Pro', 1], ['Resistance Bands Set', 1]] as [string, number][] },
      { status: 'shipped',   daysAgo: 5,  items: [['Waterproof Trail Jacket', 1]] as [string, number][] },
      { status: 'shipped',   daysAgo: 3,  items: [['GPS Sport Watch', 1]] as [string, number][] },
      { status: 'processing',daysAgo: 2,  items: [['Smart LED Desk Lamp', 1], ['Bamboo Desk Organiser', 1]] as [string, number][] },
      { status: 'processing',daysAgo: 1,  items: [['Air Purifier HEPA', 1]] as [string, number][] },
      { status: 'paid',      daysAgo: 1,  items: [['Pour-Over Coffee Set', 1]] as [string, number][] },
      { status: 'paid',      daysAgo: 0,  items: [['Wireless Noise-Cancelling Headphones', 1], ['Portable Charger 20000mAh', 1]] as [string, number][] },
      { status: 'cancelled', daysAgo: 15, items: [['Action Camera 4K', 1]] as [string, number][] },
    ];

    for (const o of ordersToSeed) {
      const cartId = uuidv4(), orderId = uuidv4();
      const createdAt = pastDate(o.daysAgo);

      const lines: { pid: string; qty: number; price: number }[] = [];
      for (const [productName, qty] of o.items) {
        const pid = productIds[productName];
        if (!pid) continue;
        const product = db.prepare('SELECT price FROM com_products WHERE id = ?').get(pid) as any;
        if (!product) continue;
        lines.push({ pid, qty, price: product.price });
      }
      if (!lines.length) continue;

      const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

      db.prepare(`INSERT INTO com_carts (id,userId,status,createdAt) VALUES (?,?,?,?)`).run(cartId, shopId, 'checked_out', createdAt);
      db.prepare(`INSERT INTO com_orders (id,userId,cartId,status,total,emailSent,createdAt) VALUES (?,?,?,?,?,?,?)`).run(orderId, shopId, cartId, o.status, total, 1, createdAt);

      for (const { pid, qty, price } of lines) {
        db.prepare(`INSERT INTO com_cart_items (id,cartId,productId,quantity) VALUES (?,?,?,?)`).run(uuidv4(), cartId, pid, qty);
        db.prepare(`INSERT INTO com_order_items (id,orderId,productId,quantity,price) VALUES (?,?,?,?,?)`).run(uuidv4(), orderId, pid, qty, price);
      }
    }

    const deliveredOrder = db.prepare(`SELECT id FROM com_orders WHERE userId = ? AND status = 'delivered' LIMIT 1`).get(shopId) as any;
    if (deliveredOrder) {
      db.prepare(`INSERT INTO com_returns (id,orderId,userId,reason,status,requestedAt,refundAmount) VALUES (?,?,?,?,?,?,?)`).run(uuidv4(), deliveredOrder.id, shopId, 'Item did not fit — size ran small', 'approved', pastDate(25), 89.99);
    }

    const loyaltyPoints = 850 + rnd(0, 400);
    db.prepare(`INSERT INTO com_loyalty (id,userId,points,tier,totalEarned) VALUES (?,?,?,?,?)`).run(uuidv4(), shopId, loyaltyPoints, loyaltyPoints >= 1000 ? 'silver' : 'bronze', loyaltyPoints);
    const loyaltyTxInsert = db.prepare(`INSERT INTO com_loyalty_transactions (id,userId,type,points,description,createdAt) VALUES (?,?,?,?,?,?)`);
    loyaltyTxInsert.run(uuidv4(), shopId, 'earn', 350, 'Order #1 — Running Shoes', pastDate(60));
    loyaltyTxInsert.run(uuidv4(), shopId, 'earn', 150, 'Order #2 — Books', pastDate(45));
    loyaltyTxInsert.run(uuidv4(), shopId, 'earn', loyaltyPoints - 500, 'Recent orders', pastDate(10));

    if (productIds['GPS Sport Watch'])
      db.prepare(`INSERT INTO com_wishlist (id,userId,productId) VALUES (?,?,?)`).run(uuidv4(), shopId, productIds['GPS Sport Watch']);
    if (productIds['Waterproof Trail Jacket'])
      db.prepare(`INSERT INTO com_wishlist (id,userId,productId) VALUES (?,?,?)`).run(uuidv4(), shopId, productIds['Waterproof Trail Jacket']);
    if (productIds['Designing Data-Intensive Applications'])
      db.prepare(`INSERT INTO com_wishlist (id,userId,productId) VALUES (?,?,?)`).run(uuidv4(), shopId, productIds['Designing Data-Intensive Applications']);

  });

  try {
    run();
    return res.json({ ok: true, message: 'Demo data reset successfully' });
  } catch (err: any) {
    console.error('Reset failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

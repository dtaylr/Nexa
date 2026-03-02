import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { makeToken, seedUser } from '../../helpers';

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b[A-Z]{2}\d{6}[A-Z]\b/,
  /patient[_-]?id.*[:=].*\d+/i,
  /\b\d{3}\s\d{3}\s\d{4}\b/,
];

let db: Database.Database;
let app: any;
let supertest: any;

beforeAll(async () => {
  const { db: testDb } = await import('../../../apps/api/src/db');
  db = testDb;
  const { app: testApp } = await import('../../../apps/api/src/index');
  app = testApp;
  supertest = (await import('supertest')).default;
});

describe('Health API — PII Leakage & IDOR', () => {
  let patient1Token: string;
  let patient2Token: string;
  let patient1Id: number;
  let patient2Id: number;
  let patientRow1: number;
  let patientRow2: number;

  beforeEach(() => {
    patient1Id = seedUser(db, `p1-${uuidv4()}@test.dev`, 'patient');
    patient2Id = seedUser(db, `p2-${uuidv4()}@test.dev`, 'patient');
    patient1Token = makeToken({ id: patient1Id, email: 'p1@test.dev', role: 'patient' });
    patient2Token = makeToken({ id: patient2Id, email: 'p2@test.dev', role: 'patient' });

    const r1 = db.prepare(
      "INSERT INTO hlt_patients (userId, nhsNumber, dateOfBirth, firstName, lastName) VALUES (?, ?, ?, ?, ?)"
    ).run(patient1Id, '485 777 3456', '1982-04-15', 'Margaret', 'Holloway');
    patientRow1 = r1.lastInsertRowid as number;

    const r2 = db.prepare(
      "INSERT INTO hlt_patients (userId, nhsNumber, dateOfBirth, firstName, lastName) VALUES (?, ?, ?, ?, ?)"
    ).run(patient2Id, '323 456 7890', '1975-11-28', 'David', 'Okonkwo');
    patientRow2 = r2.lastInsertRowid as number;
  });

  it('HLT-002: error responses must not contain patient PII', async () => {
    const res = await supertest(app)
      .get('/api/health/patients/INVALID_ID')
      .set('Authorization', `Bearer ${patient1Token}`);

    expect(res.status).toBe(400);
    const body = JSON.stringify(res.body);

    for (const pattern of PII_PATTERNS) {
      expect(body, `PII pattern ${pattern} found in error response (HLT-002)`).not.toMatch(pattern);
    }

    // BUG HLT-002: the response currently echoes back the patientId
    expect(res.body, 'Patient ID leaked in error body (HLT-002)').not.toHaveProperty('patientId');
  });

  it('HLT-005: patient cannot access another patients records via sequential ID (IDOR)', async () => {
    const otherPatientId = patientRow2;

    const res = await supertest(app)
      .get(`/api/health/patients/${otherPatientId}/records`)
      .set('Authorization', `Bearer ${patient1Token}`);

    // BUG HLT-005: API currently returns 200 with the other patient's records
    expect(res.status, `IDOR: patient 1 accessed patient ${otherPatientId}'s records (HLT-005)`).toBe(403);
    expect(res.body).not.toHaveProperty('records');
  });

  it('HLT-005: patient can access their own records', async () => {
    const res = await supertest(app)
      .get(`/api/health/patients/${patientRow1}`)
      .set('Authorization', `Bearer ${patient1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Margaret');
  });

  it('HLT-001: medication dosage must be a number, not a string', async () => {
    db.prepare(
      "INSERT INTO hlt_medications (id, patientId, name, dosage, unit, frequency, status) VALUES (?, ?, ?, ?, ?, ?, 'active')"
    ).run(uuidv4(), patientRow1, 'Lisinopril', '10', 'mg', 'Once daily');

    const res = await supertest(app)
      .get(`/api/health/patients/${patientRow1}/medications`)
      .set('Authorization', `Bearer ${patient1Token}`);

    expect(res.status).toBe(200);

    const med = res.body.medications[0];
    expect(med).toBeDefined();

    // BUG HLT-001: dosage.value is a string ("10") instead of a number (10)
    expect(typeof med.dosage.value, `Dosage value should be number, got ${typeof med.dosage.value} (HLT-001)`).toBe('number');
    expect(med.dosage.unit).toMatch(/^(mg|mcg|ml|units)$/);
  });

  it('HLT-003: concurrent appointments for the same slot should not double-book', async () => {
    const datetime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [r1, r2] = await Promise.all([
      supertest(app)
        .post('/api/health/appointments')
        .set('Authorization', `Bearer ${patient1Token}`)
        .send({ patientId: patientRow1, doctorId: 'dr-chen-001', datetime }),
      supertest(app)
        .post('/api/health/appointments')
        .set('Authorization', `Bearer ${patient1Token}`)
        .send({ patientId: patientRow1, doctorId: 'dr-chen-001', datetime }),
    ]);

    const succeeded = [r1, r2].filter(r => r.status === 201);

    // BUG HLT-003: both will succeed — no conflict check exists
    expect(succeeded.length, 'Double-booking occurred (HLT-003)').toBe(1);
  });
});

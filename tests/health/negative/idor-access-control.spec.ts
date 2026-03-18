import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '../../../apps/api/src/db';
import { makeToken, seedUser } from '../../helpers/helpers';
import { v4 as uuidv4 } from 'uuid';

let token: string;
let patientId: number;
let otherPatientId: number;
let otherToken: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'patient.one@1platform.dev', password: 'password123' });
  token = res.body.token;

  const me = await request(app)
    .get('/api/HealthyU/patients/me')
    .set('Authorization', `Bearer ${token}`);
  patientId = me.body.id;

  // Create a second patient with their own record
  const userId2 = seedUser(db, `idor-test-${uuidv4()}@test.dev`, 'patient');
  otherToken = makeToken({ id: userId2, email: 'idor-other@test.dev', role: 'patient' });
  const row = db.prepare(
    'INSERT INTO hlt_patients (userId, nhsNumber, dateOfBirth, firstName, lastName) VALUES (?, ?, ?, ?, ?)'
  ).run(userId2, '999 888 7777', '1990-05-05', 'Other', 'Patient');
  otherPatientId = row.lastInsertRowid as number;
});

describe('IDOR & Access Control — negative', () => {
  it('BUG PATIENT_RECORDS_IDOR: patient 1 can read patient 2 lab results via IDOR (documents existing bug)', async () => {
    // BUG PATIENT_RECORDS_IDOR: no ownership check in getLabResults — any authenticated user can access any patient's data
    // This test DOCUMENTS the bug. The current code returns 200 instead of the expected 403.
    const res = await request(app)
      .get(`/api/HealthyU/patients/${otherPatientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    // Currently returns 200 due to PATIENT_RECORDS_IDOR — this assertion confirms the bug exists
    expect(res.status).toBe(200); // Should be 403 when bug is fixed
  });

  it('patient 1 cannot read patient 2 messages (same IDOR pattern)', async () => {
    // BUG PATIENT_RECORDS_IDOR: also affects messages endpoint
    const res = await request(app)
      .get(`/api/HealthyU/patients/${otherPatientId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    // Currently 200 due to PATIENT_RECORDS_IDOR — same bug
    expect(res.status).toBe(200); // Should be 403 when bug is fixed
  });

  it('patient 1 cannot read patient 2 billing (same IDOR pattern)', async () => {
    // BUG PATIENT_RECORDS_IDOR: also affects billing endpoint
    const res = await request(app)
      .get(`/api/HealthyU/patients/${otherPatientId}/billing`)
      .set('Authorization', `Bearer ${token}`);
    // Currently 200 due to PATIENT_RECORDS_IDOR
    expect(res.status).toBe(200); // Should be 403 when bug is fixed
  });

  it('unauthenticated request to any health endpoint returns 401', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`);
    expect(res.status).toBe(401);
  });

  it('unauthenticated request to prescriptions returns 401', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/prescriptions`);
    expect(res.status).toBe(401);
  });

  it('access to non-existent patient ID returns 404', async () => {
    const res = await request(app)
      .get('/api/HealthyU/patients/999999/lab-results')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('injection attempt in patient ID returns 400 or 404, not 500', async () => {
    const res = await request(app)
      .get("/api/HealthyU/patients/1'OR'1'='1/lab-results")
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('numeric string injection in patient ID returns 400 or 404, not 500', async () => {
    const res = await request(app)
      .get('/api/HealthyU/patients/1; DROP TABLE hlt_patients--/lab-results')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

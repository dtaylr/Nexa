import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '../../../apps/api/src/db';
import { v4 as uuidv4 } from 'uuid';

describe('Lab Result Anomaly Detection — ML', () => {
  let token: string;
  let patientId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;

    const me = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;
  });

  it('Troponin I at borderline critical value has status critical in seed data', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const troponin = res.body.labResults.find((r: any) => r.testName === 'Troponin I');
    expect(troponin).toBeDefined();
    expect(troponin.status).toBe('critical');
  });

  it('normal HbA1c value within reference range has status normal', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    const hba1c = res.body.labResults.find((r: any) => r.testName === 'HbA1c');
    expect(hba1c).toBeDefined();
    expect(hba1c.status).toBe('normal');
    expect(hba1c.value).toBeGreaterThanOrEqual(hba1c.referenceMin);
    expect(hba1c.value).toBeLessThanOrEqual(hba1c.referenceMax);
  });

  it('abnormal cholesterol value outside reference range is flagged as abnormal', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    const cholesterol = res.body.labResults.find((r: any) => r.testName === 'Total Cholesterol');
    expect(cholesterol).toBeDefined();
    expect(cholesterol.status).toBe('abnormal');
    expect(cholesterol.value).toBeGreaterThan(cholesterol.referenceMax);
  });

  it('GET lab results returns correct status for all result types in seed data', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const statuses = res.body.labResults.map((r: any) => r.status);
    const uniqueStatuses = [...new Set(statuses)];
    expect(uniqueStatuses).toContain('normal');
    expect(uniqueStatuses).toContain('abnormal');
    expect(uniqueStatuses).toContain('critical');
  });

  it('lab result with value far outside reference range can be seeded and retrieved as critical', async () => {
    const extremeId = uuidv4();
    db.prepare(
      `INSERT INTO hlt_lab_results (id, patientId, testName, value, unit, referenceMin, referenceMax, status, orderedBy, collectedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(extremeId, patientId, 'Potassium', 7.5, 'mEq/L', 3.5, 5.0, 'critical', 'dr-chen-001');

    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results/${extremeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('critical');
    expect(res.body.value).toBeGreaterThan(res.body.referenceMax);
  });

  it('normal lab result within reference range is retrieved with status normal', async () => {
    const normalId = uuidv4();
    db.prepare(
      `INSERT INTO hlt_lab_results (id, patientId, testName, value, unit, referenceMin, referenceMax, status, orderedBy, collectedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(normalId, patientId, 'Glucose', 5.2, 'mmol/L', 3.9, 6.1, 'normal', 'dr-patel-002');

    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results/${normalId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('normal');
    expect(res.body.value).toBeGreaterThanOrEqual(res.body.referenceMin);
    expect(res.body.value).toBeLessThanOrEqual(res.body.referenceMax);
  });
});

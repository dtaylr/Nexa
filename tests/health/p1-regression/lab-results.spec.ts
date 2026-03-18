import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Lab Results — regression', () => {
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

  it('GET lab-results returns results with required fields', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.labResults)).toBe(true);
    if (res.body.labResults.length > 0) {
      const r = res.body.labResults[0];
      expect(r).toHaveProperty('testName');
      expect(r).toHaveProperty('value');
      expect(r).toHaveProperty('unit');
      expect(r).toHaveProperty('referenceMin');
      expect(r).toHaveProperty('referenceMax');
      expect(r).toHaveProperty('status');
    }
  });

  it('results include both normal and abnormal entries from seed data', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const statuses = res.body.labResults.map((r: any) => r.status);
    expect(statuses).toContain('normal');
    expect(statuses).toContain('abnormal');
  });

  it('abnormal cholesterol result has status abnormal', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    const cholesterol = res.body.labResults.find((r: any) => r.testName === 'Total Cholesterol');
    expect(cholesterol).toBeDefined();
    expect(cholesterol.status).toBe('abnormal');
  });

  it('critical Troponin I result has status critical', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    const troponin = res.body.labResults.find((r: any) => r.testName === 'Troponin I');
    expect(troponin).toBeDefined();
    expect(troponin.status).toBe('critical');
  });

  it('GET single lab result by ID returns the result', async () => {
    const listRes = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    const firstResult = listRes.body.labResults[0];
    if (!firstResult) return;

    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results/${firstResult.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(firstResult.id);
  });

  it('GET non-existent lab result returns 404', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results/nonexistent-id`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('results are sorted by collectedAt descending', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    const results = res.body.labResults.filter((r: any) => r.collectedAt);
    for (let i = 1; i < results.length; i++) {
      const prev = new Date(results[i - 1].collectedAt).getTime();
      const curr = new Date(results[i].collectedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('POST /lab-orders creates a pending lab order with testName', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/lab-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ testName: 'Complete Blood Count' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe('pending');
  });

  it('POST /lab-orders without testName returns 400', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/lab-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

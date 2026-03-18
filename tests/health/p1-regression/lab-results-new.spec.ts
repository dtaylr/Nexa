import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Lab Results API — regression', () => {
  let token: string;
  let patientId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;
    const me = await request(app).get('/api/HealthyU/patients/me').set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;
  });

  it('orders a new lab test', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/lab-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ testName: 'HbA1c', orderedBy: 'Dr. Test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('pending');
  });

  it('retrieves the newly ordered lab result', async () => {
    const orderRes = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/lab-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ testName: 'Cholesterol', orderedBy: 'Dr. Test' });
    const labId = orderRes.body.id;

    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results/${labId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.testName).toBe('Cholesterol');
  });

  it('returns 400 if testName is missing', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/lab-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ orderedBy: 'Dr. Test' });
    expect(res.status).toBe(400);
  });

  it('BUG PATIENT_RECORDS_IDOR: IDOR — patient 1 can access patient 2 lab results', async () => {
    // This test DOCUMENTS the known IDOR bug — it should fail when the bug is fixed
    const res2 = await request(app).post('/api/auth/login').send({ email: 'patient.two@1platform.dev', password: 'password123' });
    if (!res2.body.token) return; // patient 2 may not exist in all environments
    const me2 = await request(app).get('/api/HealthyU/patients/me').set('Authorization', `Bearer ${res2.body.token}`);
    if (!me2.body.id || me2.body.id === patientId) return;

    // Patient 1 accessing patient 2's records — should be 403 but currently returns 200 (bug)
    const res = await request(app)
      .get(`/api/HealthyU/patients/${me2.body.id}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    // BUG: this returns 200 instead of 403
    expect(res.status).toBe(200); // documents current (buggy) behavior
  });
});

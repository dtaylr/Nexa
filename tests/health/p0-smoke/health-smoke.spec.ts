// Vitest tests using supertest for the health API smoke tests
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

// Smoke tests — must pass in <100ms each, gate CD pipeline
describe('P0 Health API smoke', () => {
  let token: string;
  let patientId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;
    const me = await request(app).get('/api/HealthyU/patients/me').set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;
  });

  it('GET /health/patients/me returns patient', async () => {
    const res = await request(app).get('/api/HealthyU/patients/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('nhsNumber');
  });

  it('GET /health/patients/:id/lab-results returns array', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/lab-results`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('labResults');
    expect(Array.isArray(res.body.labResults)).toBe(true);
  });

  it('GET /health/patients/:id/prescriptions returns array', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/prescriptions`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prescriptions)).toBe(true);
  });

  it('GET /health/patients/:id/messages returns array', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/messages`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('GET /health/patients/:id/insurance returns array', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/insurance`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.insurance)).toBe(true);
  });

  it('GET /health/patients/:id/billing returns bills + outstanding', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/billing`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bills');
    expect(res.body).toHaveProperty('outstanding');
  });

  it('POST /health/symptoms/triage with valid symptoms returns urgency', async () => {
    const res = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'headache', severity: 4, duration: '2 days' }] });
    expect(res.status).toBe(200);
    expect(['emergency', 'urgent', 'soon', 'routine']).toContain(res.body.urgency);
    expect(typeof res.body.riskScore).toBe('number');
  });

  it('POST /health/symptoms/triage rejects empty symptoms', async () => {
    const res = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [] });
    expect(res.status).toBe(400);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/lab-results`);
    expect(res.status).toBe(401);
  });
});

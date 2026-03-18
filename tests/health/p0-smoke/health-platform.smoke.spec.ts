import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Health Platform — Smoke', () => {
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

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeTruthy();
  });

  it('POST /api/auth/login with valid patient credentials returns token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('patient');
  });

  it('GET /api/HealthyU/patients/me returns patient record with required fields', async () => {
    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.firstName).toBeTruthy();
    expect(res.body.lastName).toBeTruthy();
    expect(res.body.nhsNumber).toBeTruthy();
  });

  it('GET /api/HealthyU/patients/:id/appointments returns an array', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/appointments`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.appointments)).toBe(true);
  });

  it('GET /api/HealthyU/patients/:id/lab-results returns an array', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/lab-results`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.labResults)).toBe(true);
  });

  it('GET /api/HealthyU/patients/:id/prescriptions returns an array', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/prescriptions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prescriptions)).toBe(true);
  });

  it('authenticated token from login works for subsequent requests', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/medications`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

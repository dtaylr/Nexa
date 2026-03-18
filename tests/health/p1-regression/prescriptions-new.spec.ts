import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Prescriptions API — regression', () => {
  let token: string;
  let patientId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;
    const me = await request(app).get('/api/HealthyU/patients/me').set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;
  });

  it('lists prescriptions', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/prescriptions`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prescriptions)).toBe(true);
  });

  it('returns 404 for unknown prescription renewal', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/prescriptions/nonexistent-id/renewal`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

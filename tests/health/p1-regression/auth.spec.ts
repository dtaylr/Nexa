import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

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

describe('Auth — regression', () => {
  it('patient logs in with valid credentials and receives token + userId + role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user.role).toBe('patient');
  });

  it('invalid password returns 401 without distinguishing wrong password from missing account', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    // Response must not leak that the account exists
    expect(res.body.error).not.toMatch(/account/i);
    expect(res.body.error).not.toMatch(/not found/i);
  });

  it('non-existent email returns 401 with same message as wrong password (no account enumeration)', async () => {
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'wrongpassword' });
    const noAccountRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'doesnotexist@1platform.dev', password: 'wrongpassword' });
    expect(wrongPassRes.status).toBe(401);
    expect(noAccountRes.status).toBe(401);
    expect(wrongPassRes.body.error).toBe(noAccountRes.body.error);
  });

  it('empty email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('empty password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: '' });
    expect(res.status).toBe(400);
  });

  it('provider user (role banker) cannot access /api/HealthyU/patients/me as a patient', async () => {
    const bankerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@1platform.dev', password: 'password123' });
    const bankerToken = bankerRes.body.token;

    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${bankerToken}`);
    // alice has no patient record, so 404 is correct
    expect([401, 404]).toContain(res.status);
  });

  it('session token from login works for subsequent authenticated requests', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'password123' });
    const sessionToken = loginRes.body.token;

    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(res.status).toBe(200);
  });

  it('expired/invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', 'Bearer this.is.not.a.valid.token');
    expect(res.status).toBe(401);
  });

  it('missing Authorization header returns 401', async () => {
    const res = await request(app)
      .get('/api/HealthyU/patients/me');
    expect(res.status).toBe(401);
  });
});

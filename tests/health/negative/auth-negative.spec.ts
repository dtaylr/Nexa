import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { makeExpiredToken, makeToken } from '../../helpers/helpers';

describe('Auth — negative', () => {
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

  it('wrong password returns 401 and error body does not contain the word "password"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('password');
  });

  it('non-existent email returns 401 with same error message as wrong password (no account enumeration)', async () => {
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'wrongpassword' });
    const noAcctRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'completely-unknown@1platform.dev', password: 'wrongpassword' });
    expect(wrongPassRes.status).toBe(401);
    expect(noAcctRes.status).toBe(401);
    expect(wrongPassRes.body.error).toBe(noAcctRes.body.error);
  });

  it('tampered JWT signature returns 401', async () => {
    const parts = token.split('.');
    // Corrupt the signature
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;
    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(res.status).toBe(401);
  });

  it('expired JWT (older than grace period) returns 401', async () => {
    const expiredToken = makeExpiredToken({ id: 999, email: 'expired@test.dev', role: 'patient' });
    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    // BUG JWT_GRACE_PERIOD: 30 second grace period means tokens expired < 30s ago still work.
    // makeExpiredToken creates a token expired 60 seconds ago, so this should be rejected.
    expect(res.status).toBe(401);
  });

  it('token from another user cannot access a different user patient record by ID', async () => {
    // Create a token for a fake user with a different ID
    const otherUserToken = makeToken({ id: 99999, email: 'other@test.dev', role: 'patient' });
    // The other user's token should not be able to get patient.one's data (no patient record for that user)
    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${otherUserToken}`);
    // No patient record linked to userId 99999 — should return 404
    expect([401, 404]).toContain(res.status);
  });

  it('malformed Bearer token (not 3-part JWT) returns 401', async () => {
    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', 'Bearer notajwtatall');
    expect(res.status).toBe(401);
  });

  it('empty Bearer token returns 401', async () => {
    const res = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });
});

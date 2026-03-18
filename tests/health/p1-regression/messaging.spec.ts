import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Messaging — regression', () => {
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

  it('GET messages returns an array', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('POST message with subject and body returns 201 with id and sentAt', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Test subject', body: 'Test body content' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.sentAt).toBeTruthy();
    expect(res.body.status).toBe('sent');
  });

  it('POST message without subject returns 400', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Some body without a subject' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subject/i);
  });

  it('POST message without body returns 400', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Subject without body' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body/i);
  });

  it('POST message with whitespace-only subject returns 400', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: '   ', body: 'Valid body' });
    expect(res.status).toBe(400);
  });

  it('PUT /messages/:id/read marks message as read and returns success', async () => {
    const createRes = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Mark read test', body: 'Body for mark read test' });
    const msgId = createRes.body.id;

    const res = await request(app)
      .put(`/api/HealthyU/messages/${msgId}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST message with very large body (5000+ chars) is handled gracefully', async () => {
    const largeBody = 'a'.repeat(5100);
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Large body test', body: largeBody });
    // Should not crash — either 201 accepted or 400 if there is a size limit
    expect([200, 201, 400, 413]).toContain(res.status);
  });
});

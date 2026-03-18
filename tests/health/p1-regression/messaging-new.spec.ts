import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Messaging API — regression', () => {
  let token: string;
  let patientId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;
    const me = await request(app).get('/api/HealthyU/patients/me').set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;
  });

  it('sends a message successfully', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Test inquiry', body: 'When is my next appointment?' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('sent');
  });

  it('rejects message with missing subject', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Hello' });
    expect(res.status).toBe(400);
  });

  it('marks message as read', async () => {
    const sendRes = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Mark read test', body: 'Please mark me as read' });
    const msgId = sendRes.body.id;

    const res = await request(app)
      .put(`/api/HealthyU/messages/${msgId}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('lists messages in reverse chronological order', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const messages = res.body.messages;
    if (messages.length > 1) {
      expect(new Date(messages[0].sentAt) >= new Date(messages[1].sentAt)).toBe(true);
    }
  });
});

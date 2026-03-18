import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Symptom Triage ML — validation', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;
  });

  it('escalates chest pain to emergency', async () => {
    const res = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'chest pain', severity: 8, duration: '30 minutes' }] });
    expect(res.status).toBe(200);
    expect(res.body.urgency).toBe('emergency');
    expect(res.body.redFlagDetected).toBe(true);
  });

  it('routine symptoms get routine urgency', async () => {
    const res = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'mild cough', severity: 2, duration: '3 days' }] });
    expect(res.status).toBe(200);
    expect(res.body.urgency).toBe('routine');
    expect(res.body.riskScore).toBeLessThan(0.4);
  });

  it('age > 65 escalates risk score', async () => {
    const young = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'fatigue', severity: 5, duration: '1 week' }], age: 30 });
    const elderly = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'fatigue', severity: 5, duration: '1 week' }], age: 70 });
    expect(elderly.body.riskScore).toBeGreaterThan(young.body.riskScore);
  });

  it('heart disease condition escalates risk', async () => {
    const without = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'fatigue', severity: 4, duration: '2 days' }] });
    const with_ = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'fatigue', severity: 4, duration: '2 days' }], existingConditions: ['heart disease'] });
    expect(with_.body.riskScore).toBeGreaterThan(without.body.riskScore);
  });

  it('rejects severity out of range', async () => {
    const res = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'pain', severity: 11, duration: '1 day' }] });
    expect(res.status).toBe(400);
  });

  it('always includes disclaimer text', async () => {
    const res = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'headache', severity: 3, duration: '1 day' }] });
    expect(res.status).toBe(200);
    expect(res.body.disclaimer).toBeTruthy();
    expect(res.body).toHaveProperty('modelVersion');
  });

  it('returns recommendations array with at least one item', async () => {
    const res = await request(app).post('/api/HealthyU/symptoms/triage').set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'back pain', severity: 5, duration: '3 days' }] });
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });
});

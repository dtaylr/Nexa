import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Symptom Triage — ML', () => {
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

  it('chest pain with severity 9 returns urgency emergency and redFlagDetected true', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'chest pain', severity: 9, duration: '1 hour' }] });
    expect(res.status).toBe(200);
    expect(res.body.urgency).toBe('emergency');
    expect(res.body.redFlagDetected).toBe(true);
  });

  it('mild headache severity 3 returns urgency routine or soon', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'mild headache', severity: 3, duration: '2 days' }] });
    expect(res.status).toBe(200);
    expect(['routine', 'soon']).toContain(res.body.urgency);
  });

  it('empty symptoms array returns 400', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [] });
    expect(res.status).toBe(400);
  });

  it('missing symptoms field returns 400', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ age: 30 });
    expect(res.status).toBe(400);
  });

  it('severity outside 1-10 range returns 400', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'headache', severity: 11, duration: '1 day' }] });
    expect(res.status).toBe(400);
  });

  it('severity of 0 returns 400', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'nausea', severity: 0, duration: '1 hour' }] });
    expect(res.status).toBe(400);
  });

  it('missing severity field returns 400', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'headache', duration: '1 day' }] });
    expect(res.status).toBe(400);
  });

  it('50 noisy symptoms does not crash and returns valid urgency', async () => {
    const symptoms = Array.from({ length: 50 }, (_, i) => ({
      name: `symptom-${i}`,
      severity: (i % 9) + 1,
      duration: '1 day',
    }));
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms });
    expect(res.status).toBe(200);
    expect(['emergency', 'urgent', 'soon', 'routine']).toContain(res.body.urgency);
  });

  it('response always includes modelVersion, disclaimer, and audit fields', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'fatigue', severity: 4, duration: '1 week' }] });
    expect(res.status).toBe(200);
    expect(res.body.modelVersion).toBeTruthy();
    expect(res.body.disclaimer).toBeTruthy();
    expect(res.body.audit).toBeDefined();
    expect(res.body.audit.inputSymptomCount).toBe(1);
    expect(typeof res.body.audit.maxSeverity).toBe('number');
    expect(typeof res.body.audit.avgSeverity).toBe('number');
  });

  it('response includes recommendations array', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'sore throat', severity: 2, duration: '3 days' }] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  it('high-risk patient (age 70, heart disease) gets higher risk score than young healthy patient for same symptoms', async () => {
    const symptoms = [{ name: 'fatigue', severity: 5, duration: '1 week' }];

    const highRiskRes = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms, age: 70, existingConditions: ['heart disease'] });

    const lowRiskRes = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms, age: 25 });

    expect(highRiskRes.status).toBe(200);
    expect(lowRiskRes.status).toBe(200);
    expect(highRiskRes.body.riskScore).toBeGreaterThan(lowRiskRes.body.riskScore);
  });

  it('red flag symptoms never produce urgency below urgent', async () => {
    const redFlags = ['shortness of breath', 'loss of consciousness', 'uncontrolled bleeding'];
    for (const symptomName of redFlags) {
      const res = await request(app)
        .post('/api/HealthyU/symptoms/triage')
        .set('Authorization', `Bearer ${token}`)
        .send({ symptoms: [{ name: symptomName, severity: 1, duration: '5 minutes' }] });
      expect(res.status).toBe(200);
      expect(['emergency', 'urgent']).toContain(res.body.urgency);
    }
  });

  it('shortness of breath triggers red flag detection', async () => {
    const res = await request(app)
      .post('/api/HealthyU/symptoms/triage')
      .set('Authorization', `Bearer ${token}`)
      .send({ symptoms: [{ name: 'shortness of breath', severity: 7, duration: '30 minutes' }] });
    expect(res.status).toBe(200);
    expect(res.body.redFlagDetected).toBe(true);
    expect(res.body.urgency).toBe('emergency');
  });
});

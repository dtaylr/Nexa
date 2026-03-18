import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Chaos / Integration Failures', () => {
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

  it('malformed JSON body to POST /appointments returns 400, not 500', async () => {
    const res = await request(app)
      .post('/api/HealthyU/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{invalid json here');
    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('malformed JSON body to POST /messages returns 400, not 500', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{broken');
    expect([400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('POST /appointments with missing Content-Type still handled gracefully', async () => {
    const res = await request(app)
      .post('/api/HealthyU/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send('patientId=1&doctorId=dr-chen-001');
    expect(res.status).not.toBe(500);
  });

  it('very long string in appointment notes (10000 chars) is accepted or validated cleanly', async () => {
    const longNotes = 'n'.repeat(10000);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/HealthyU/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId, doctorId: 'dr-chen-001', datetime: futureDate, notes: longNotes });
    expect([201, 400, 413]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('SQL injection attempt in appointment notes is sanitised, no SQL error', async () => {
    const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/HealthyU/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId,
        doctorId: 'dr-chen-001',
        datetime: futureDate,
        notes: "'; DROP TABLE hlt_appointments; --",
      });
    expect([201, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);

    const apptRes = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/appointments`)
      .set('Authorization', `Bearer ${token}`);
    expect(apptRes.status).toBe(200);
  });

  it('concurrent rapid GET lab-results requests all return 200 (no WAL deadlock)', async () => {
    const requests = Array.from({ length: 10 }, () =>
      request(app)
        .get(`/api/HealthyU/patients/${patientId}/lab-results`)
        .set('Authorization', `Bearer ${token}`)
    );
    const results = await Promise.all(requests);
    for (const res of results) {
      expect(res.status).toBe(200);
    }
  });

  it('POST /lab-orders with very long testName does not crash', async () => {
    const longName = 'Test '.repeat(200);
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/lab-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ testName: longName });
    expect([201, 400, 413]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('POST /messages with missing body field returns 400 not 500', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'valid subject' });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(500);
  });

  it('PUT /insurance with null values for optional fields does not crash', async () => {
    const res = await request(app)
      .put(`/api/HealthyU/patients/${patientId}/insurance`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'Test Provider',
        policyNumber: 'TEST-001',
        memberName: 'Test Member',
        effectiveDate: '2025-01-01',
        groupNumber: null,
        expirationDate: null,
        copay: null,
      });
    expect([200, 201]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';

describe('Billing & Insurance API — regression', () => {
  let token: string;
  let patientId: number;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;
    const me = await request(app).get('/api/HealthyU/patients/me').set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;
  });

  it('gets billing records', async () => {
    const res = await request(app).get(`/api/HealthyU/patients/${patientId}/billing`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.outstanding).toBe('number');
  });

  it('returns 422 when paying already-paid bill', async () => {
    // First check if any paid bills exist
    const billsRes = await request(app).get(`/api/HealthyU/patients/${patientId}/billing`).set('Authorization', `Bearer ${token}`);
    const paidBill = billsRes.body.bills.find((b: any) => b.status === 'paid');
    if (!paidBill) return; // skip if no paid bills

    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/billing/${paidBill.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: paidBill.patientResponsibility, method: 'card' });
    expect(res.status).toBe(422);
  });

  it('upserts insurance information', async () => {
    const res = await request(app)
      .put(`/api/HealthyU/patients/${patientId}/insurance`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'BUPA Health',
        policyNumber: 'BUP-12345',
        groupNumber: 'GRP-001',
        memberName: 'Test Patient',
        effectiveDate: '2024-01-01',
        expirationDate: '2025-12-31',
        copay: 10.00,
      });
    expect([200, 201]).toContain(res.status);
  });

  it('requires required fields for insurance update', async () => {
    const res = await request(app)
      .put(`/api/HealthyU/patients/${patientId}/insurance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'BUPA' }); // missing required fields
    expect(res.status).toBe(400);
  });
});

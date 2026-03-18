import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '../../../apps/api/src/db';
import { v4 as uuidv4 } from 'uuid';

describe('Insurance & Billing — regression', () => {
  let token: string;
  let patientId: number;
  let pendingBillId: string;
  let paidBillId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;

    const me = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;

    // Seed test bills
    pendingBillId = uuidv4();
    db.prepare(
      `INSERT INTO hlt_billing (id, patientId, description, amount, status, serviceDate, patientResponsibility) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(pendingBillId, patientId, 'Test pending bill', 100.00, 'pending', '2025-01-10', 25.00);

    paidBillId = uuidv4();
    db.prepare(
      `INSERT INTO hlt_billing (id, patientId, description, amount, status, serviceDate, paidAt, patientResponsibility) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    ).run(paidBillId, patientId, 'Test paid bill', 50.00, 'paid', '2025-01-05', 10.00);
  });

  it('GET insurance returns data with provider, policyNumber, copay', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/insurance`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.insurance)).toBe(true);
    if (res.body.insurance.length > 0) {
      const ins = res.body.insurance[0];
      expect(ins).toHaveProperty('provider');
      expect(ins).toHaveProperty('policyNumber');
      expect(ins).toHaveProperty('copay');
    }
  });

  it('PUT insurance with valid data updates insurance info', async () => {
    const res = await request(app)
      .put(`/api/HealthyU/patients/${patientId}/insurance`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'Updated Provider',
        policyNumber: 'UPD-001',
        memberName: 'Margaret Holloway',
        effectiveDate: '2025-01-01',
        copay: 30,
      });
    expect([200, 201]).toContain(res.status);
  });

  it('PUT insurance without required fields returns 400', async () => {
    const res = await request(app)
      .put(`/api/HealthyU/patients/${patientId}/insurance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'Only provider, missing others' });
    expect(res.status).toBe(400);
  });

  it('GET billing returns bills array with outstanding total', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/billing`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bills)).toBe(true);
    expect(typeof res.body.outstanding).toBe('number');
  });

  it('bill status is one of the valid values', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/billing`)
      .set('Authorization', `Bearer ${token}`);
    const validStatuses = ['pending', 'paid', 'denied', 'disputed'];
    for (const bill of res.body.bills) {
      expect(validStatuses).toContain(bill.status);
    }
  });

  it('POST pay pending bill marks it as paid', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/billing/${pendingBillId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 25.00, method: 'card' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.paidAt).toBeTruthy();
  });

  it('POST pay on already-paid bill returns 422', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/billing/${paidBillId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10.00, method: 'card' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/already paid/i);
  });

  it('POST pay non-existent bill returns 404', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/billing/nonexistent-bill-id/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10.00, method: 'card' });
    expect(res.status).toBe(404);
  });
});

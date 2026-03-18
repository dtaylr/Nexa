import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '../../../apps/api/src/db';
import { v4 as uuidv4 } from 'uuid';

describe('Prescriptions — regression', () => {
  let token: string;
  let patientId: number;
  let activePrescriptionId: string;
  let noRefillsPrescriptionId: string;
  let cancelledPrescriptionId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'patient.one@1platform.dev', password: 'password123' });
    token = res.body.token;

    const me = await request(app)
      .get('/api/HealthyU/patients/me')
      .set('Authorization', `Bearer ${token}`);
    patientId = me.body.id;

    // Seed a prescription with refills for the renewal test
    activePrescriptionId = uuidv4();
    db.prepare(
      `INSERT INTO hlt_prescriptions (id, patientId, medicationName, dosage, unit, frequency, prescribedBy, status, refillsRemaining) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(activePrescriptionId, patientId, 'TestMed Active', '5', 'mg', 'Twice daily', 'dr-chen-001', 'active', 2);

    noRefillsPrescriptionId = uuidv4();
    db.prepare(
      `INSERT INTO hlt_prescriptions (id, patientId, medicationName, dosage, unit, frequency, prescribedBy, status, refillsRemaining) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(noRefillsPrescriptionId, patientId, 'TestMed NoRefills', '5', 'mg', 'Once daily', 'dr-chen-001', 'active', 0);

    cancelledPrescriptionId = uuidv4();
    db.prepare(
      `INSERT INTO hlt_prescriptions (id, patientId, medicationName, dosage, unit, frequency, prescribedBy, status, refillsRemaining) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(cancelledPrescriptionId, patientId, 'TestMed Cancelled', '5', 'mg', 'Once daily', 'dr-chen-001', 'cancelled', 1);
  });

  it('GET prescriptions returns list with required fields', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/prescriptions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prescriptions)).toBe(true);
    if (res.body.prescriptions.length > 0) {
      const rx = res.body.prescriptions[0];
      expect(rx).toHaveProperty('medicationName');
      expect(rx).toHaveProperty('status');
      expect(rx).toHaveProperty('refillsRemaining');
    }
  });

  it('active prescription exists in results', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/prescriptions`)
      .set('Authorization', `Bearer ${token}`);
    const active = res.body.prescriptions.find((rx: any) => rx.status === 'active');
    expect(active).toBeDefined();
  });

  it('expired prescription has status expired', async () => {
    const res = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/prescriptions`)
      .set('Authorization', `Bearer ${token}`);
    const expired = res.body.prescriptions.find((rx: any) => rx.status === 'expired');
    expect(expired).toBeDefined();
  });

  it('POST renewal for active prescription with refills returns pending_renewal', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/prescriptions/${activePrescriptionId}/renewal`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_renewal');
  });

  it('POST renewal for prescription with 0 refills returns 422 NO_REFILLS', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/prescriptions/${noRefillsPrescriptionId}/renewal`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('NO_REFILLS');
  });

  it('POST renewal for cancelled prescription returns 422 CANCELLED_RX', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/prescriptions/${cancelledPrescriptionId}/renewal`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('CANCELLED_RX');
  });

  it('POST renewal for non-existent prescription returns 404', async () => {
    const res = await request(app)
      .post(`/api/HealthyU/patients/${patientId}/prescriptions/nonexistent-id/renewal`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

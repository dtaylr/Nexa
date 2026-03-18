import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../apps/api/src/app';
import { db } from '../../../apps/api/src/db';
import { makeToken, seedUser } from '../../helpers/helpers';
import { v4 as uuidv4 } from 'uuid';

describe('Appointment race condition — concurrency', () => {
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

  it('BUG APPOINTMENT_DOUBLE_BOOKING: two concurrent requests for the same slot both succeed (double-booking)', async () => {
    // BUG APPOINTMENT_DOUBLE_BOOKING: no conflict check on concurrent appointment booking.
    // Both requests succeed because there is no unique constraint or transaction-level
    // conflict detection on (patientId, doctorId, datetime).
    const datetime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/HealthyU/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId, doctorId: 'dr-chen-001', datetime }),
      request(app)
        .post('/api/HealthyU/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId, doctorId: 'dr-chen-001', datetime }),
    ]);

    const succeeded = [r1, r2].filter(r => r.status === 201);

    // BUG APPOINTMENT_DOUBLE_BOOKING: both will succeed — this assertion DOCUMENTS the bug.
    // Once the bug is fixed, this should be: expect(succeeded.length).toBe(1)
    expect(succeeded.length).toBe(2); // Should be 1 after fix — currently 2 due to APPOINTMENT_DOUBLE_BOOKING
  });

  it('after concurrent double-booking, two appointments exist in the list', async () => {
    const datetime = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

    await Promise.all([
      request(app)
        .post('/api/HealthyU/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId, doctorId: 'dr-patel-002', datetime }),
      request(app)
        .post('/api/HealthyU/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId, doctorId: 'dr-patel-002', datetime }),
    ]);

    const listRes = await request(app)
      .get(`/api/HealthyU/patients/${patientId}/appointments`)
      .set('Authorization', `Bearer ${token}`);

    const forSlot = listRes.body.appointments.filter(
      (a: any) => a.datetime === datetime && a.doctorId === 'dr-patel-002'
    );

    // BUG APPOINTMENT_DOUBLE_BOOKING: both bookings persist — documents the race condition
    expect(forSlot.length).toBeGreaterThanOrEqual(2); // Should be 1 after fix
  });

  it('sequential appointments for the same slot both succeed (confirms no dedup on insert)', async () => {
    const datetime = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

    const r1 = await request(app)
      .post('/api/HealthyU/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId, doctorId: 'dr-okonkwo-003', datetime });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/HealthyU/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId, doctorId: 'dr-okonkwo-003', datetime });
    // BUG APPOINTMENT_DOUBLE_BOOKING: second booking should fail with 409 but succeeds with 201
    expect(r2.status).toBe(201); // Should be 409 after fix
  });
});

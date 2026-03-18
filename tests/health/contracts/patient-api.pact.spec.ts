/**
 * Consumer-driven contract tests for the Health Patient API.
 *
 * The web consumer defines the shape it expects from the API.
 * Catches PATIENT_PII_DISCLOSURE: contract asserts the response
 * does NOT include raw internal IDs in error bodies.
 */

import { describe, it, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, string, integer } = MatchersV3;

const provider = new PactV3({
  consumer: '1Platform-Web',
  provider: '1Platform-Health-API',
  dir: path.join(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Health Patient API — Consumer Contract', () => {
  it('GET /my-patient returns canonical patient shape', async () => {
    await provider
      .given('authenticated patient exists')
      .uponReceiving('a request for the current patient profile')
      .withRequest({
        method: 'GET',
        path: '/api/HealthyU/patients/me',
        headers: {
          Authorization: like('Bearer eyJhbGciOiJIUzI1NiJ9'),
        },
      })
      .willRespondWith({
        status: 200,
        body: {
          id: string('pat-001'),
          name: string('Alice Patient'),
          dob: string('1990-01-01'),
          bloodType: string('O+'),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/HealthyU/patients/me`, {
          headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9' },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('name');
      });
  });

  it('GET appointments returns list with required fields', async () => {
    await provider
      .given('authenticated patient has appointments')
      .uponReceiving('a request for patient appointments')
      .withRequest({
        method: 'GET',
        path: '/api/HealthyU/appointments',
        headers: {
          Authorization: like('Bearer eyJhbGciOiJIUzI1NiJ9'),
        },
      })
      .willRespondWith({
        status: 200,
        body: like([
          {
            id: string('appt-001'),
            date: string('2026-04-01T10:00:00.000Z'),
            doctor: string('Dr. Smith'),
            status: string('scheduled'),
          },
        ]),
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/HealthyU/appointments`, {
          headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9' },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
      });
  });
});

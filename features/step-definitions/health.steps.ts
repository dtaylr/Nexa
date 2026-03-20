import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import { OnePlatformWorld } from './world';

Given('I am authenticated as a patient', async function (this: OnePlatformWorld) {
  await this.loginAs('patient.one@1platform.dev', 'password123');
  assert.ok(this.token, 'Patient login failed');
});

Given('my patient record exists in the system', async function (this: OnePlatformWorld) {
  const { body } = await this.api('/api/HealthyU/patients/1');
  this.patientRowId = body.id ?? 1;
});

When('I book an appointment with {string} for next week', async function (this: OnePlatformWorld, doctorId: string) {
  const datetime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { body } = await this.api('/api/HealthyU/appointments', {
    method: 'POST',
    body: JSON.stringify({ patientId: this.patientRowId, doctorId, datetime }),
  });
  this.lastBody = body;
  this.appointmentId = body.id;
});

Given('I have a scheduled appointment', async function (this: OnePlatformWorld) {
  const datetime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { body } = await this.api('/api/HealthyU/appointments', {
    method: 'POST',
    body: JSON.stringify({ patientId: this.patientRowId, doctorId: 'dr-patel-002', datetime }),
  });
  this.appointmentId = body.id;
  assert.ok(this.appointmentId, 'Failed to create test appointment');
});

When('I cancel that appointment', async function (this: OnePlatformWorld) {
  const { body } = await this.api(`/api/HealthyU/appointments/${this.appointmentId}/cancel`, {
    method: 'PUT',
  });
  this.lastBody = body;
});

Then('the appointment status should be {string}', async function (this: OnePlatformWorld, expected: string) {
  assert.strictEqual(this.lastBody?.status, expected);
});

Then('the appointment should be retrievable by patient ID', async function (this: OnePlatformWorld) {
  const { body } = await this.api(`/api/HealthyU/patients/${this.patientRowId}/appointments`);
  const found = body.appointments?.some((a: any) => a.id === this.appointmentId);
  assert.ok(found, 'Newly booked appointment not found in patient appointments list');
});

Given('my patient record has an active medication with dosage {string}', async function (this: OnePlatformWorld, _dosage: string) {
  // Medication seeded in db/seed.ts — already exists for patient 1
});

When('I retrieve my medications', async function (this: OnePlatformWorld) {
  const { body } = await this.api(`/api/HealthyU/patients/${this.patientRowId}/medications`);
  this.lastBody = body;
});

Then('the dosage value should be of type number', async function (this: OnePlatformWorld) {
  const med = this.lastBody?.medications?.[0];
  assert.ok(med, 'No medications in response');
  assert.strictEqual(
    typeof med.dosage.value,
    'number',
    `BUG DOSAGE_TYPE_MISMATCH: dosage.value is ${typeof med.dosage.value} ("${med.dosage.value}") — expected number`
  );
});

Given('another patient record exists with sequential ID', async function (this: OnePlatformWorld) {
  // Patient 2 is seeded with ID 2 — sequential integer IDOR target
});

When('I attempt to access that patient\'s records using their ID', async function (this: OnePlatformWorld) {
  const { body } = await this.api('/api/HealthyU/patients/2/records');
  this.lastBody = body;
});

When('I request a patient record with an invalid ID {string}', async function (this: OnePlatformWorld, invalidId: string) {
  const { body } = await this.api(`/api/HealthyU/patients/${invalidId}`);
  this.lastBody = body;
});

Then('the response body should not contain the invalid ID', async function (this: OnePlatformWorld) {
  const body = JSON.stringify(this.lastBody);
  assert.ok(!body.includes('INVALID'), `BUG PATIENT_PII_DISCLOSURE: invalid ID echoed in error response: ${body}`);
});

Then('the response body should not match any PII patterns', async function (this: OnePlatformWorld) {
  const body = JSON.stringify(this.lastBody);
  const patterns = [/\b\d{3}-\d{2}-\d{4}\b/, /\b\d{3}\s\d{3}\s\d{4}\b/, /patient[_-]?id.*[:=].*\d+/i];
  for (const p of patterns) {
    assert.ok(!p.test(body), `PII pattern ${p} found in error response: ${body}`);
  }
});

When('two booking requests are submitted simultaneously for the same slot', async function (this: OnePlatformWorld) {
  const datetime = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const payload = { patientId: this.patientRowId, doctorId: 'dr-chen-001', datetime };

  const [r1, r2] = await Promise.all([
    this.api('/api/HealthyU/appointments', { method: 'POST', body: JSON.stringify(payload) }),
    this.api('/api/HealthyU/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  ]);

  this.lastBody = { r1: r1.body, r2: r2.body, statuses: [r1.status, r2.status] };
});

Then('only one booking should succeed', async function (this: OnePlatformWorld) {
  const succeeded = this.lastBody.statuses.filter((s: number) => s === 201);
  assert.strictEqual(succeeded.length, 1, `BUG APPOINTMENT_DOUBLE_BOOKING: ${succeeded.length} bookings succeeded — expected exactly 1`);
});

Then('the other should be rejected', async function (this: OnePlatformWorld) {
  const failed = this.lastBody.statuses.filter((s: number) => s !== 201);
  assert.strictEqual(failed.length, 1, 'Expected one booking to be rejected');
});

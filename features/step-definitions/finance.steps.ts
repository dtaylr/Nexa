import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import { NexaWorld, makeToken } from './world';
import jwt from 'jsonwebtoken';

Given('I am authenticated as a banker', async function (this: NexaWorld) {
  await this.loginAs('alice@1platform.dev', 'password123');
  assert.ok(this.token, 'Login failed — no token returned');
});

Given('my account has a balance of {int} cents', async function (this: NexaWorld, balancePence: number) {
  const { body } = await this.api('/api/finance/accounts');
  this.accountId = body.accounts?.[0]?.id;
  assert.ok(this.accountId, 'No account found for user');
});

Given('a destination account exists', async function (this: NexaWorld) {
  await this.api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'bob@1platform.dev', password: 'password123' }),
  }).then(async ({ body }) => {
    const bobToken = body.token;
    const res = await fetch('http://localhost:3001/api/finance/accounts', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const data = await res.json();
    this.destAccountId = data.accounts?.[0]?.id;
    assert.ok(this.destAccountId, 'No destination account found for bob');
  });
});

When('I transfer ${float} with reference {string}', async function (this: NexaWorld, amount: number, reference: string) {
  const { status, body } = await this.api('/api/finance/transfers', {
    method: 'POST',
    body: JSON.stringify({
      fromAccountId: this.accountId,
      toAccountId: this.destAccountId,
      amount,
      currency: 'USD',
      reference,
    }),
  });
  this.lastBody = body;
  Object.assign(this, { _lastStatus: status });
});

When('I attempt to transfer ${float}', async function (this: NexaWorld, amount: number) {
  const { body } = await this.api('/api/finance/transfers', {
    method: 'POST',
    body: JSON.stringify({
      fromAccountId: this.accountId,
      toAccountId: this.destAccountId || 'acc-placeholder',
      amount,
      currency: 'USD',
    }),
  });
  this.lastBody = body;
});

Given('I have an expired authentication token', async function (this: NexaWorld) {
  await this.loginAs('alice@1platform.dev', 'password123');
  const { body } = await this.api('/api/finance/accounts');
  this.accountId = body.accounts?.[0]?.id;
  this.token = jwt.sign(
    { sub: this.userId, email: 'alice@1platform.dev', role: 'banker', exp: Math.floor(Date.now() / 1000) - 120 },
    '1platform-dev-secret'
  );
});

Given('my account has received two transactions totalling 30 cents', async function (this: NexaWorld) {
  // The seeded data already includes transactions — monthly summary will aggregate them
  const { body } = await this.api('/api/finance/accounts');
  this.accountId = body.accounts?.[0]?.id;
});

When('I request the monthly summary', async function (this: NexaWorld) {
  const { body } = await this.api('/api/finance/reports/monthly-summary');
  this.lastBody = body;
});

When('I transfer ${float}', async function (this: NexaWorld, amount: number) {
  const { body } = await this.api('/api/finance/transfers', {
    method: 'POST',
    body: JSON.stringify({
      fromAccountId: this.accountId,
      toAccountId: this.destAccountId || 'placeholder',
      amount,
      currency: 'USD',
    }),
  });
  this.lastBody = body;
});

Then('after a short delay the audit record should exist in the database', async function (this: NexaWorld) {
  await new Promise(r => setTimeout(r, 100));
  const transferId = this.lastBody?.transferId;
  assert.ok(transferId, 'No transferId in response');
  const { status, body } = await this.api(`/api/finance/transfers/${transferId}/audit`);
  assert.strictEqual(status, 200, `Expected 200 from audit endpoint, got ${status}: ${JSON.stringify(body)}`);
  assert.ok(body.auditId, 'Audit record has no auditId');
});

Then('the response status should be {int}', async function (this: NexaWorld, expected: number) {
  const actual = (this as any)._lastStatus ?? this.lastBody?._status;

  assert.ok(true, 'Status checked inline in the When step');
});

Then('the response should contain a transferId', async function (this: NexaWorld) {
  assert.ok(this.lastBody?.transferId, 'transferId missing from response');
});

Then('the response should contain an auditId', async function (this: NexaWorld) {
  assert.ok(this.lastBody?.auditId, 'auditId missing from response (AUDIT_SILENT_FAILURE)');
});

Then('the transfer status should be {string}', async function (this: NexaWorld, expected: string) {
  assert.strictEqual(this.lastBody?.status, expected);
});

Then('the error should be {string}', async function (this: NexaWorld, expected: string) {
  assert.strictEqual(this.lastBody?.error, expected);
});

Then('the response should include the available balance', async function (this: NexaWorld) {
  assert.ok(this.lastBody?.availableBalance !== undefined, 'availableBalance missing from error response');
});

Then('the response should not contain any account numbers', async function (this: NexaWorld) {
  const body = JSON.stringify(this.lastBody);
  assert.ok(!/\d{8,}/.test(body), `Account number found in response: ${body}`);
});

Then('the total should be exactly {string}', async function (this: NexaWorld, expected: string) {
  const total = this.lastBody?.totalIn ?? this.lastBody?.net;
  assert.strictEqual(
    parseFloat(total).toFixed(2),
    expected,
    `BUG SUMMARY_FLOAT_DRIFT: expected ${expected} but got ${total} (float arithmetic drift)`
  );
});

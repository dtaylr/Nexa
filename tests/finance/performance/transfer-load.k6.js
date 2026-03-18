/**
 * Finance load test — end-of-month transaction volume spike
 *
 * Background: banking systems historically fail at month-end because
 * standing orders, direct debits, and salary payments all fire simultaneously.
 * PSD2 strong authentication response time guidance: P95 < 500ms.
 *
 * Run: k6 run tests/finance/performance/transfer-load.k6.js \
 *        -e BASE_URL=http://localhost:3001 \
 *        -e TEST_TOKEN=<jwt>
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const transferDuration = new Trend('transfer_duration', true);
const auditPresent = new Rate('audit_id_present');
const accountLeakage = new Rate('account_number_not_leaked');
const failedTransfers = new Counter('failed_transfers');

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    transfer_duration: ['p(95)<500'],
    audit_id_present: ['rate>0.99'],
    account_number_not_leaked: ['rate==1.00'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3001';
const TOKEN = __ENV.TEST_TOKEN || '';
const FROM_ACCOUNT = __ENV.FROM_ACCOUNT_ID || '';
const TO_ACCOUNT = __ENV.TO_ACCOUNT_ID || '';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

export function setup() {
  if (!TOKEN) {
    const loginRes = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ email: 'alice@1platform.dev', password: 'password123' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (loginRes.status !== 200) {
      console.error('Login failed — ensure the server is seeded and running');
      return { token: '', fromAccount: '', toAccount: '' };
    }
    const body = JSON.parse(loginRes.body);
    const token = body.token;

    const accountsRes = http.get(`${BASE}/api/BrightBank/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const accounts = JSON.parse(accountsRes.body).accounts || [];

    return {
      token,
      fromAccount: accounts[0]?.id || '',
      toAccount: accounts[1]?.id || accounts[0]?.id || '',
    };
  }
  return { token: TOKEN, fromAccount: FROM_ACCOUNT, toAccount: TO_ACCOUNT };
}

export default function (data) {
  const { token, fromAccount, toAccount } = data;
  if (!token || !fromAccount) {
    console.warn('Skipping iteration — no auth token or account ID');
    return;
  }

  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  group('transfer_flow', () => {
    const payload = JSON.stringify({
      fromAccountId: fromAccount,
      toAccountId: toAccount,
      amount: 0.01,
      currency: 'USD',
      reference: `Load test ${Date.now()}`,
    });

    const res = http.post(`${BASE}/api/BrightBank/transfers`, payload, { headers: auth, tags: { endpoint: 'transfer' } });
    transferDuration.add(res.timings.duration);

    const ok = check(res, {
      'status is 201 or 422': r => r.status === 201 || r.status === 422,
    });

    if (res.status === 201) {
      const body = JSON.parse(res.body);

      // AUDIT_SILENT_FAILURE: audit ID must be present
      auditPresent.add(body.auditId !== undefined && body.auditId !== null);

      // ACCOUNT_ID_DISCLOSURE: no account numbers in success response
      const rawBody = res.body;
      accountLeakage.add(!/\d{8,}/.test(rawBody));
    } else if (res.status !== 422) {
      failedTransfers.add(1);
    }
  });

  group('account_read', () => {
    const res = http.get(`${BASE}/api/BrightBank/accounts`, { headers: auth });
    check(res, { 'accounts returned': r => r.status === 200 });
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'artifacts/k6-finance-summary.json': JSON.stringify(data, null, 2),
    stdout: `
═══════════════════════════════════════
  Finance Load Test — Summary
═══════════════════════════════════════
  Requests:     ${data.metrics.http_reqs?.values?.count ?? 'N/A'}
  Failed:       ${data.metrics.http_req_failed?.values?.rate?.toFixed(4) ?? 'N/A'}
  P95 duration: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(0) ?? 'N/A'}ms
  Audit rate:   ${((data.metrics.audit_id_present?.values?.rate ?? 0) * 100).toFixed(1)}%
  Leak free:    ${((data.metrics.account_number_not_leaked?.values?.rate ?? 0) * 100).toFixed(1)}%
═══════════════════════════════════════
`,
  };
}

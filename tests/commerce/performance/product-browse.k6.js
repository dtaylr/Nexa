/**
 * Commerce load test — product browse and add-to-cart flow
 *
 * Background: a 1-second improvement in product page load time
 * lifts conversion approximately 7% (Google Core Web Vitals data).
 * Testing the API layer here; Lighthouse covers the frontend LCP.
 *
 * Run: k6 run tests/commerce/performance/product-browse.k6.js \
 *        -e BASE_URL=http://localhost:3001
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const catalogueDuration = new Trend('catalogue_duration', true);
const productPageDuration = new Trend('product_page_duration', true);
const priceAccuracy = new Rate('price_decimal_accurate');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 150 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.005'],
    catalogue_duration: ['p(95)<200'],
    product_page_duration: ['p(95)<150'],
    price_decimal_accurate: ['rate==1.00'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3001';

let productIds = [];

export function setup() {
  const res = http.get(`${BASE}/api/commerce/products`);
  if (res.status !== 200) return { products: [] };
  const products = JSON.parse(res.body).products || [];
  return { products: products.map(p => ({ id: p.id, price: p.price })) };
}

export default function (data) {
  const { products } = data;
  if (!products.length) return;

  group('catalogue', () => {
    const res = http.get(`${BASE}/api/commerce/products`);
    catalogueDuration.add(res.timings.duration);

    check(res, { 'catalogue returns 200': r => r.status === 200 });

    if (res.status === 200) {
      const body = JSON.parse(res.body);
      for (const p of body.products || []) {
        const str = p.price.toString();
        const decimals = str.includes('.') ? str.split('.')[1].length : 0;
        priceAccuracy.add(decimals <= 2);
      }
    }
  });

  group('product_page', () => {
    const product = products[Math.floor(Math.random() * products.length)];
    const res = http.get(`${BASE}/api/commerce/products/${product.id}`);
    productPageDuration.add(res.timings.duration);
    check(res, { 'product returns 200': r => r.status === 200 });
  });

  sleep(0.3);
}

export function handleSummary(data) {
  return {
    'artifacts/k6-commerce-summary.json': JSON.stringify(data, null, 2),
    stdout: `
═══════════════════════════════════════
  Commerce Load Test — Summary
═══════════════════════════════════════
  Catalogue P95: ${data.metrics.catalogue_duration?.values?.['p(95)']?.toFixed(0) ?? 'N/A'}ms
  Product P95:   ${data.metrics.product_page_duration?.values?.['p(95)']?.toFixed(0) ?? 'N/A'}ms
  Price accurate: ${((data.metrics.price_decimal_accurate?.values?.rate ?? 0) * 100).toFixed(1)}%
  Errors:        ${data.metrics.http_req_failed?.values?.rate?.toFixed(4) ?? 'N/A'}
═══════════════════════════════════════
`,
  };
}

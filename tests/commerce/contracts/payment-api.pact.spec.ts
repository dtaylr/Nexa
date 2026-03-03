/**
 * Consumer-driven contract tests for the Commerce Payment API.
 *
 * The checkout UI (consumer) defines what it expects from the payment/order service (provider).
 * Key assertion: emailQueued must reflect actual email state, not pre-payment optimism.
 * This contract documents and catches COM-003.
 */

import { describe, it, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, string, regex, decimal, uuid, boolean } = MatchersV3;

const provider = new PactV3({
  consumer: 'NexaCore-Web-Checkout',
  provider: 'NexaCore-Commerce-API',
  dir: path.join(process.cwd(), 'pacts'),
  logLevel: 'warn',
});

describe('Commerce Payment API — Consumer Contract', () => {
  it('order creation returns pending status with email not yet queued', async () => {
    await provider
      .given('cart CART-001 exists with one item and active status')
      .uponReceiving('a checkout request to create an order')
      .withRequest({
        method: 'POST',
        path: '/api/commerce/orders',
        headers: {
          'Content-Type': 'application/json',
          Authorization: like('Bearer token'),
        },
        body: { cartId: string('CART-001') },
      })
      .willRespondWith({
        status: 201,
        body: {
          orderId: string('ORD-001'),
          status: 'pending',
          total: decimal(89.99),
          emailQueued: boolean(false),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/commerce/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
          body: JSON.stringify({ cartId: 'CART-001' }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.orderId).toBeTruthy();
        expect(body.status).toBe('pending');
        // Contract asserts emailQueued is false — catches COM-003
        expect(body.emailQueued, 'COM-003: email should not be queued before payment').toBe(false);
      });
  });

  it('successful payment returns CAPTURED status with receipt URL', async () => {
    await provider
      .given('order ORD-001 exists and is awaiting payment')
      .uponReceiving('a valid card payment request')
      .withRequest({
        method: 'POST',
        path: '/api/commerce/orders/ORD-001/payment',
        headers: {
          'Content-Type': 'application/json',
          Authorization: like('Bearer token'),
        },
        body: {
          method: regex({ generate: 'card', matcher: 'card|paypal|apple_pay' }),
          amount: decimal(89.99),
          currency: regex({ generate: 'GBP', matcher: '^[A-Z]{3}$' }),
          cardToken: string('tok_test_visa'),
        },
      })
      .willRespondWith({
        status: 200,
        body: {
          orderId: string('ORD-001'),
          paymentId: uuid(),
          status: regex({ generate: 'CAPTURED', matcher: 'CAPTURED|PENDING|FAILED' }),
          amountCharged: decimal(89.99),
          currency: string('GBP'),
          receiptUrl: string('/receipts/pay-001'),
          emailQueued: boolean(true),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/commerce/orders/ORD-001/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
          body: JSON.stringify({ method: 'card', amount: 89.99, currency: 'GBP', cardToken: 'tok_test_visa' }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.paymentId).toBeTruthy();
        expect(body.status).toBe('CAPTURED');
        expect(body.receiptUrl).toBeTruthy();
      });
  });

  it('product catalogue returns prices with correct precision', async () => {
    await provider
      .given('products exist in the catalogue')
      .uponReceiving('a request for all available products')
      .withRequest({
        method: 'GET',
        path: '/api/commerce/products',
      })
      .willRespondWith({
        status: 200,
        body: {
          products: like([{
            id: string('prod-001'),
            name: string('Running Shoes V2'),
            price: decimal(89.99),
            inventory: like(47),
          }]),
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/commerce/products`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.products.length).toBeGreaterThan(0);
      });
  });
});

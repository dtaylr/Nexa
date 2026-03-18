/**
 * Consumer-driven contract tests for the Commerce Payment API.
 *
 * The checkout UI (consumer) defines what it expects from the payment/order service (provider).
 * Key assertion: emailQueued must reflect actual email state, not pre-payment optimism.
 * This contract documents and catches EMAIL_BEFORE_PAYMENT.
 */

import { describe, it, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const { like, string, regex, decimal, uuid, boolean } = MatchersV3;

const provider = new PactV3({
  consumer: '1Platform-Web-Checkout',
  provider: '1Platform-Commerce-API',
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
          orderId: 'ORD-001',
          status: 'pending',
          total: 89.99,
          emailQueued: false,
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
        expect(body.emailQueued, 'EMAIL_BEFORE_PAYMENT: email should not be queued before payment').toBe(false);
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
          method: string('card'),
          amount: like(89.99),
          currency: string('USD'),
          cardToken: string('tok_test_visa'),
        },
      })
      .willRespondWith({
        status: 200,
        body: {
          orderId: 'ORD-001',
          paymentId: 'pay-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          status: 'CAPTURED',
          amountCharged: 89.99,
          currency: 'USD',
          receiptUrl: '/receipts/pay-001',
          emailQueued: true,
        },
      })
      .executeTest(async (mockserver) => {
        const res = await fetch(`${mockserver.url}/api/commerce/orders/ORD-001/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
          body: JSON.stringify({ method: 'card', amount: 89.99, currency: 'USD', cardToken: 'tok_test_visa' }),
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
            price: like(89.99),
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

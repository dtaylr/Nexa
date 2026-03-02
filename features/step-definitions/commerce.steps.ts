import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import { NexaWorld } from './world';

Given('I am authenticated as a shopper', async function (this: NexaWorld) {
  await this.loginAs('shopper@nexacore.dev', 'password123');
  assert.ok(this.token, 'Shopper login failed');
});

Given('products are available in the catalogue', async function (this: NexaWorld) {
  const { body } = await this.api('/api/commerce/products');
  assert.ok(body.products?.length > 0, 'No products in catalogue');
  this.productId = body.products[0].id;
});

When('I create a new cart', async function (this: NexaWorld) {
  const { body } = await this.api('/api/commerce/cart', { method: 'POST' });
  this.cartId = body.id;
  assert.ok(this.cartId, 'Cart creation failed');
});

When('I add the first available product with quantity {int}', async function (this: NexaWorld, qty: number) {
  const { body } = await this.api(`/api/commerce/cart/${this.cartId}/items`, {
    method: 'PUT',
    body: JSON.stringify({ productId: this.productId, quantity: qty }),
  });
  this.lastBody = body;
});

Then('the cart should contain {int} item', async function (this: NexaWorld, count: number) {
  assert.strictEqual(this.lastBody?.items?.length, count);
});

Given('I have a cart with a product', async function (this: NexaWorld) {
  const { body: products } = await this.api('/api/commerce/products');
  this.productId = products.products[0].id;
  const { body: cart } = await this.api('/api/commerce/cart', { method: 'POST' });
  this.cartId = cart.id;
  await this.api(`/api/commerce/cart/${this.cartId}/items`, {
    method: 'PUT',
    body: JSON.stringify({ productId: this.productId, quantity: 1 }),
  });
});

Given('I apply promotion code {string}', async function (this: NexaWorld, code: string) {
  const { body } = await this.api('/api/commerce/promotions/validate', {
    method: 'POST',
    body: JSON.stringify({ cartId: this.cartId, code }),
  });
  assert.strictEqual(body.discountApplied > 0 || body.error === undefined, true);
});

When('I apply promotion code {string} again', async function (this: NexaWorld, code: string) {
  const { body } = await this.api('/api/commerce/promotions/validate', {
    method: 'POST',
    body: JSON.stringify({ cartId: this.cartId, code }),
  });
  this.lastBody = body;
});

When('I place an order', async function (this: NexaWorld) {
  const { body } = await this.api('/api/commerce/orders', {
    method: 'POST',
    body: JSON.stringify({ cartId: this.cartId }),
  });
  this.lastBody = body;
  this.orderId = body.orderId;
});

Then('emailQueued should be false before payment is taken', async function (this: NexaWorld) {
  assert.strictEqual(
    this.lastBody?.emailQueued,
    false,
    `BUG COM-003: emailQueued is ${this.lastBody?.emailQueued} before payment — should be false`
  );
});

Given('I have a pending order', async function (this: NexaWorld) {
  await this.api('/api/commerce/products').then(async ({ body }) => {
    this.productId = body.products.find((p: any) => p.inventory > 0)?.id;
  });
  const { body: cart } = await this.api('/api/commerce/cart', { method: 'POST' });
  this.cartId = cart.id;
  await this.api(`/api/commerce/cart/${this.cartId}/items`, {
    method: 'PUT',
    body: JSON.stringify({ productId: this.productId, quantity: 1 }),
  });
  const { body: order } = await this.api('/api/commerce/orders', {
    method: 'POST',
    body: JSON.stringify({ cartId: this.cartId }),
  });
  this.orderId = order.orderId;
});

When('I submit payment with method {string} for the order total', async function (this: NexaWorld, method: string) {
  const { body } = await this.api(`/api/commerce/orders/${this.orderId}/payment`, {
    method: 'POST',
    body: JSON.stringify({ method, amount: 10.00, currency: 'GBP', cardToken: 'tok_test_visa' }),
  });
  this.lastBody = body;
});

Then('the payment status should be {string}', async function (this: NexaWorld, expected: string) {
  assert.strictEqual(this.lastBody?.status, expected);
});

Then('the order ID should be in the response', async function (this: NexaWorld) {
  assert.strictEqual(this.lastBody?.orderId, this.orderId);
});

When('I retrieve the product catalogue', async function (this: NexaWorld) {
  const { body } = await this.api('/api/commerce/products');
  this.lastBody = body;
});

Then('every product price should have at most {int} decimal places', async function (this: NexaWorld, places: number) {
  for (const p of this.lastBody?.products ?? []) {
    const str = p.price.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    assert.ok(
      decimals <= places,
      `BUG COM-006: product "${p.name}" has price ${p.price} — ${decimals} decimal places`
    );
  }
});

Given('a product with exactly {int} unit of inventory', async function (this: NexaWorld, _qty: number) {
  this.productId = 'PROD-999';
});

Given('two shoppers attempt to buy that product simultaneously', async function (this: NexaWorld) {
  const makeCart = async () => {
    const { body: cart } = await this.api('/api/commerce/cart', { method: 'POST' });
    await this.api(`/api/commerce/cart/${cart.id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ productId: this.productId, quantity: 1 }),
    });
    return cart.id;
  };
  const [c1, c2] = await Promise.all([makeCart(), makeCart()]);
  const [o1, o2] = await Promise.all([
    this.api('/api/commerce/orders', { method: 'POST', body: JSON.stringify({ cartId: c1 }) }),
    this.api('/api/commerce/orders', { method: 'POST', body: JSON.stringify({ cartId: c2 }) }),
  ]);
  this.lastBody = { statuses: [o1.status, o2.status], bodies: [o1.body, o2.body] };
});

Then('exactly one order should succeed', async function (this: NexaWorld) {
  const succeeded = this.lastBody.statuses.filter((s: number) => s === 201);
  assert.strictEqual(succeeded.length, 1, `BUG COM-002: ${succeeded.length} orders succeeded — expected exactly 1`);
});

Then('the other should return status {int}', async function (this: NexaWorld, expected: number) {
  const failed = this.lastBody.statuses.filter((s: number) => s === expected);
  assert.strictEqual(failed.length, 1, `Expected one order to return ${expected}`);
});

Then('the final inventory should be {int}', async function (this: NexaWorld, expected: number) {
  const { body } = await this.api(`/api/commerce/products/${this.productId}`);
  assert.strictEqual(body.inventory, expected, `BUG COM-002: inventory is ${body.inventory}, expected ${expected}`);
});

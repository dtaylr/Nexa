/**
 * Commerce Domain Test Data Builder
 */

import { v4 as uuid } from 'uuid';

//  Cart 

export interface CartItemPayload {
  productId: string;
  quantity: number;
}

export class CartItemBuilder {
  private payload: CartItemPayload = {
    productId: uuid(),
    quantity: 1,
  };

  withProduct(productId: string): this {
    this.payload.productId = productId;
    return this;
  }

  withQuantity(qty: number): this {
    this.payload.quantity = qty;
    return this;
  }

  /** Quantity exceeding typical inventory — triggers INVENTORY_OVERSELL_RACE. */
  excessiveQuantity(): this {
    this.payload.quantity = 99_999;
    return this;
  }

  build(): CartItemPayload {
    return { ...this.payload };
  }
}

//  Order 

export interface OrderPayload {
  cartId: string;
  customerId: string;
  shippingAddress: {
    line1: string;
    city: string;
    zip: string;
    country: string;
  };
  promoCode?: string;
}

export class OrderBuilder {
  private payload: OrderPayload = {
    cartId: uuid(),
    customerId: uuid(),
    shippingAddress: {
      line1: '123 Main St',
      city: 'Testville',
      zip: '90210',
      country: 'US',
    },
  };

  withCart(cartId: string): this {
    this.payload.cartId = cartId;
    return this;
  }

  withCustomer(customerId: string): this {
    this.payload.customerId = customerId;
    return this;
  }

  withPromo(code: string): this {
    this.payload.promoCode = code;
    return this;
  }

  build(): OrderPayload {
    return { ...this.payload };
  }
}

//  Promo Code 

export interface PromoPayload {
  code: string;
  discountPercent: number;
  maxUses: number;
  expiresAt?: string;
}

export class PromoBuilder {
  private payload: PromoPayload = {
    code: `TEST-${uuid().slice(0, 6).toUpperCase()}`,
    discountPercent: 10,
    maxUses: 100,
  };

  withCode(code: string): this {
    this.payload.code = code;
    return this;
  }

  withDiscount(pct: number): this {
    this.payload.discountPercent = pct;
    return this;
  }

  /** Single-use promo.stacking two applications triggers PROMO_CODE_STACKING. */
  singleUse(): this {
    this.payload.maxUses = 1;
    return this;
  }

  expiredYesterday(): this {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    this.payload.expiresAt = yesterday;
    return this;
  }

  build(): PromoPayload {
    return { ...this.payload };
  }
}

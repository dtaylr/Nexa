/**
 * Finance Test Data Builder
 *
 * Builder pattern for constructing realistic finance domain payloads.
 * Eliminates copy-paste across test files and makes intent explicit:
 *
 *   const tx = new TransferBuilder()
 *     .withAmount(9999)
 *     .withNote('Rent payment')
 *     .build();
 *
 * Defaults are chosen to pass all current validations — override
 * only the field(s) relevant to the test under scrutiny.
 */

import { v4 as uuid } from 'uuid';

//  Account 

export interface AccountPayload {
  owner: string;
  name: string;
  initialBalance: number;
}

export class AccountBuilder {
  private payload: AccountPayload = {
    owner: `user-${uuid()}`,
    name: 'Checking Account',
    initialBalance: 1000,
  };

  withOwner(owner: string): this {
    this.payload.owner = owner;
    return this;
  }

  withName(name: string): this {
    this.payload.name = name;
    return this;
  }

  withBalance(balance: number): this {
    this.payload.initialBalance = balance;
    return this;
  }

  /** Zero-balance account — useful for insufficient-funds tests. */
  empty(): this {
    this.payload.initialBalance = 0;
    return this;
  }

  build(): AccountPayload {
    return { ...this.payload };
  }
}

//  Transfer 

export interface TransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
}

export class TransferBuilder {
  private payload: TransferPayload = {
    fromAccountId: uuid(),
    toAccountId: uuid(),
    amount: 100,
  };

  from(accountId: string): this {
    this.payload.fromAccountId = accountId;
    return this;
  }

  to(accountId: string): this {
    this.payload.toAccountId = accountId;
    return this;
  }

  withAmount(amount: number): this {
    this.payload.amount = amount;
    return this;
  }

  withNote(note: string): this {
    this.payload.note = note;
    return this;
  }

  /** Large transfer that typically exceeds account balances — triggers BALANCE_RACE_CONDITION. */
  large(): this {
    this.payload.amount = 999_999;
    return this;
  }

  /** Fractional amount that exposes SUMMARY_FLOAT_DRIFT float precision bug. */
  fractional(): this {
    this.payload.amount = 0.1 + 0.2; // 0.30000000000000004
    return this;
  }

  build(): TransferPayload {
    return { ...this.payload };
  }
}

//  Report params 

export interface ReportParams {
  accountId: string;
  year: number;
  month: number;
}

export class ReportParamsBuilder {
  private params: ReportParams = {
    accountId: uuid(),
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  };

  forAccount(accountId: string): this {
    this.params.accountId = accountId;
    return this;
  }

  forMonth(year: number, month: number): this {
    this.params.year = year;
    this.params.month = month;
    return this;
  }

  build(): ReportParams {
    return { ...this.params };
  }
}

import { beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

import('../apps/api/src/db');

let db: Database.Database;

export function getTestDb() {
  if (!db) {
    db = new Database(':memory:');
  }
  return db;
}

export const TEST_USERS = {
  banker: { id: 1, email: 'alice@test.dev', role: 'banker' },
  patient: { id: 2, email: 'patient@test.dev', role: 'patient' },
  shopper: { id: 3, email: 'shopper@test.dev', role: 'shopper' },
};

export const TEST_ACCOUNTS = {
  aliceCurrent: 'acc-test-alice-current',
  aliceSavings: 'acc-test-alice-savings',
  bob: 'acc-test-bob',
};

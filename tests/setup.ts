import { beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

let _db: Database.Database | null = null;

export function getTestDb(): Database.Database {
  return _db!;
}

// Seed standard users once per test suite so login-based tests work
beforeAll(async () => {
  const { db } = await import('../apps/api/src/db');
  _db = db;
  const { seedStandardUsers } = await import('./helpers/helpers');
  seedStandardUsers(db);
});

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

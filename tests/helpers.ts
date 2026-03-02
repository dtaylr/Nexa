import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

export function makeToken(user: { id: number; email: string; role: string }, expiresIn: number = 3600) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn });
}

export function makeExpiredToken(user: { id: number; email: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) - 60 },
    JWT_SECRET
  );
}

export function makeRecentlyExpiredToken(user: { id: number; email: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) - 10 },
    JWT_SECRET
  );
}

export function seedUser(db: Database.Database, email: string, role: string): number {
  const hash = bcrypt.hashSync('password', 10);
  const r = db.prepare('INSERT INTO users (email, passwordHash, role) VALUES (?, ?, ?)').run(email, hash, role);
  return r.lastInsertRowid as number;
}

export function seedAccount(db: Database.Database, userId: number, balancePence: number, id = uuidv4()): string {
  db.prepare(
    "INSERT INTO fin_accounts (id, userId, accountNumber, balance, currency, type) VALUES (?, ?, ?, ?, 'GBP', 'current')"
  ).run(id, userId, `601613${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`, balancePence);
  return id;
}

export function getAccountBalance(db: Database.Database, accountId: string): number {
  return (db.prepare('SELECT balance FROM fin_accounts WHERE id = ?').get(accountId) as any).balance;
}

export function seedInventory(db: Database.Database, productId: string, quantity: number) {
  db.prepare('UPDATE com_products SET inventory = ? WHERE id = ?').run(quantity, productId);
}

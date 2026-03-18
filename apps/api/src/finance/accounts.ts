import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getAccounts(req: AuthRequest, res: Response) {
  const accounts = db.prepare(
    'SELECT id, accountNumber, balance, currency, type FROM fin_accounts WHERE userId = ?'
  ).all(req.user!.id) as any[];

  return res.json({
    accounts: accounts.map(a => ({
      id: a.id,
      accountNumber: a.accountNumber,
      balance: a.balance / 100,
      currency: a.currency,
      type: a.type,
    })),
  });
}

export function getAccount(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const account = db.prepare('SELECT * FROM fin_accounts WHERE id = ?').get(id) as any;

  if (!account) {
    // BUG ACCOUNT_ID_DISCLOSURE: account ID is exposed in error response body
    return res.status(404).json({ error: 'Account not found', accountId: id });
  }

  if (account.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json({
    id: account.id,
    accountNumber: account.accountNumber,
    balance: account.balance / 100,
    currency: account.currency,
    type: account.type,
  });
}

export function lookupAccount(req: AuthRequest, res: Response) {
  const q = (req.query.q as string || '').trim();
  if (q.length < 3) return res.status(400).json({ error: 'Query must be at least 3 characters' });

  const accounts = db.prepare(
    "SELECT id, accountNumber, type FROM fin_accounts WHERE accountNumber LIKE ? LIMIT 5"
  ).all(`%${q}%`) as any[];

  return res.json({
    accounts: accounts.map(a => ({
      id: a.id,
      accountNumber: a.accountNumber,
      type: a.type,
    })),
  });
}

export function getAccountTransactions(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const account = db.prepare('SELECT * FROM fin_accounts WHERE id = ?').get(id) as any;

  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  const transactions = db.prepare(`
    SELECT id, fromAccountId, toAccountId, amount, currency, reference, status, createdAt
    FROM fin_transfers
    WHERE fromAccountId = ? OR toAccountId = ?
    ORDER BY createdAt DESC
    LIMIT 50
  `).all(id, id) as any[];

  return res.json({
    accountId: id,
    transactions: transactions.map(t => ({
      id: t.id,
      type: t.fromAccountId === id ? 'debit' : 'credit',
      amount: t.amount / 100,
      currency: t.currency,
      reference: t.reference,
      status: t.status,
      createdAt: t.createdAt,
    })),
  });
}

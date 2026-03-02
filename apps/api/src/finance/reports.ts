import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getMonthlySummary(req: AuthRequest, res: Response) {
  const accounts = db.prepare(
    'SELECT id FROM fin_accounts WHERE userId = ?'
  ).all(req.user!.id) as any[];

  if (!accounts.length) return res.json({ totalIn: 0, totalOut: 0, net: 0, transactions: [] });

  const accountIds = accounts.map(a => a.id);
  const placeholders = accountIds.map(() => '?').join(',');

  const transactions = db.prepare(`
    SELECT amount, fromAccountId, toAccountId, currency, reference, status, createdAt
    FROM fin_transfers
    WHERE (fromAccountId IN (${placeholders}) OR toAccountId IN (${placeholders}))
      AND strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now')
    ORDER BY createdAt DESC
  `).all(...accountIds, ...accountIds) as any[];

  // BUG FIN-002: plain JS floating-point addition — 0.1 + 0.2 = 0.30000000000000004
  let totalIn = 0;
  let totalOut = 0;

  for (const t of transactions) {
    const amountDecimal = t.amount / 100;
    if (accountIds.includes(t.toAccountId)) totalIn = totalIn + amountDecimal;
    if (accountIds.includes(t.fromAccountId)) totalOut = totalOut + amountDecimal;
  }

  return res.json({
    month: new Date().toISOString().slice(0, 7),
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    transactionCount: transactions.length,
  });
}

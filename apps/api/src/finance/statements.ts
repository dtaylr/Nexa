import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getStatement(req: AuthRequest, res: Response) {
  const { accountId } = req.params;
  const { year, month } = req.query as { year?: string; month?: string };

  const account = db.prepare('SELECT * FROM fin_accounts WHERE id = ? AND userId = ?').get(accountId, req.user!.id) as any;
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const y = year ? parseInt(year) : new Date().getFullYear();
  const m = month ? parseInt(month) : new Date().getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = `${y}-${String(m).padStart(2, '0')}-31`;

  const credits = db.prepare(
    "SELECT t.*, 'credit' as direction FROM fin_transfers t WHERE t.toAccountId = ? AND t.createdAt BETWEEN ? AND ? AND t.status = 'COMPLETED' ORDER BY t.createdAt DESC"
  ).all(accountId, start, end) as any[];

  const debits = db.prepare(
    "SELECT t.*, 'debit' as direction FROM fin_transfers t WHERE t.fromAccountId = ? AND t.createdAt BETWEEN ? AND ? AND t.status = 'COMPLETED' ORDER BY t.createdAt DESC"
  ).all(accountId, start, end) as any[];

  const transactions = [...credits, ...debits].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalIn = credits.reduce((s: number, t: any) => s + t.amount, 0);
  const totalOut = debits.reduce((s: number, t: any) => s + t.amount, 0);

  return res.json({
    account: { id: account.id, accountNumber: account.accountNumber, type: account.type, currency: account.currency },
    period: { year: y, month: m, start, end },
    openingBalance: account.balance + totalOut - totalIn,
    closingBalance: account.balance,
    totalIn,
    totalOut,
    transactions,
  });
}

export function getStatementCsv(req: AuthRequest, res: Response) {
  const { accountId } = req.params;
  const { year, month } = req.query as { year?: string; month?: string };

  const account = db.prepare('SELECT * FROM fin_accounts WHERE id = ? AND userId = ?').get(accountId, req.user!.id) as any;
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const y = year ? parseInt(year) : new Date().getFullYear();
  const m = month ? parseInt(month) : new Date().getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = `${y}-${String(m).padStart(2, '0')}-31`;

  const credits = db.prepare(
    "SELECT t.id, t.createdAt, 'Credit' as type, t.amount, t.reference FROM fin_transfers t WHERE t.toAccountId = ? AND t.createdAt BETWEEN ? AND ? AND t.status = 'COMPLETED'"
  ).all(accountId, start, end) as any[];

  const debits = db.prepare(
    "SELECT t.id, t.createdAt, 'Debit' as type, t.amount, t.reference FROM fin_transfers t WHERE t.fromAccountId = ? AND t.createdAt BETWEEN ? AND ? AND t.status = 'COMPLETED'"
  ).all(accountId, start, end) as any[];

  const rows = [...credits, ...debits].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const csv = ['Date,Type,Amount (cents),Reference', ...rows.map(r => `${r.createdAt},${r.type},${r.amount},${r.reference || ''}`)].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="statement-${y}-${m}.csv"`);
  return res.send(csv);
}

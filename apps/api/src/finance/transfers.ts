import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function createTransfer(req: AuthRequest, res: Response) {
  const { fromAccountId, toAccountId, amount, currency = 'USD', reference } = req.body;

  if (!fromAccountId || !toAccountId || !amount) {
    return res.status(400).json({ error: 'fromAccountId, toAccountId, and amount are required' });
  }

  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'Source and destination accounts must be different' });
  }

  if (typeof amount !== 'number' || !isFinite(amount)) {
    return res.status(400).json({ error: 'Amount must be a number' });
  }

  const amountInCents = Math.round(amount * 100);
  if (amountInCents <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }

  const fromAccount = db.prepare('SELECT * FROM fin_accounts WHERE id = ?').get(fromAccountId) as any;
  if (!fromAccount) {
    return res.status(404).json({ error: 'Source account not found' });
  }

  if (fromAccount.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const toAccount = db.prepare('SELECT * FROM fin_accounts WHERE id = ?').get(toAccountId) as any;
  if (!toAccount) {
    return res.status(404).json({ error: 'Destination account not found' });
  }

  // BUG BALANCE_RACE_CONDITION: balance check and debit are not wrapped in a transaction.
  // Two concurrent requests can both pass this check before either updates the balance.
  if (fromAccount.balance < amountInCents) {
    return res.status(422).json({
      error: 'INSUFFICIENT_FUNDS',
      availableBalance: fromAccount.balance / 100,
      requestedAmount: amount,
    });
  }

  const transferId = uuidv4();
  const auditId = uuidv4();

  db.prepare('UPDATE fin_accounts SET balance = balance - ? WHERE id = ?').run(amountInCents, fromAccountId);
  db.prepare('UPDATE fin_accounts SET balance = balance + ? WHERE id = ?').run(amountInCents, toAccountId);

  db.prepare(`
    INSERT INTO fin_transfers (id, fromAccountId, toAccountId, amount, currency, reference, status, auditId)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(transferId, fromAccountId, toAccountId, amountInCents, currency, reference, auditId);

  // BUG AUDIT_SILENT_FAILURE: audit log is written asynchronously and can silently fail under load.
  // The auditId is already returned in the response, but the record may never be written.
  setImmediate(() => {
    try {
      db.prepare(`
        INSERT INTO fin_audit_log (id, transferId, action, metadata)
        VALUES (?, ?, 'TRANSFER_CREATED', ?)
      `).run(uuidv4(), transferId, JSON.stringify({ amountInCents, currency, reference }));
    } catch {
      // swallowed — no retry, no alert
    }
  });

  return res.status(201).json({
    transferId,
    status: 'PENDING',
    auditId,
    timestamp: new Date().toISOString(),
    amount,
    currency,
  });
}

export function getTransferAudit(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const transfer = db.prepare('SELECT * FROM fin_transfers WHERE id = ?').get(id) as any;
  if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

  const auditEntry = db.prepare(
    'SELECT * FROM fin_audit_log WHERE transferId = ?'
  ).get(id) as any;

  if (!auditEntry) return res.status(404).json({ error: 'Audit record not found' });

  return res.json({
    transferId: id,
    auditId: auditEntry.id,
    action: auditEntry.action,
    metadata: JSON.parse(auditEntry.metadata || '{}'),
    createdAt: auditEntry.createdAt,
  });
}

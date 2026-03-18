import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getFraudEvents(req: AuthRequest, res: Response) {
  const events = db.prepare(
    'SELECT * FROM fin_fraud_events WHERE userId = ? ORDER BY createdAt DESC LIMIT 50'
  ).all(req.user!.id) as any[];
  const unresolved = events.filter(e => !e.resolved).length;
  return res.json({ events, unresolved });
}

export function resolveFraudEvent(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const event = db.prepare('SELECT * FROM fin_fraud_events WHERE id = ? AND userId = ?').get(id, req.user!.id);
  if (!event) return res.status(404).json({ error: 'Fraud event not found' });
  db.prepare('UPDATE fin_fraud_events SET resolved = 1 WHERE id = ?').run(id);
  return res.json({ resolved: true });
}

export function logFraudEvent(userId: number, accountId: string, type: string, severity: 'low' | 'medium' | 'high' | 'critical', description: string) {
  db.prepare('INSERT INTO fin_fraud_events (id, userId, accountId, type, severity, description) VALUES (?,?,?,?,?,?)')
    .run(uuidv4(), userId, accountId, type, severity, description);
}

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function requestReturn(req: AuthRequest, res: Response) {
  const { orderId } = req.params;
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'reason is required' });

  const order = db.prepare('SELECT * FROM com_orders WHERE id = ? AND userId = ?').get(orderId, req.user!.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'paid') return res.status(422).json({ error: 'INVALID_STATUS', message: 'Only paid orders can be returned' });

  const existing = db.prepare("SELECT id FROM com_returns WHERE orderId = ? AND status NOT IN ('rejected')").get(orderId);
  if (existing) return res.status(409).json({ error: 'Return already requested for this order' });

  const id = uuidv4();
  // 30-day return policy check
  const orderDate = new Date(order.createdAt);
  const daysSince = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 30) return res.status(422).json({ error: 'RETURN_WINDOW_EXPIRED', message: 'Return window of 30 days has passed' });

  db.prepare('INSERT INTO com_returns (id, orderId, userId, reason, status, refundAmount) VALUES (?,?,?,?,?,?)')
    .run(id, orderId, req.user!.id, reason.trim(), 'requested', order.total);
  return res.status(201).json({ id, orderId, status: 'requested', refundAmount: order.total, message: 'Return request submitted. You will receive a prepaid label within 2 business days.' });
}

export function getReturns(req: AuthRequest, res: Response) {
  const returns = db.prepare('SELECT * FROM com_returns WHERE userId = ? ORDER BY requestedAt DESC').all(req.user!.id);
  return res.json({ returns });
}

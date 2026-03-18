import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getCards(req: AuthRequest, res: Response) {
  const cards = db.prepare('SELECT * FROM fin_cards WHERE userId = ? ORDER BY createdAt DESC').all(req.user!.id);
  return res.json({ cards });
}

export function issueCard(req: AuthRequest, res: Response) {
  const { accountId, cardType = 'virtual', cardholderName, dailyLimit = 50000 } = req.body;
  if (!accountId || !cardholderName) return res.status(400).json({ error: 'accountId and cardholderName are required' });
  const account = db.prepare('SELECT * FROM fin_accounts WHERE id = ? AND userId = ?').get(accountId, req.user!.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const lastFour = String(Math.floor(1000 + Math.random() * 9000));
  const expiresAt = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const cardId = uuidv4();
  db.prepare('INSERT INTO fin_cards (id, accountId, userId, cardType, lastFour, cardholderName, expiresAt, status, dailyLimit) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(cardId, accountId, req.user!.id, cardType, lastFour, cardholderName, expiresAt, 'active', dailyLimit);
  return res.status(201).json({ id: cardId, lastFour, cardType, status: 'active', expiresAt });
}

export function freezeCard(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const card = db.prepare('SELECT * FROM fin_cards WHERE id = ? AND userId = ?').get(id, req.user!.id) as any;
  if (!card) return res.status(404).json({ error: 'Card not found' });
  if (card.status === 'cancelled') return res.status(422).json({ error: 'Cannot modify a cancelled card' });
  const newStatus = card.status === 'frozen' ? 'active' : 'frozen';
  db.prepare('UPDATE fin_cards SET status = ? WHERE id = ?').run(newStatus, id);
  return res.json({ id, status: newStatus });
}

export function cancelCard(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const card = db.prepare('SELECT * FROM fin_cards WHERE id = ? AND userId = ?').get(id, req.user!.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  db.prepare("UPDATE fin_cards SET status = 'cancelled' WHERE id = ?").run(id);
  return res.json({ id, status: 'cancelled' });
}

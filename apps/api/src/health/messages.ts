import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getMessages(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const patient = db.prepare('SELECT * FROM hlt_patients WHERE id = ?').get(id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const messages = db.prepare(
    'SELECT * FROM hlt_messages WHERE patientId = ? ORDER BY sentAt DESC LIMIT 50'
  ).all(id) as any[];
  return res.json({ messages });
}

export function sendMessage(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { subject, body, recipientId } = req.body;
  if (!subject?.trim()) return res.status(400).json({ error: 'subject is required' });
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
  const msgId = uuidv4();
  db.prepare(
    'INSERT INTO hlt_messages (id, senderId, recipientId, patientId, subject, body) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(msgId, req.user!.id, recipientId || null, id, subject.trim(), body.trim());
  return res.status(201).json({ id: msgId, status: 'sent', sentAt: new Date().toISOString() });
}

export function markRead(req: AuthRequest, res: Response) {
  const { messageId } = req.params;
  db.prepare('UPDATE hlt_messages SET isRead = 1 WHERE id = ?').run(messageId);
  return res.json({ success: true });
}

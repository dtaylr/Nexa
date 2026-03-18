import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getBeneficiaries(req: AuthRequest, res: Response) {
  const beneficiaries = db.prepare('SELECT * FROM fin_beneficiaries WHERE userId = ? ORDER BY name ASC').all(req.user!.id);
  return res.json({ beneficiaries });
}

export function addBeneficiary(req: AuthRequest, res: Response) {
  const { name, accountNumber, sortCode, reference } = req.body;
  if (!name?.trim() || !accountNumber?.trim() || !sortCode?.trim()) {
    return res.status(400).json({ error: 'name, accountNumber, and sortCode are required' });
  }
  if (!/^\d{6}$/.test(sortCode.replace(/-/g, ''))) {
    return res.status(400).json({ error: 'sortCode must be 6 digits (e.g. 00-11-22)' });
  }
  const id = uuidv4();
  db.prepare('INSERT INTO fin_beneficiaries (id, userId, name, accountNumber, sortCode, reference) VALUES (?,?,?,?,?,?)')
    .run(id, req.user!.id, name.trim(), accountNumber.trim(), sortCode.replace(/-/g, ''), reference?.trim() || null);
  return res.status(201).json({ id, name, accountNumber, sortCode, reference });
}

export function deleteBeneficiary(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const b = db.prepare('SELECT id FROM fin_beneficiaries WHERE id = ? AND userId = ?').get(id, req.user!.id);
  if (!b) return res.status(404).json({ error: 'Beneficiary not found' });
  db.prepare('DELETE FROM fin_beneficiaries WHERE id = ?').run(id);
  return res.json({ deleted: true });
}

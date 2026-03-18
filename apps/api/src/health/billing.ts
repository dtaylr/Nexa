import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getBilling(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const bills = db.prepare('SELECT * FROM hlt_billing WHERE patientId = ? ORDER BY serviceDate DESC').all(id) as any[];
  const outstanding = bills.filter(b => b.status === 'pending').reduce((s: number, b: any) => s + b.patientResponsibility, 0);
  return res.json({ bills, outstanding });
}

export function payBill(req: AuthRequest, res: Response) {
  const { id, billId } = req.params;
  const { amount, method } = req.body;
  if (!amount || !method) return res.status(400).json({ error: 'amount and method are required' });
  const bill = db.prepare('SELECT * FROM hlt_billing WHERE id = ? AND patientId = ?').get(billId, id) as any;
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  if (bill.status === 'paid') return res.status(422).json({ error: 'Bill already paid' });
  db.prepare("UPDATE hlt_billing SET status='paid', paidAt=datetime('now') WHERE id=?").run(billId);
  return res.json({ success: true, paidAt: new Date().toISOString() });
}

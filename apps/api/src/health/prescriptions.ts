import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getPrescriptions(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const patient = db.prepare('SELECT * FROM hlt_patients WHERE id = ?').get(id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const prescriptions = db.prepare(
    'SELECT * FROM hlt_prescriptions WHERE patientId = ? ORDER BY prescribedAt DESC'
  ).all(id) as any[];
  return res.json({ prescriptions });
}

export function requestRenewal(req: AuthRequest, res: Response) {
  const { id, prescriptionId } = req.params;
  const rx = db.prepare('SELECT * FROM hlt_prescriptions WHERE id = ? AND patientId = ?').get(prescriptionId, id) as any;
  if (!rx) return res.status(404).json({ error: 'Prescription not found' });
  if (rx.status === 'cancelled') return res.status(422).json({ error: 'CANCELLED_RX', message: 'Cannot renew a cancelled prescription' });
  if (rx.refillsRemaining <= 0) return res.status(422).json({ error: 'NO_REFILLS', message: 'No refills remaining — provider approval required' });
  db.prepare("UPDATE hlt_prescriptions SET status = 'pending_renewal' WHERE id = ?").run(prescriptionId);
  return res.json({ id: prescriptionId, status: 'pending_renewal', message: 'Renewal request submitted to your provider' });
}

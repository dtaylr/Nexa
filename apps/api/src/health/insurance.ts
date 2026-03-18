import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getInsurance(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const insurance = db.prepare('SELECT * FROM hlt_insurance WHERE patientId = ?').all(id) as any[];
  return res.json({ insurance });
}

export function updateInsurance(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { provider, policyNumber, groupNumber, memberName, effectiveDate, expirationDate, copay } = req.body;
  if (!provider || !policyNumber || !memberName || !effectiveDate) {
    return res.status(400).json({ error: 'provider, policyNumber, memberName, and effectiveDate are required' });
  }
  const existing = db.prepare('SELECT id FROM hlt_insurance WHERE patientId = ?').get(id) as any;
  if (existing) {
    db.prepare(
      'UPDATE hlt_insurance SET provider=?, policyNumber=?, groupNumber=?, memberName=?, effectiveDate=?, expirationDate=?, copay=? WHERE patientId=?'
    ).run(provider, policyNumber, groupNumber || null, memberName, effectiveDate, expirationDate || null, copay || 0, id);
    return res.json({ updated: true });
  }
  db.prepare(
    'INSERT INTO hlt_insurance (id, patientId, provider, policyNumber, groupNumber, memberName, effectiveDate, expirationDate, copay) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(uuidv4(), id, provider, policyNumber, groupNumber || null, memberName, effectiveDate, expirationDate || null, copay || 0);
  return res.status(201).json({ created: true });
}

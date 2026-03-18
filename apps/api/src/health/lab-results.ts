import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getLabResults(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const patient = db.prepare('SELECT * FROM hlt_patients WHERE id = ?').get(id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  // BUG PATIENT_RECORDS_IDOR: no ownership check — any authenticated user can access
  const results = db.prepare(
    'SELECT * FROM hlt_lab_results WHERE patientId = ? ORDER BY collectedAt DESC'
  ).all(id) as any[];
  return res.json({ labResults: results });
}

export function getLabResult(req: AuthRequest, res: Response) {
  const { id, resultId } = req.params;
  const result = db.prepare('SELECT * FROM hlt_lab_results WHERE id = ? AND patientId = ?').get(resultId, id) as any;
  if (!result) return res.status(404).json({ error: 'Lab result not found' });
  return res.json(result);
}

export function orderLabTest(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { testName, orderedBy, notes } = req.body;
  if (!testName) return res.status(400).json({ error: 'testName is required' });
  const patient = db.prepare('SELECT * FROM hlt_patients WHERE id = ?').get(id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const labId = uuidv4();
  db.prepare(
    'INSERT INTO hlt_lab_results (id, patientId, testName, value, unit, status, orderedBy, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(labId, id, testName, 0, 'pending', 'pending', orderedBy || req.user!.id, notes || null);
  return res.status(201).json({ id: labId, status: 'pending', message: 'Lab order created. Results will be available when reported.' });
}

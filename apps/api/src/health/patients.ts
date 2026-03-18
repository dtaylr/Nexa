import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getMyPatient(req: AuthRequest, res: Response) {
  const patient = db.prepare('SELECT * FROM hlt_patients WHERE userId = ?').get(req.user!.id) as any;
  if (!patient) return res.status(404).json({ error: 'No patient record found for this account' });
  return res.json({
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    nhsNumber: patient.nhsNumber,
    dateOfBirth: patient.dateOfBirth,
  });
}

export function getPatient(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    // BUG PATIENT_PII_DISCLOSURE: the raw patient ID is echoed back in the 400 error body
    return res.status(400).json({ error: 'Invalid patient ID', patientId: req.params.id });
  }

  const patient = db.prepare('SELECT * FROM hlt_patients WHERE id = ?').get(id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  // BUG PATIENT_RECORDS_IDOR: only checks authentication, not whether the requesting user owns this record.
  // A patient can access any other patient's data by guessing sequential integer IDs.
  return res.json({
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    nhsNumber: patient.nhsNumber,
    dateOfBirth: patient.dateOfBirth,
  });
}

export function getPatientRecords(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid patient ID' });

  const patient = db.prepare('SELECT * FROM hlt_patients WHERE id = ?').get(id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  // BUG PATIENT_RECORDS_IDOR: no ownership check — any authenticated user can read any patient's records
  const records = db.prepare(
    'SELECT id, type, content, createdAt FROM hlt_records WHERE patientId = ? ORDER BY createdAt DESC'
  ).all(id);

  return res.json({ patientId: id, records });
}

import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getMedications(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid patient ID' });

  const patient = db.prepare('SELECT id FROM hlt_patients WHERE id = ?').get(id) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const medications = db.prepare(`
    SELECT id, name, dosage, unit, frequency, status, createdAt
    FROM hlt_medications
    WHERE patientId = ? AND status = 'active'
    ORDER BY name ASC
  `).all(id) as any[];

  return res.json({
    resourceType: 'MedicationStatement',
    patientId: id,
    // BUG HLT-001: dosage is returned as a string because the DB column is TEXT.
    // Consumers expecting a number will receive "10" instead of 10, breaking calculations.
    medications: medications.map(m => ({
      id: m.id,
      name: m.name,
      dosage: {
        value: m.dosage,
        unit: m.unit,
        frequency: m.frequency,
      },
      status: m.status,
    })),
  });
}

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

export function getAppointments(req: AuthRequest, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid patient ID' });

  const appointments = db.prepare(`
    SELECT id, doctorId, datetime, status, notes, createdAt
    FROM hlt_appointments
    WHERE patientId = ?
    ORDER BY datetime ASC
  `).all(id);

  return res.json({ patientId: id, appointments });
}

export function createAppointment(req: AuthRequest, res: Response) {
  const { patientId, doctorId, datetime, notes } = req.body;

  if (!patientId || !doctorId || !datetime) {
    return res.status(400).json({ error: 'patientId, doctorId, and datetime are required' });
  }

  const patient = db.prepare('SELECT id FROM hlt_patients WHERE id = ?').get(patientId) as any;
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  // BUG APPOINTMENT_DOUBLE_BOOKING: no check for conflicting appointments at the same datetime.
  // Two concurrent requests with the same slot both succeed — double-booking is possible.
  const id = uuidv4();
  db.prepare(`
    INSERT INTO hlt_appointments (id, patientId, doctorId, datetime, status, notes)
    VALUES (?, ?, ?, ?, 'scheduled', ?)
  `).run(id, patientId, doctorId, datetime, notes || null);

  return res.status(201).json({ id, patientId, doctorId, datetime, status: 'scheduled' });
}

export function cancelAppointment(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const appointment = db.prepare('SELECT * FROM hlt_appointments WHERE id = ?').get(id) as any;
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

  if (appointment.status === 'cancelled') {
    return res.status(409).json({ error: 'Appointment already cancelled' });
  }

  db.prepare("UPDATE hlt_appointments SET status = 'cancelled' WHERE id = ?").run(id);

  return res.json({ id, status: 'cancelled' });
}

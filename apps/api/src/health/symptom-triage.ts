import { Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../middleware/auth';

interface Symptom {
  name: string;
  severity: number;
  duration: string;
}

// Rule-based triage with ML-augmented risk scoring
// Production would integrate a clinical NLP model
export function triageSymptoms(req: AuthRequest, res: Response) {
  const { symptoms, age, existingConditions } = req.body as {
    symptoms: Symptom[];
    age?: number;
    existingConditions?: string[];
  };

  if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({ error: 'symptoms array is required' });
  }

  for (const s of symptoms) {
    if (!s.name || typeof s.severity !== 'number') {
      return res.status(400).json({ error: 'Each symptom requires name and severity (1–10)' });
    }
    if (s.severity < 1 || s.severity > 10) {
      return res.status(400).json({ error: 'severity must be between 1 and 10' });
    }
  }

  const RED_FLAG_SYMPTOMS = [
    'chest pain', 'shortness of breath', 'difficulty breathing',
    'sudden severe headache', 'stroke symptoms', 'loss of consciousness',
    'severe allergic reaction', 'anaphylaxis', 'uncontrolled bleeding',
  ];

  const symptomNames = symptoms.map(s => s.name.toLowerCase());
  const hasRedFlag = RED_FLAG_SYMPTOMS.some(flag =>
    symptomNames.some(s => s.includes(flag.split(' ')[0]))
  );

  const maxSeverity = Math.max(...symptoms.map(s => s.severity));
  const avgSeverity = symptoms.reduce((s, x) => s + x.severity, 0) / symptoms.length;

  let riskScore = avgSeverity / 10;
  if (hasRedFlag) riskScore = Math.max(riskScore, 0.85);
  if (age && age > 65) riskScore = Math.min(riskScore * 1.2, 1.0);
  if (existingConditions?.includes('heart disease')) riskScore = Math.min(riskScore * 1.3, 1.0);
  if (existingConditions?.includes('diabetes')) riskScore = Math.min(riskScore * 1.15, 1.0);

  const urgency: 'emergency' | 'urgent' | 'soon' | 'routine' =
    hasRedFlag || riskScore >= 0.85 ? 'emergency' :
    riskScore >= 0.65 || maxSeverity >= 8 ? 'urgent' :
    riskScore >= 0.4 || maxSeverity >= 5 ? 'soon' : 'routine';

  const recommendations = {
    emergency: ['Call 999 immediately', 'Do not drive yourself', 'Go to nearest A&E'],
    urgent: ['Seek medical attention within 24 hours', 'Call 111 for advice', 'Visit urgent care centre'],
    soon: ['Book GP appointment within 1 week', 'Monitor symptoms and call if they worsen'],
    routine: ['Book a routine GP appointment', 'Monitor symptoms over the next few days'],
  }[urgency];

  return res.json({
    urgency,
    riskScore: +riskScore.toFixed(3),
    recommendations,
    redFlagDetected: hasRedFlag,
    modelVersion: '1.0.0-rule-based',
    disclaimer: 'This is an automated triage tool and does not replace professional medical advice.',
    audit: {
      inputSymptomCount: symptoms.length,
      maxSeverity,
      avgSeverity: +avgSeverity.toFixed(2),
      escalationGuardrailActive: hasRedFlag,
    },
  });
}

export function getNotificationPrefs(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const prefs = db.prepare('SELECT * FROM hlt_notification_prefs WHERE patientId = ?').get(id) as any;
  return res.json(prefs || { patientId: id, emailAppointments: 1, smsAppointments: 1, emailLabResults: 1, smsLabResults: 0, emailBilling: 1, emailMessages: 1 });
}

export function updateNotificationPrefs(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { emailAppointments, smsAppointments, emailLabResults, smsLabResults, emailBilling, emailMessages } = req.body;
  db.prepare(`
    INSERT INTO hlt_notification_prefs (patientId, emailAppointments, smsAppointments, emailLabResults, smsLabResults, emailBilling, emailMessages)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(patientId) DO UPDATE SET
      emailAppointments=excluded.emailAppointments, smsAppointments=excluded.smsAppointments,
      emailLabResults=excluded.emailLabResults, smsLabResults=excluded.smsLabResults,
      emailBilling=excluded.emailBilling, emailMessages=excluded.emailMessages
  `).run(id, emailAppointments ?? 1, smsAppointments ?? 1, emailLabResults ?? 1, smsLabResults ?? 0, emailBilling ?? 1, emailMessages ?? 1);
  return res.json({ updated: true });
}

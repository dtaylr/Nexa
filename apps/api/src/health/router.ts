import { Router } from 'express';
import { getPatient, getPatientRecords, getMyPatient } from './patients';
import { getAppointments, createAppointment, cancelAppointment } from './appointments';
import { getMedications } from './medications';
import { authenticate } from '../middleware/auth';

export const healthRouter = Router();

healthRouter.use(authenticate);

healthRouter.get('/patients/me', getMyPatient);
healthRouter.get('/patients/:id', getPatient);
healthRouter.get('/patients/:id/records', getPatientRecords);
healthRouter.get('/patients/:id/appointments', getAppointments);
healthRouter.post('/appointments', createAppointment);
healthRouter.put('/appointments/:id/cancel', cancelAppointment);
healthRouter.get('/patients/:id/medications', getMedications);

import { Router } from 'express';
import { resetAndReseed } from './reset';

export const adminRouter = Router();

adminRouter.post('/reset', resetAndReseed);

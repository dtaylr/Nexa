import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import './db';
import { financeRouter } from './finance/router';
import { healthRouter } from './health/router';
import { commerceRouter } from './commerce/router';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authRouter } from './auth/router';
import { adminRouter } from './admin/router';

export const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : (origin, cb) => {
        // Allow any localhost port in dev; CORS_ORIGIN controls prod
        if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
      },
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/BrightBank', financeRouter);
app.use('/api/HealthyU', healthRouter);
app.use('/api/commerce', commerceRouter);

app.use(notFound);
app.use(errorHandler);

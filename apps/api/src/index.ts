import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import './db';
import { financeRouter } from './finance/router';
import { healthRouter } from './health/router';
import { commerceRouter } from './commerce/router';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authRouter } from './auth/router';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/finance', financeRouter);
app.use('/api/health', healthRouter);
app.use('/api/commerce', commerceRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`NexaCore API running on port ${PORT}`);
});

export { app };

import { Router } from 'express';
import { getAccounts, getAccount, getAccountTransactions } from './accounts';
import { createTransfer, getTransferAudit } from './transfers';
import { getMonthlySummary } from './reports';
import { authenticate } from '../middleware/auth';

export const financeRouter = Router();

financeRouter.use(authenticate);

financeRouter.get('/accounts', getAccounts);
financeRouter.get('/accounts/:id', getAccount);
financeRouter.get('/accounts/:id/transactions', getAccountTransactions);
financeRouter.post('/transfers', createTransfer);
financeRouter.get('/transfers/:id/audit', getTransferAudit);
financeRouter.get('/reports/monthly-summary', getMonthlySummary);

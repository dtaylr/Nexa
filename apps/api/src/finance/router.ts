import { Router } from 'express';
import { getAccounts, getAccount, getAccountTransactions, lookupAccount } from './accounts';
import { createTransfer, getTransferAudit } from './transfers';
import { getMonthlySummary } from './reports';
import { getCards, issueCard, freezeCard, cancelCard } from './cards';
import { getBeneficiaries, addBeneficiary, deleteBeneficiary } from './beneficiaries';
import { getStatement, getStatementCsv } from './statements';
import { getFraudEvents, resolveFraudEvent } from './fraud';
import { authenticate } from '../middleware/auth';

export const financeRouter = Router();

financeRouter.use(authenticate);

financeRouter.get('/accounts', getAccounts);
financeRouter.get('/accounts/lookup', lookupAccount);
financeRouter.get('/accounts/:id', getAccount);
financeRouter.get('/accounts/:id/transactions', getAccountTransactions);
financeRouter.get('/accounts/:accountId/statement', getStatement);
financeRouter.get('/accounts/:accountId/statement/csv', getStatementCsv);
financeRouter.post('/transfers', createTransfer);
financeRouter.get('/transfers/:id/audit', getTransferAudit);
financeRouter.get('/reports/monthly-summary', getMonthlySummary);
financeRouter.get('/cards', getCards);
financeRouter.post('/cards', issueCard);
financeRouter.put('/cards/:id/freeze', freezeCard);
financeRouter.delete('/cards/:id', cancelCard);
financeRouter.get('/beneficiaries', getBeneficiaries);
financeRouter.post('/beneficiaries', addBeneficiary);
financeRouter.delete('/beneficiaries/:id', deleteBeneficiary);
financeRouter.get('/fraud-events', getFraudEvents);
financeRouter.put('/fraud-events/:id/resolve', resolveFraudEvent);

import { Router } from 'express';
import { auth, validateRequest } from '../../middlewares';
import { RoundUpTransactionController } from './roundUpTransaction.controller';
import { ROUNDUP_VALIDATION } from './roundUpTransaction.validation';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// Get all round-up transactions for the authenticated user
router.get(
  '/',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  ROUNDUP_VALIDATION.getTransactionsQuery,
  RoundUpTransactionController.getUserTransactions
);

// Get transaction summary for authenticated user
router.get(
  '/summary',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  RoundUpTransactionController.getTransactionSummary
);

// Create round-up transactions from synced bank transactions
router.post(
  '/create-from-sync',
  auth(ROLE.CLIENT),
  ROUNDUP_VALIDATION.createFromSync,
  RoundUpTransactionController.createFromBankSync
);

// Process unprocessed transactions into donation
router.post(
  '/process',
  auth(ROLE.CLIENT),
  ROUNDUP_VALIDATION.processTransactions,
  RoundUpTransactionController.processUnprocessedTransactions
);

// Get monthly breakdown
router.get(
  '/monthly',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  RoundUpTransactionController.getMonthlyBreakdown
);

// Get category breakdown
router.get(
  '/categories',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  RoundUpTransactionController.getCategoryBreakdown
);

// Get specific transaction
router.get(
  '/:id',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  ROUNDUP_VALIDATION.getTransactionById,
  RoundUpTransactionController.getTransactionById
);

// Mark transaction as processed
router.post(
  '/:id/process',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  ROUNDUP_VALIDATION.markProcessed,
  RoundUpTransactionController.markTransactionAsProcessed
);

// Delete transaction (admin only)
router.delete(
  '/:id',
  auth(ROLE.ADMIN),
  ROUNDUP_VALIDATION.getTransactionById,
  RoundUpTransactionController.deleteTransaction
);

export { router as RoundUpTransactionRoutes };

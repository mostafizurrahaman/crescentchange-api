import { Router } from 'express';

import { validateRequest } from '../../middlewares/validateRequest';
import {
  transactionFilterValidation,
  transactionIdParamValidation,
  eligibleTransactionsValidation,
  retryFailedValidation,
} from './roundUpTransaction.validation';
import { roundUpTransactionController } from './roundUpTransaction.controller';
import { auth } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// USER ENDPOINTS (CLIENT role required)

// Get transaction summary (user)
router.get(
  '/summary',
  auth(ROLE.CLIENT),
  roundUpTransactionController.getTransactionSummary
);

// Get user transactions with filtering and pagination
router.get(
  '/',
  auth(ROLE.CLIENT),
  validateRequest(transactionFilterValidation),
  roundUpTransactionController.getTransactions
);

// Get specific transaction details
router.get(
  '/:transactionId',
  auth(ROLE.CLIENT),
  validateRequest(transactionIdParamValidation),
  roundUpTransactionController.getTransactionDetails
);

// ADMIN ENDPOINTS (ADMIN role required)

// Get eligible transactions for admin analysis
router.get(
  '/admin/eligible',
  auth(ROLE.ADMIN),
  validateRequest(eligibleTransactionsValidation),
  roundUpTransactionController.getEligibleTransactions
);

// Get transactions currently being processed (monitoring webhook states)
router.get(
  '/admin/processing',
  auth(ROLE.ADMIN),
  roundUpTransactionController.getProcessingTransactions
);

// Retry failed transactions
router.post(
  '/admin/retry-failed',
  auth(ROLE.ADMIN),
  validateRequest(retryFailedValidation),
  roundUpTransactionController.retryFailedTransactions
);

/**
 * RoundUp Transaction Routes - Webhook-Based Transaction Management
 * 
 * USER ENDPOINTS (CLIENT role required):
 * - GET /summary - Get user's RoundUp transaction summary
 * - GET / - Get user transactions with filtering and pagination
 * - GET /:transactionId - Get specific transaction details
 * 
 * ADMIN ENDPOINTS (ADMIN role required):
 * - GET /admin/eligible - Get eligible transactions for date range analysis
 * - GET /admin/processing - Monitor transactions currently processing (webhook states)
 * - POST /admin/retry-failed - Retry failed transactions
 * 
 * AUTHENTICATION:
 * - Each route has individual role-based authentication
 * - USER endpoints: CLIENT role required + JWT verification
 * - ADMIN endpoints: ADMIN role required + JWT verification
 * - Transaction access is user-scoped by userId filtering in controllers
 * - Auth middleware verifies token, user exists, OTP verification, password security
 * 
 * QUERY PARAMETERS:
 * - status: pending, processed, processing, donated, failed
 * - bankConnection: Filter by bank connection
 * - organization: Filter by charity/organization
 * - startDate/endDate: Date range filtering
 * - month/year: Monthly filtering (1-12, year)
 * - page/limit: Pagination (defaults: page=1, limit=50)
 * 
 * NOTES:
 * - Supports all webhook-based transaction states
 * - Real-time monitoring of 'processing' status transactions
 * - Comprehensive filtering and pagination
 * - Admin monitoring for webhook state transitions
 * - User can only access their own transactions
 */
export const roundUpTransactionRoutes = router;

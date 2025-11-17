import { Router } from 'express';

import { validateRequest } from '../../middlewares/validateRequest';
import {
  savePlaidConsentValidation,
  processMonthlyDonationValidation,
  switchCharityValidation,
  syncTransactionsValidation,
  bankConnectionIdParamValidation,
  transactionIdParamValidation,
  resumeRoundUpValidation,
  testRoundUpProcessingCronValidation,
} from './roundUp.validation';
import { roundUpController } from './secureRoundUp.controller';
import { auth } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';

/**
 * RoundUp Routes - Webhook-Based System
 *
 * USER ENDPOINTS (CLIENT role required):
 * - POST /consent/save - Create RoundUp configuration
 * - POST /consent/revoke/:bankConnectionId - Revoke and disconnect
 * - POST /transactions/sync/:bankConnectionId - Sync transactions only (no processing)
 * - POST /process-monthly-donation - Manual donation trigger (webhook-based)
 * - POST /resume - Resume paused RoundUp
 * - POST /charity/switch - Switch charity (30-day rule)
 * - GET /dashboard - User dashboard viewing
 * - GET /transaction/:transactionId - Get transaction details
 *
 * ADMIN ENDPOINTS (ADMIN role required):
 * - POST /test-cron-processing - Manual cron testing (webhook-based)
 * - GET /admin/dashboard - System-wide admin dashboard
 *
 * AUTHENTICATION:
 * - Each route has individual role-based authentication
 * - USER endpoints: CLIENT role required + JWT verification
 * - ADMIN endpoints: ADMIN role required + JWT verification
 * - Auth middleware verifies token, user exists, OTP verification, password security
 * - CLIENT users can proceed without admin approval (just OTP verification)
 * - ORGANIZATION/BUSINESS users need admin profile activation
 * - ADMIN users need active status
 *
 * NOTES:
 * - All donation processing now uses webhook-based payment intents
 * - No more immediate 'donated' status - uses 'processing' → webhook → 'donated'
 * - Automatic processing via cron job every 4 hours
 * - Manual sync endpoint only syncs transactions (no processing)
 */

const router = Router();

// USER ENDPOINTS (CLIENT role required)

// Save Plaid consent and create round-up configuration
router.post(
  '/consent/save',
  auth(ROLE.CLIENT),
  validateRequest(savePlaidConsentValidation),
  roundUpController.savePlaidConsent
);

// Revoke consent and disconnect
router.post(
  '/consent/revoke/:bankConnectionId',
  auth(ROLE.CLIENT),
  validateRequest(bankConnectionIdParamValidation),
  roundUpController.revokeConsent
);

// Sync transactions (NOTE: RoundUp processing is now automatic via cron job)
router.post(
  '/transactions/sync/:bankConnectionId',
  auth(ROLE.CLIENT),
  validateRequest(bankConnectionIdParamValidation),
  validateRequest(syncTransactionsValidation),
  roundUpController.syncTransactions
);

// Manual donation trigger (before threshold reached - webhook-based)
router.post(
  '/process-monthly-donation',
  auth(ROLE.CLIENT),
  validateRequest(processMonthlyDonationValidation),
  roundUpController.processMonthlyDonation
);

// Resume/unpause round-up
router.post(
  '/resume',
  auth(ROLE.CLIENT),
  validateRequest(resumeRoundUpValidation),
  roundUpController.resumeRoundUp
);

// Switch charity with 30-day validation
router.post(
  '/charity/switch',
  auth(ROLE.CLIENT),
  validateRequest(switchCharityValidation),
  roundUpController.switchCharity
);

// Get user dashboard
router.get('/dashboard', auth(ROLE.CLIENT), roundUpController.getUserDashboard);

// Get transaction details
router.get(
  '/transaction/:transactionId',
  auth(ROLE.CLIENT),
  validateRequest(transactionIdParamValidation),
  roundUpController.getTransactionDetails
);

// ADMIN ENDPOINTS (ADMIN role required)

// Manual test endpoint for RoundUp processing cron
router.post(
  '/test-cron-processing',
  auth(ROLE.ADMIN),
  validateRequest(testRoundUpProcessingCronValidation),
  roundUpController.testRoundUpProcessingCron
);

// Get admin dashboard
router.get(
  '/admin/dashboard',
  auth(ROLE.ADMIN),
  roundUpController.getAdminDashboard
);

export const SecureRoundUpRoutes = router;

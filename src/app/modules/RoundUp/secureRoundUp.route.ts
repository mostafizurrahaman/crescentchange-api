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
} from './roundUp.validation';
import { roundUpController } from './secureRoundUp.controller';
import { auth } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';
import Auth from '../Auth/auth.model';

const router = Router();

// Apply authentication middleware
router.use(auth(ROLE.CLIENT));

// Save Plaid consent and create round-up configuration
router.post(
  '/consent/save',
  validateRequest(savePlaidConsentValidation),
  roundUpController.savePlaidConsent
);

// Revoke consent and disconnect
router.post(
  '/consent/revoke/:bankConnectionId',
  validateRequest(bankConnectionIdParamValidation),
  roundUpController.revokeConsent
);

// Sync transactions and process round-ups
router.post(
  '/transactions/sync/:bankConnectionId',
  validateRequest(bankConnectionIdParamValidation),
  validateRequest(syncTransactionsValidation),
  roundUpController.syncTransactions
);

// Process monthly donation (end of month)
router.post(
  '/process-monthly-donation',
  validateRequest(processMonthlyDonationValidation),
  roundUpController.processMonthlyDonation
);

// Resume/unpause round-up
router.post(
  '/resume',
  validateRequest(resumeRoundUpValidation),
  roundUpController.resumeRoundUp
);

// Switch charity with 30-day validation
router.post(
  '/charity/switch',
  validateRequest(switchCharityValidation),
  roundUpController.switchCharity
);

// Get user dashboard
router.get('/dashboard', auth(ROLE.ADMIN), roundUpController.getUserDashboard);

// Get transaction details
router.get(
  '/transaction/:transactionId',
  validateRequest(transactionIdParamValidation),
  roundUpController.getTransactionDetails
);

// Get admin dashboard
router.get('/admin/dashboard', roundUpController.getAdminDashboard);

export const SecureRoundUpRoutes = router;

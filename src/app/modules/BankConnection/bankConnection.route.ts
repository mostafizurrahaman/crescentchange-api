import { Router } from 'express';
import { validateRequest } from '../../middlewares/validateRequest';
import {
  createBankConnectionValidation,
  linkTokenRequestValidation,
  syncTransactionsValidation,
  updateBankConnectionValidation,
} from './bankConnection.validation';
import { bankConnectionController } from './bankConnection.controller';
import { auth } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// Apply authentication middleware
router.use(auth(ROLE.CLIENT));

// Generate Plaid Link token
router.post(
  '/link-token',
  // validateRequest(linkTokenRequestValidation),
  bankConnectionController.generateLinkToken
);

// Create bank connection (exchange public token)
router.post(
  '/',
  // validateRequest(createBankConnectionValidation),
  bankConnectionController.createBankConnection
);

// Get user's bank connection
router.get('/me', bankConnectionController.getUserBankConnection);

// Sync transactions
router.post(
  '/:bankConnectionId/sync',
  // validateRequest(syncTransactionsValidation),
  bankConnectionController.syncTransactions
);

// Get transactions for date range
router.get(
  '/:bankConnectionId/transactions',
  bankConnectionController.getTransactions
);

// Update bank connection
router.patch(
  '/:bankConnectionId',
  validateRequest(updateBankConnectionValidation),
  bankConnectionController.updateBankConnection
);

// Revoke consent and disconnect
router.post(
  '/:bankConnectionId/revoke',
  bankConnectionController.revokeConsent
);

// Plaid webhook (no auth required)
router.post('/webhook', bankConnectionController.handleWebhook);

export const BankConnectionRoutes = router;

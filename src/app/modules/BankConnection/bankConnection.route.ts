import { Router } from 'express';
import { auth, validateWebhookSignature } from '../../middlewares';
import { BankConnectionController } from './bankConnection.controller';
import { BANK_CONNECTION_VALIDATION } from './bankConnection.validation';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// Create Link token
router.post(
  '/link-token',
  auth(ROLE.CLIENT),
  BankConnectionController.createLinkToken
);

// Exchange public token and create bank connection
router.post(
  '/connect',
  auth(ROLE.CLIENT),
  BANK_CONNECTION_VALIDATION.connectBank,
  BankConnectionController.connectBank
);

// Get all user bank connections
router.get(
  '/',
  auth(ROLE.CLIENT),
  BankConnectionController.getUserConnections
);

// Get connection status
router.get(
  '/:id/status',
  auth(ROLE.CLIENT),
  BankConnectionController.getConnectionStatus
);

// Get specific bank connection
router.get(
  '/:id',
  auth(ROLE.CLIENT),
  BankConnectionController.getConnectionById
);

// Sync transactions for a connection
router.post(
  '/:id/sync',
  auth(ROLE.CLIENT),
  BankConnectionController.syncTransactions
);

// Handle Plaid webhooks (no auth required - Plaid authenticates via signature)
router.post(
  '/webhook',
  validateWebhookSignature('plaid'),
  BankConnectionController.handleWebhook
);

// Delete bank connection
router.delete(
  '/:id',
  auth(ROLE.CLIENT),
  BankConnectionController.deleteConnection
);

export { router as BankConnectionRoutes };

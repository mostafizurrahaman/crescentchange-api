import { Router } from 'express';
import { DonationController } from './donation.controller';
import { DonationValidation } from './donation.validation';
import { auth, validateRequest } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// Public webhook endpoint (no authentication required)
router.post('/webhook', DonationController.handleStripeWebhook);

// All other routes require authentication
router.use(auth());

// Create donation (client only)
router.post(
  '/',
  auth(ROLE.CLIENT),
  validateRequest(DonationValidation.createDonationSchema),
  DonationController.createDonation
);

// Create payment intent directly (alternative endpoint)
router.post(
  '/payment-intent',
  auth(ROLE.CLIENT),
  DonationController.createPaymentIntent
);

// Get all donations with filtering
router.get(
  '/',
  validateRequest(DonationValidation.getDonationsQuerySchema),
  DonationController.getDonations
);

// Get donation by ID
router.get(
  '/:id',
  validateRequest(DonationValidation.getDonationByIdSchema),
  DonationController.getDonationById
);

// Get user donations (admin or the user themselves)
router.get(
  '/user/:userId',
  auth(ROLE.ADMIN, ROLE.CLIENT),
  validateRequest(DonationValidation.getUserDonationsSchema),
  DonationController.getUserDonations
);

// Get organization donations (admin or the organization themselves)
router.get(
  '/organization/:organizationId',
  auth(ROLE.ADMIN, ROLE.ORGANIZATION),
  validateRequest(DonationValidation.getOrganizationDonationsSchema),
  DonationController.getOrganizationDonations
);

// Process refund (organization only)
router.post(
  '/:id/refund',
  auth(ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(DonationValidation.processRefundSchema),
  DonationController.processRefund
);

// Get donation statistics
router.get(
  '/stats/:entity/:id',
  validateRequest(DonationValidation.getDonationStatsSchema),
  DonationController.getDonationStats
);

export const DonationRoutes = router;

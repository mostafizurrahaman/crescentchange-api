import { Router } from 'express';
import { auth } from '../../middlewares';
import { validateRequest } from '../../middlewares/validateRequest';
import { DonationController } from './donation.controller';
import { DonationValidation } from './donation.validation';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// NEW: Create one-time donation with PaymentIntent
router.post(
  '/one-time/create',
  auth(ROLE.CLIENT),
  validateRequest(DonationValidation.createOneTimeDonationSchema),
  DonationController.createOneTimeDonation
);

// 2. Process payment for existing donation
router.post(
  '/:donationId/payment',
  auth(ROLE.CLIENT),
  validateRequest(DonationValidation.processPaymentForDonationSchema),
  DonationController.processPaymentForDonation
);

// 3. Retry failed payment
router.post(
  '/:donationId/retry',
  auth(ROLE.CLIENT),
  validateRequest(DonationValidation.retryFailedPaymentSchema),
  DonationController.retryFailedPayment
);

// 4. Get donation full status with payment info
router.get(
  '/:id/status',
  auth(ROLE.CLIENT, ROLE.ADMIN, ROLE.ORGANIZATION),
  validateRequest(DonationValidation.getDonationByIdSchema),
  DonationController.getDonationFullStatus
);

// EXISTING ENDPOINTS

// Get user donations with pagination and filters
router.get(
  '/user',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  validateRequest(DonationValidation.getUserDonationsSchema),
  DonationController.getUserDonations
);

// Get specific donation by ID (only if user owns it)
router.get(
  '/:id',
  auth(ROLE.ADMIN, ROLE.CLIENT, ROLE.ORGANIZATION),
  validateRequest(DonationValidation.getDonationByIdSchema),
  DonationController.getDonationById
);

// Get donations by organization ID (for organization admin)
router.get(
  '/organization/:organizationId',
  auth(ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(DonationValidation.getOrganizationDonationsSchema),
  DonationController.getOrganizationDonations
);

export default router;

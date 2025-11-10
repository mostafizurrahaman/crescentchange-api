import { Router } from 'express';
import { auth } from '../../middlewares';
import { validateRequest } from '../../middlewares/validateRequest';
import { DonationController } from './donation.controller';
import { DonationValidation } from './donation.validation';

const router = Router();

// Legacy: Create one-time donation (creates donation and processes payment in one step)
router.post(
  '/one-time',
  auth(),
  validateRequest(DonationValidation.createOneTimeDonationSchema),
  DonationController.createOneTimeDonation
);

// NEW API DESIGN - Separated donation creation and payment processing

// 1. Create donation record (separate from payment processing)
router.post(
  '/one-time/without-payment',
  auth(),
  validateRequest(DonationValidation.createDonationRecordSchema),
  DonationController.createDonationRecord
);

// 2. Process payment for existing donation
router.post(
  '/:donationId/payment',
  auth(),
  validateRequest(DonationValidation.processPaymentForDonationSchema),
  DonationController.processPaymentForDonation
);

// 3. Retry failed payment
router.post(
  '/:donationId/retry',
  auth(),
  validateRequest(DonationValidation.retryFailedPaymentSchema),
  DonationController.retryFailedPayment
);

// 4. Get donation full status with payment info
router.get(
  '/:id/status',
  auth(),
  validateRequest(DonationValidation.getDonationByIdSchema),
  DonationController.getDonationFullStatus
);

// EXISTING ENDPOINTS

// Get user donations with pagination and filters
router.get(
  '/user',
  auth(),
  validateRequest(DonationValidation.getUserDonationsSchema),
  DonationController.getUserDonations
);

// Get specific donation by ID (only if user owns it)
router.get(
  '/:id',
  auth(),
  validateRequest(DonationValidation.getDonationByIdSchema),
  DonationController.getDonationById
);

// Get donations by organization ID (for organization admin)
router.get(
  '/organization/:organizationId',
  auth(),
  validateRequest(DonationValidation.getOrganizationDonationsSchema),
  DonationController.getOrganizationDonations
);

export default router;

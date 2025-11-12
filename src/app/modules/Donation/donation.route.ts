import { Router } from 'express';
import { auth } from '../../middlewares';
import { validateRequest } from '../../middlewares/validateRequest';
import { DonationController } from './donation.controller';
import { DonationValidation } from './donation.validation';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// 1. Create one-time donation with PaymentIntent
router.post(
  '/one-time/create',
  auth(ROLE.CLIENT),
  validateRequest(DonationValidation.createOneTimeDonationSchema),
  DonationController.createOneTimeDonation
);

// 2. Retry failed payment
router.post(
  '/:donationId/retry',
  auth(ROLE.CLIENT),
  validateRequest(DonationValidation.retryFailedPaymentSchema),
  DonationController.retryFailedPayment
);

// 3. Get donation full status with payment info
router.get(
  '/:id/status',
  auth(ROLE.CLIENT, ROLE.ADMIN, ROLE.ORGANIZATION),
  validateRequest(DonationValidation.getDonationByIdSchema),
  DonationController.getDonationFullStatus
);

// 4. Get user donations with pagination and filters (QueryBuilder)
router.get(
  '/user',
  auth(ROLE.CLIENT, ROLE.ADMIN),
  validateRequest(DonationValidation.getUserDonationsSchema),
  DonationController.getUserDonations
);

// 5. Get specific donation by ID (only if user owns it)
router.get(
  '/:id',
  auth(ROLE.ADMIN, ROLE.CLIENT, ROLE.ORGANIZATION),
  validateRequest(DonationValidation.getDonationByIdSchema),
  DonationController.getDonationById
);

// 6. Get donations by organization ID (QueryBuilder)
router.get(
  '/organization/:organizationId',
  auth(ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(DonationValidation.getOrganizationDonationsSchema),
  DonationController.getOrganizationDonations
);

export default router;

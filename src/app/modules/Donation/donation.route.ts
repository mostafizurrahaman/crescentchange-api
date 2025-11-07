import { Router } from 'express';
import { auth, validateRequest } from '../../middlewares';
import { DonationValidation } from './donation.validation';
import { DonationController } from './donation.controller';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// Create donation (CLIENT only)
router
  .route('/')
  .post(
    auth(ROLE.CLIENT),
    validateRequest(DonationValidation.createDonationSchema),
    DonationController.createDonation
  )
  .get(
    auth(ROLE.CLIENT, ROLE.ORGANIZATION, ROLE.ADMIN),
    validateRequest(DonationValidation.getDonationsQuerySchema),
    DonationController.getDonations
  );

// Get donation statistics
router
  .route('/statistics')
  .get(
    auth(ROLE.CLIENT, ROLE.ORGANIZATION, ROLE.ADMIN),
    validateRequest(DonationValidation.getDonationsQuerySchema),
    DonationController.getDonationStatistics
  );

// Get donation by ID
router
  .route('/:id')
  .get(
    auth(ROLE.CLIENT, ROLE.ORGANIZATION, ROLE.ADMIN),
    validateRequest(DonationValidation.getDonationByIdSchema),
    DonationController.getDonationById
  )
  .patch(
    auth(ROLE.ADMIN, ROLE.ORGANIZATION),
    validateRequest(DonationValidation.updateDonationSchema),
    DonationController.updateDonation
  )
  .delete(
    auth(ROLE.ADMIN),
    validateRequest(DonationValidation.getDonationByIdSchema),
    DonationController.deleteDonation
  );

// Update donation status
router
  .route('/:id/status')
  .patch(
    auth(ROLE.ADMIN, ROLE.ORGANIZATION),
    validateRequest(DonationValidation.updateDonationStatusSchema),
    DonationController.updateDonationStatus
  );

export const DonationRoutes = router;

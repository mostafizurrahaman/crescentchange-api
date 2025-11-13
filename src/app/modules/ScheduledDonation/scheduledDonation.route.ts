import { Router } from 'express';
import { auth } from '../../middlewares';
import { validateRequest } from '../../middlewares/validateRequest';
import { ScheduledDonationController } from './scheduledDonation.controller';
import { ScheduledDonationValidation } from './scheduledDonation.validation';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// 1. Create scheduled donation (recurring donation)
router.post(
  '/create',
  auth(ROLE.CLIENT),
  validateRequest(ScheduledDonationValidation.createScheduledDonationSchema),
  ScheduledDonationController.createScheduledDonation
);

// 2. Get user's scheduled donations with filters
router.get(
  '/user',
  auth(ROLE.CLIENT),
  validateRequest(ScheduledDonationValidation.getUserScheduledDonationsSchema),
  ScheduledDonationController.getUserScheduledDonations
);

// 3. Get specific scheduled donation by ID
router.get(
  '/:id',
  auth(ROLE.CLIENT),
  validateRequest(ScheduledDonationValidation.getScheduledDonationByIdSchema),
  ScheduledDonationController.getScheduledDonationById
);

// 4. Update scheduled donation
router.patch(
  '/:id',
  auth(ROLE.CLIENT),
  validateRequest(ScheduledDonationValidation.updateScheduledDonationSchema),
  ScheduledDonationController.updateScheduledDonation
);

// 5. Pause scheduled donation
router.post(
  '/:id/pause',
  auth(ROLE.CLIENT),
  validateRequest(ScheduledDonationValidation.toggleScheduledDonationSchema),
  ScheduledDonationController.pauseScheduledDonation
);

// 6. Resume scheduled donation
router.post(
  '/:id/resume',
  auth(ROLE.CLIENT),
  validateRequest(ScheduledDonationValidation.toggleScheduledDonationSchema),
  ScheduledDonationController.resumeScheduledDonation
);

// 7. Cancel (delete) scheduled donation
router.delete(
  '/:id',
  auth(ROLE.CLIENT),
  validateRequest(ScheduledDonationValidation.cancelScheduledDonationSchema),
  ScheduledDonationController.cancelScheduledDonation
);

export default router;

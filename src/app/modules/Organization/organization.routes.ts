import express from 'express';
import { OrganizationController } from './organization.controller';
import auth from '../../middlewares/auth';
import { ROLE } from '../Auth/auth.constant';

const router = express.Router();

// Stripe Connect Routes
// Start Stripe Connect onboarding (organizations only)
router.post(
  '/stripe-connect/onboard',
  auth(ROLE.ORGANIZATION),
  OrganizationController.startStripeConnectOnboarding
);

// Get Stripe Connect account status (organizations only)
router.get(
  '/stripe-connect/status',
  auth(ROLE.ORGANIZATION),
  OrganizationController.getStripeConnectStatus
);

// Refresh onboarding link (organizations only)
router.post(
  '/stripe-connect/refresh',
  auth(ROLE.ORGANIZATION),
  OrganizationController.refreshStripeConnectOnboarding
);

export const OrganizationRoutes = router;
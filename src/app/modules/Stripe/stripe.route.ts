import { Router } from 'express';
import { auth } from '../../middlewares';
import { validateRequest } from '../../middlewares/validateRequest';
import { StripeController } from './stripe.controller';
import { StripeValidation } from './stripe.validation';

const router = Router();

// Create checkout session (requires authentication)
router.post(
  '/checkout-session',
  auth(),
  validateRequest(StripeValidation.createCheckoutSessionSchema),
  StripeController.createCheckoutSession
);

// Retrieve checkout session details (requires authentication)
router.get(
  '/checkout-session/:sessionId',
  auth(),
  StripeController.retrieveCheckoutSession
);

// Create refund for payment (requires authentication)
router.post(
  '/refund',
  auth(),
  StripeController.createRefund
);

export default router;

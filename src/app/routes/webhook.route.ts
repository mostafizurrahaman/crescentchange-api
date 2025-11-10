import { Router } from 'express';
import { handleStripeWebhook } from '../utils/stripeWebhookHandler';

const router = Router();

// Stripe webhook endpoint - needs raw body for signature verification
router.post('/stripe', handleStripeWebhook);

export default router;

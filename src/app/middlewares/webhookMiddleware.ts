import { Response, NextFunction } from 'express';
import { verifyPlaidWebhook } from '../config/plaid';
import { IWebhookRequest } from '../types/webhook.types';

/**
 * Middleware to verify webhook signatures
 */
interface VerifyWebhookOptions {
  service: 'plaid'; // Can be extended for other webhook services
}

export const validateWebhookSignature = (
  service: VerifyWebhookOptions['service']
) => {
  return (req: IWebhookRequest, res: Response, next: NextFunction) => {
    // Get the webhook signature from request headers
    const signature = req.headers['plaid-signature'] as string;

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Webhook signature is missing',
      });
    }

    let isValid = false;

    // Verify based on the specified service
    switch (service) {
      case 'plaid':
        isValid = verifyPlaidWebhook(signature, JSON.stringify(req.body));
        break;

      // Add other webhook services here
      default:
        break;
    }

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    // Add verified webhook data to request for downstream handlers
    req.webhookVerified = true;
    next();
  };
};

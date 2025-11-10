import { Request, Response } from 'express';
import { stripe, STRIPE_EVENTS } from '../lib/stripeHelper';
import { DonationService } from '../modules/donation/donation.service';
import config from '../config';
import logger from './logger';

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  
  if (!sig) {
    logger.error('No Stripe signature found');
    return res.status(400).send('Webhook signature missing');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info(`Received Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case STRIPE_EVENTS.CHECKOUT_SESSION_COMPLETED: {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case STRIPE_EVENTS.PAYMENT_INTENT_FAILED: {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case STRIPE_EVENTS.PAYMENT_INTENT_CANCELED: {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentCanceled(paymentIntent);
        break;
      }

      default:
        logger.log(`Unhandled event type: ${event.type}`);
        return res.status(200).send('Event received');
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error(`Error processing webhook: ${error.message}`);
    res.status(500).send('Webhook processing failed');
  }
};

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const donationId = session.metadata?.donationId;
  
  if (!donationId) {
    logger.error('No donation ID found in session metadata');
    return;
  }

  try {
    // Update donation status to completed
    const updatedDonation = await DonationService.updateDonationStatus(
      donationId,
      'completed',
      session.payment_intent as string,
      session.customer as string
    );

    if (!updatedDonation) {
      logger.error(`Failed to update donation ${donationId}`);
      return;
    }

    logger.info(`Donation ${donationId} completed successfully`);

    // TODO: Send donation receipt email
    // TODO: Update user points
    // TODO: Send notifications if needed
  } catch (error: any) {
    logger.error(`Error updating donation ${donationId}: ${error.message}`);
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  
  try {
    const donation = await DonationService.updateDonationStatusByPaymentIntent(
      paymentIntentId,
      'failed'
    );

    if (donation) {
      logger.info(`Donation with payment intent ${paymentIntentId} marked as failed`);
    } else {
      logger.error(`No donation found for payment intent ${paymentIntentId}`);
    }
  } catch (error: any) {
    logger.error(`Error handling payment intent failure: ${error.message}`);
    throw error;
  }
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  
  try {
    const donation = await DonationService.updateDonationStatusByPaymentIntent(
      paymentIntentId,
      'failed'
    );

    if (donation) {
      logger.info(`Donation with payment intent ${paymentIntentId} marked as canceled`);
    } else {
      logger.error(`No donation found for payment intent ${paymentIntentId}`);
    }
  } catch (error: any) {
    logger.error(`Error handling payment intent cancellation: ${error.message}`);
    throw error;
  }
}

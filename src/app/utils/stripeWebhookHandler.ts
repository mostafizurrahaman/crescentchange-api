import { Request, Response } from 'express';
import { stripe, STRIPE_EVENTS } from '../lib/stripeHelper';
import { DonationService } from '../modules/donation/donation.service';
import config from '../config';

// Simple logger replacement
const logger = {
  error: (message: string) => console.error(message),
  info: (message: string) => console.log(message),
  log: (message: string) => console.log(message),
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  
  if (!sig) {
    logger.error('No Stripe signature found');
    return res.status(400).send('Webhook signature missing');
  }

  let event: any; // Stripe.Event

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
        const session = event.data.object; // as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case STRIPE_EVENTS.PAYMENT_INTENT_SUCCEEDED: {
        const paymentIntent = event.data.object; // as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case STRIPE_EVENTS.PAYMENT_INTENT_FAILED: {
        const paymentIntent = event.data.object; // as Stripe.PaymentIntent
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case STRIPE_EVENTS.PAYMENT_INTENT_CANCELED: {
        const paymentIntent = event.data.object; // as Stripe.PaymentIntent
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

async function handleCheckoutSessionCompleted(session: any) { // Stripe.Checkout.Session
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

async function handlePaymentIntentSucceeded(paymentIntent: any) { // Stripe.PaymentIntent
  const { metadata } = paymentIntent;
  
  if (!metadata?.donorId || !metadata?.organizationId) {
    logger.error('Missing required metadata in payment_intent.succeeded');
    return;
  }

  try {
    // Find donation by payment intent ID
    const donation = await DonationService.findDonationByPaymentIntentId(paymentIntent.id);
    
    if (!donation) {
      logger.error(`No donation found for payment intent ${paymentIntent.id}`);
      return;
    }

    // Update donation status using the service method
    const updatedDonation = await DonationService.updateDonationStatus(
      (donation as any)._id?.toString() || (donation as any).id?.toString(),
      'completed',
      paymentIntent.id,
      undefined // customer ID
    );

    if (!updatedDonation) {
      logger.error(`Failed to update donation for payment intent ${paymentIntent.id}`);
      return;
    }

    logger.info(`Payment intent ${paymentIntent.id} marked as completed`);

    // TODO: Send donation receipt email
    // TODO: Update user points
    // TODO: Send notifications if needed
  } catch (error: any) {
    logger.error(`Error handling payment intent success: ${error.message}`);
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent: any) { // Stripe.PaymentIntent
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

async function handlePaymentIntentCanceled(paymentIntent: any) { // Stripe.PaymentIntent
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

/* eslint-disable no-console */
import { Response } from 'express';
import { Stripe } from 'stripe';
import { sendResponse, AppError } from '../../utils';
import httpStatus from 'http-status';
import { Donation } from './donation.model';
import { StripeService } from '../Stripe/stripe.service';
import { ExtendedRequest } from '../../types';
import { Types } from 'mongoose';

// Handle checkout.session.completed event
const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session
) => {
  const { metadata } = session;

  console.log({ sessionMetadata: metadata });

  // Update donation with payment intent ID from the completed session
  if (session.payment_intent && metadata?.donationId) {
    try {
      const donation = await Donation.findOneAndUpdate(
        {
          _id: new Types.ObjectId(metadata.donationId),
          status: { $in: ['pending'] },
        },
        {
          stripePaymentIntentId: session.payment_intent as string,
          status: 'processing', // Now processing payment
        }
      );

      if (!donation) {
        console.error(
          'Could not find donation to update with payment intent ID'
        );
        return;
      }

      console.log(
        `Donation ${metadata.donationId} updated with payment intent ID: ${session.payment_intent}`
      );
    } catch (error) {
      console.error(`Failed to update donation with payment intent ID:`, error);
    }
  }
};

// Handle payment_intent.succeeded event
const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  const { metadata } = paymentIntent;

  console.log({ metadata });

  // First try to find donation by paymentIntentId
  try {
    const donation = await Donation.findOneAndUpdate(
      {
        stripePaymentIntentId: paymentIntent.id,
        status: { $in: ['pending', 'processing'] },
      },
      {
        status: 'completed',
        stripeChargeId: paymentIntent.latest_charge as string,
      }
    );

    console.log({ donation });

    if (!donation && metadata?.donationId) {
      // Fallback: try to find by MongoDB ID from metadata and update with paymentIntentId
      console.log(
        'Trying fallback: updating donation by donationId from metadata'
      );
      const fallbackUpdate = await Donation.findOneAndUpdate(
        {
          _id: new Types.ObjectId(metadata.donationId),
          status: { $in: ['pending', 'processing'] },
        },
        {
          status: 'completed',
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId: paymentIntent.latest_charge as string,
        }
      );

      if (!fallbackUpdate) {
        console.error(
          'Could not find donation to update for payment_intent.succeeded'
        );
        return;
      }
    } else if (!donation) {
      console.error(
        'Could not find donation to update for payment_intent.succeeded (no metadata)'
      );
      return;
    }

    console.log(`Payment intent ${paymentIntent.id} marked as completed`);
  } catch (error) {
    console.error(
      `Failed to update donation for payment intent ${paymentIntent.id}:`,
      error
    );
  }
};

// Handle payment_intent.payment_failed event
const handlePaymentIntentFailed = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  const { metadata } = paymentIntent;

  // First try to find donation by paymentIntentId
  try {
    const donation = await Donation.findOneAndUpdate(
      {
        stripePaymentIntentId: paymentIntent.id,
        status: { $in: ['pending', 'processing'] },
      },
      {
        status: 'failed',
        $inc: { paymentAttempts: 1 },
        lastPaymentAttempt: new Date(),
      }
    );

    if (!donation && metadata?.donationId) {
      // Fallback: try to find by MongoDB ID from metadata and update with paymentIntentId
      console.log(
        'Trying fallback: updating donation by donationId from metadata'
      );
      const fallbackUpdate = await Donation.findOneAndUpdate(
        {
          _id: new Types.ObjectId(metadata.donationId),
          status: { $in: ['pending', 'processing'] },
        },
        {
          status: 'failed',
          stripePaymentIntentId: paymentIntent.id,
          $inc: { paymentAttempts: 1 },
          lastPaymentAttempt: new Date(),
        }
      );

      if (!fallbackUpdate) {
        console.error(
          'Could not find donation to update for payment_intent.payment_failed'
        );
        return;
      }
    } else if (!donation) {
      console.error(
        'Could not find donation to update for payment_intent.payment_failed (no metadata)'
      );
      return;
    }

    console.log(`Payment intent ${paymentIntent.id} marked as failed`);
  } catch (error) {
    console.error(
      `Failed to update donation for payment intent ${paymentIntent.id}:`,
      error
    );
  }
};

// Handle payment_intent.canceled event
const handlePaymentIntentCanceled = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  const { metadata } = paymentIntent;

  // First try to find donation by paymentIntentId
  try {
    const donation = await Donation.findOneAndUpdate(
      {
        stripePaymentIntentId: paymentIntent.id,
        status: { $in: ['pending', 'processing'] },
      },
      {
        status: 'canceled',
        $inc: { paymentAttempts: 1 },
        lastPaymentAttempt: new Date(),
      }
    );

    if (!donation && metadata?.donationId) {
      // Fallback: try to find by MongoDB ID from metadata and update with paymentIntentId
      console.log(
        'Trying fallback: updating donation by donationId from metadata'
      );
      const fallbackUpdate = await Donation.findOneAndUpdate(
        {
          _id: new Types.ObjectId(metadata.donationId),
          status: { $in: ['pending', 'processing'] },
        },
        {
          status: 'canceled',
          stripePaymentIntentId: paymentIntent.id,
          $inc: { paymentAttempts: 1 },
          lastPaymentAttempt: new Date(),
        }
      );

      if (!fallbackUpdate) {
        console.error(
          'Could not find donation to update for payment_intent.canceled'
        );
        return;
      }
    } else if (!donation) {
      console.error(
        'Could not find donation to update for payment_intent.canceled (no metadata)'
      );
      return;
    }

    console.log(`Payment intent ${paymentIntent.id} marked as canceled`);
  } catch (error) {
    console.error(
      `Failed to update donation for payment intent ${paymentIntent.id}:`,
      error
    );
  }
};

// Handle charged.refunded event
const handleChargeRefunded = async (charge: Stripe.Charge) => {
  const paymentIntentId = charge.payment_intent as string;

  if (!paymentIntentId) {
    console.error('Refund event received without a payment_intent ID');
    return;
  }

  try {
    const donation = await Donation.findOneAndUpdate(
      {
        stripePaymentIntentId: paymentIntentId,
        status: 'refunding', // <-- Ensure we only update donations awaiting refund confirmation
      },
      {
        status: 'refunded',
      },
      { new: true }
    );

    if (!donation) {
      console.error(
        `Could not find a matching donation in 'refunding' state for payment intent ${paymentIntentId}`
      );
      return;
    }

    console.log(
      `Donation for payment intent ${paymentIntentId} successfully marked as refunded.`
    );
    // Here you could also add logic to deduct points that were earned from this donation.
  } catch (error) {
    console.error(
      `Failed to update donation status to refunded for payment intent ${paymentIntentId}:`,
      error
    );
  }
};

// Main Stripe webhook handler
const handleStripeWebhook = async (
  req: ExtendedRequest,
  res: Response,
  rawBody?: string
) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Missing stripe-signature header'
      );
    }

    // Use raw body if provided (for webhook signature verification)
    const event = StripeService.verifyWebhookSignature(
      rawBody || JSON.stringify(req.body),
      signature
    );

    console.log({ obj: event.data?.object }, { depth: Infinity });
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      // Add other event handlers as needed
      case 'account.updated':
      case 'customer.created':
        console.log(`Webhook received: ${event.type}`);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    // Send success response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Webhook processed successfully',
      data: { received: true },
    });
  } catch (error) {
    console.error('Webhook error:', error);

    // Send error response
    if (error instanceof AppError) {
      return sendResponse(res, {
        statusCode: error.statusCode,
        message: error.message,
        data: null,
      });
    }

    sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Webhook processing failed',
      data: null,
    });
  }
};

export const WebhookHandler = {
  handleStripeWebhook,
};

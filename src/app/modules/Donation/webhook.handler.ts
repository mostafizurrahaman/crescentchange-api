/* eslint-disable no-console */
import { Response } from 'express';
import { Stripe } from 'stripe';
import { sendResponse, AppError } from '../../utils';
import httpStatus from 'http-status';
import { Donation } from './donation.model';
import { StripeService } from '../Stripe/stripe.service';
import { ExtendedRequest } from '../../types';
import { Types } from 'mongoose';
import { ScheduledDonation } from '../ScheduledDonation/scheduledDonation.model';
import { RoundUpModel } from '../RoundUp/roundUp.model';
import { RoundUpTransactionModel } from '../RoundUpTransaction/roundUpTransaction.model';

// Helper function to calculate next donation date for recurring donations
const calculateNextDonationDate = (
  currentDate: Date,
  frequency: string,
  customInterval?: { value: number; unit: 'days' | 'weeks' | 'months' }
): Date => {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case 'custom':
      if (customInterval) {
        switch (customInterval.unit) {
          case 'days':
            nextDate.setDate(nextDate.getDate() + customInterval.value);
            break;
          case 'weeks':
            nextDate.setDate(nextDate.getDate() + customInterval.value * 7);
            break;
          case 'months':
            nextDate.setMonth(nextDate.getMonth() + customInterval.value);
            break;
        }
      }
      break;
  }

  return nextDate;
};

// Helper to update scheduled donation after successful payment
const updateScheduledDonationAfterSuccess = async (
  scheduledDonationId: string
) => {
  try {
    const scheduledDonation = await ScheduledDonation.findById(
      scheduledDonationId
    );

    if (!scheduledDonation) {
      console.error(`❌ Scheduled donation not found: ${scheduledDonationId}`);
      return;
    }

    // Update execution tracking
    scheduledDonation.lastExecutedDate = new Date();
    scheduledDonation.totalExecutions += 1;

    // Calculate next donation date
    const nextDate = calculateNextDonationDate(
      new Date(),
      scheduledDonation.frequency,
      scheduledDonation.customInterval
    );
    scheduledDonation.nextDonationDate = nextDate;

    // Check if end date has passed
    if (scheduledDonation.endDate && nextDate > scheduledDonation.endDate) {
      scheduledDonation.isActive = false;
      console.log(
        `🏁 Scheduled donation ${scheduledDonationId} completed (reached end date)`
      );
    }

    await scheduledDonation.save();

    console.log(`✅ Updated scheduled donation: ${scheduledDonationId}`);
    console.log(`   Next donation date: ${nextDate.toISOString()}`);
    console.log(`   Total executions: ${scheduledDonation.totalExecutions}`);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Error updating scheduled donation: ${err.message}`);
  }
};

// Handle RoundUp donation success
// ✅ MODIFIED: Now UPDATES existing Donation record instead of creating it
const handleRoundUpDonationSuccess = async (
  roundUpId: string,
  paymentIntentId: string
) => {
  try {
    // Get the round-up configuration
    const roundUpConfig = await RoundUpModel.findById(roundUpId);
    if (!roundUpConfig) {
      console.error(`❌ RoundUp configuration not found: ${roundUpId}`);
      return;
    }

    // ✅ NEW: Find existing Donation record by payment intent ID
    const donation = await Donation.findOne({
      stripePaymentIntentId: paymentIntentId,
      donationType: 'round-up',
    });

    if (!donation) {
      console.error(
        `❌ Donation record not found for payment intent: ${paymentIntentId}`
      );
      return;
    }

    console.log(`📝 Found existing Donation record: ${donation._id}`);

    // Get all processing transactions for this payment intent
    const processingTransactions = await RoundUpTransactionModel.find({
      stripePaymentIntentId: paymentIntentId,
      status: 'processing',
    });

    if (processingTransactions.length === 0) {
      console.error(
        `❌ No processing transactions found for payment intent: ${paymentIntentId}`
      );
      return;
    }

    console.log(
      `📦 Found ${processingTransactions.length} processing transactions`
    );

    // Mark transactions as donated
    await RoundUpTransactionModel.updateMany(
      {
        stripePaymentIntentId: paymentIntentId,
        status: 'processing',
      },
      {
        status: 'donated',
        donatedAt: new Date(),
        stripeChargeId: paymentIntentId, // We can get actual chargeId from paymentIntent if needed
      }
    );

    console.log(
      `✅ Updated ${processingTransactions.length} transactions to 'donated' status`
    );

    // ✅ MODIFIED: UPDATE existing Donation record (don't create new one)
    donation.status = 'completed';
    donation.donationDate = new Date();
    donation.roundUpTransactionIds = processingTransactions.map((t) => t._id);
    await donation.save();

    console.log(`✅ Updated Donation record to 'completed' status`);

    // ✅ MODIFIED: Use completeDonationCycle() method for proper state management
    await roundUpConfig.completeDonationCycle();

    console.log(`✅ RoundUp donation completed successfully`);
    console.log(`   RoundUp ID: ${roundUpId}`);
    console.log(`   Donation ID: ${donation._id}`);
    console.log(`   Payment Intent ID: ${paymentIntentId}`);
    console.log(`   User: ${roundUpConfig.user}`);
    console.log(`   Amount: $${donation.amount}`);
    console.log(`   Transactions processed: ${processingTransactions.length}`);

    return {
      success: true,
      roundUpId,
      donationId: donation._id,
      amount: donation.amount,
      transactionsCount: processingTransactions.length,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Error handling RoundUp donation success: ${err.message}`);
    throw error;
  }
};

// Handle RoundUp donation failure
const handleRoundUpDonationFailure = async (
  roundUpId: string,
  paymentIntentId: string,
  errorMessage?: string
) => {
  try {
    // Get the round-up configuration
    const roundUpConfig = await RoundUpModel.findById(roundUpId);
    if (!roundUpConfig) {
      console.error(`❌ RoundUp configuration not found: ${roundUpId}`);
      return;
    }

    // Mark failed transactions back to processed (can retry later)
    await RoundUpTransactionModel.updateMany(
      {
        user: roundUpConfig.user,
        bankConnection: roundUpConfig.bankConnection,
        status: 'processing',
        stripePaymentIntentId: paymentIntentId,
      },
      {
        status: 'processed', // Back to processed to allow retry
        stripePaymentIntentId: undefined, // Clear payment intent ID
        donationAttemptedAt: undefined,
        lastPaymentFailure: new Date(),
        lastPaymentFailureReason: errorMessage || 'Unknown error',
      }
    );

    // Reset round-up configuration status to active (can retry)
    roundUpConfig.status = 'active';
    roundUpConfig.lastDonationAttempt = new Date();
    roundUpConfig.lastDonationFailure = new Date();
    roundUpConfig.lastDonationFailureReason = errorMessage || 'Unknown error';
    await roundUpConfig.save();

    console.log(`❌ RoundUp donation failed, rollback completed`);
    console.log(`   RoundUp ID: ${roundUpId}`);
    console.log(`   Payment Intent ID: ${paymentIntentId}`);
    console.log(`   Error: ${errorMessage || 'Unknown error'}`);

    return {
      success: false,
      roundUpId,
      error: errorMessage || 'Unknown error',
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`❌ Error handling RoundUp donation failure: ${err.message}`);
    throw error;
  }
};

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

  console.log(`🔔 WEBHOOK: payment_intent.succeeded`);
  console.log(`   Payment Intent ID: ${paymentIntent.id}`);
  console.log(
    `   Amount: ${
      paymentIntent.amount / 100
    } ${paymentIntent.currency.toUpperCase()}`
  );
  console.log(`   Donation Type: ${metadata?.donationType || 'one-time'}`);

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
        pointsEarned: Math.floor((paymentIntent.amount / 100) * 100), // Award points now
      },
      { new: true }
    );

    console.log({ PaymentIndentInside: donation });

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
          pointsEarned: Math.floor((paymentIntent.amount / 100) * 100),
        },
        { new: true }
      );

      if (!fallbackUpdate) {
        console.error(
          'Could not find donation to update for payment_intent.succeeded'
        );
        return;
      }

      console.log(`✅ Payment succeeded for donation: ${fallbackUpdate._id}`);

      // ✅ Handle recurring donations - update scheduled donation
      if (
        metadata?.donationType === 'recurring' &&
        metadata?.scheduledDonationId
      ) {
        console.log(
          `🔄 Updating scheduled donation: ${metadata.scheduledDonationId}`
        );
        await updateScheduledDonationAfterSuccess(metadata.scheduledDonationId);
      }

      return;
    } else if (!donation) {
      console.error(
        'Could not find donation to update for payment_intent.succeeded (no metadata)'
      );
      return;
    }

    console.log(`✅ Payment succeeded for donation: ${donation._id}`);

    // ✅ Handle RoundUp donations - update RoundUp transactions and configuration
    if (metadata?.donationType === 'roundup' && metadata?.roundUpId) {
      console.log(
        `🔄 Processing RoundUp donation success: ${metadata.roundUpId}`
      );
      await handleRoundUpDonationSuccess(metadata.roundUpId, paymentIntent.id);
    }

    // ✅ Handle recurring donations - update scheduled donation
    if (
      metadata?.donationType === 'recurring' &&
      metadata?.scheduledDonationId
    ) {
      console.log(
        `🔄 Updating scheduled donation: ${metadata.scheduledDonationId}`
      );
      await updateScheduledDonationAfterSuccess(metadata.scheduledDonationId);
    }
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

  console.log(`🔔 WEBHOOK: payment_intent.payment_failed`);
  console.log(`   Payment Intent ID: ${paymentIntent.id}`);
  console.log(
    `   Error: ${paymentIntent.last_payment_error?.message || 'Unknown'}`
  );
  console.log(`   Donation Type: ${metadata?.donationType || 'one-time'}`);

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
      },
      { new: true }
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
        },
        { new: true }
      );

      if (!fallbackUpdate) {
        console.error(
          'Could not find donation to update for payment_intent.payment_failed'
        );
        return;
      }

      console.log(`❌ Payment failed for donation: ${fallbackUpdate._id}`);

      // ✅ Handle RoundUp donations - mark as failed and enable retry
      if (metadata?.donationType === 'roundup' && metadata?.roundUpId) {
        console.log(
          `❌ Processing RoundUp donation failure: ${metadata.roundUpId}`
        );
        await handleRoundUpDonationFailure(
          metadata.roundUpId,
          paymentIntent.id,
          paymentIntent.last_payment_error?.message || 'Unknown error'
        );
      }

      // ✅ For recurring donations, don't update scheduledDonation - let cron retry
      if (
        metadata?.donationType === 'recurring' &&
        metadata?.scheduledDonationId
      ) {
        console.log(
          `⏭️  Will retry in next cron run for scheduled donation: ${metadata.scheduledDonationId}`
        );
        console.log(
          `   Reason: ${
            paymentIntent.last_payment_error?.message || 'Unknown error'
          }`
        );
      }

      return;
    } else if (!donation) {
      console.error(
        'Could not find donation to update for payment_intent.payment_failed (no metadata)'
      );
      return;
    }

    console.log(`❌ Payment failed for donation: ${donation._id}`);

    // ✅ Handle RoundUp donations - mark as failed and enable retry
    if (metadata?.donationType === 'roundup' && metadata?.roundUpId) {
      console.log(
        `❌ Processing RoundUp donation failure: ${metadata.roundUpId}`
      );
      await handleRoundUpDonationFailure(
        metadata.roundUpId,
        paymentIntent.id,
        paymentIntent.last_payment_error?.message || 'Unknown error'
      );
    }

    // ✅ For recurring donations, don't update scheduledDonation - let cron retry
    if (
      metadata?.donationType === 'recurring' &&
      metadata?.scheduledDonationId
    ) {
      console.log(
        `⏭️  Will retry in next cron run for scheduled donation: ${metadata.scheduledDonationId}`
      );
      console.log(
        `   Reason: ${
          paymentIntent.last_payment_error?.message || 'Unknown error'
        }`
      );
    }
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

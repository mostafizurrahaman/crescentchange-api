import { Types } from 'mongoose';
import httpStatus from 'http-status';
import { ScheduledDonation } from './scheduledDonation.model';
import { IScheduledDonationModel } from '../Donation/donation.interface';
import {
  TCreateScheduledDonation,
  TUpdateScheduledDonation,
} from './scheduledDonation.validation';
import { AppError } from '../../utils';
import Client from '../Client/client.model';
import Organization from '../Organization/organization.model';
import Cause from '../Causes/causes.model';
import { PaymentMethodService } from '../PaymentMethod/paymentMethod.service';
import QueryBuilder from '../../builders/QueryBuilder';
import { Donation } from '../Donation/donation.model';
import { stripe } from '../../lib/stripeHelper';
import { IDonationModel } from '../Donation/donation.interface';
import { IPaymentMethodModel } from '../PaymentMethod/paymentMethod.interface';
import { IORGANIZATION } from '../Organization/organization.interface';

// Helper function to calculate next donation date
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
      if (!customInterval) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Custom interval is required for custom frequency'
        );
      }
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
      break;
    default:
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid frequency');
  }

  return nextDate;
};

// 1. Create scheduled donation
const createScheduledDonation = async (
  userId: string,
  payload: TCreateScheduledDonation
): Promise<IScheduledDonationModel> => {
  const {
    organizationId,
    causeId,
    amount,
    frequency,
    customInterval,
    specialMessage,
    paymentMethodId,
  } = payload;

  // Validate user exists
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Validate organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  // Validate cause exists
  const cause = await Cause.findById(causeId);
  if (!cause) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cause not found!');
  }

  // Verify payment method exists and belongs to user
  const paymentMethod = await PaymentMethodService.getPaymentMethodById(
    paymentMethodId,
    userId
  );

  if (!paymentMethod.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment method is not active!');
  }

  // Get Stripe customer ID from payment method
  const stripeCustomerId = paymentMethod.stripeCustomerId;

  // Set start date to current date
  const startDate = new Date();

  // Calculate next donation date
  const nextDonationDate = calculateNextDonationDate(
    startDate,
    frequency,
    customInterval
  );

  // Create scheduled donation
  const scheduledDonation = await ScheduledDonation.create({
    user: user._id,
    organization: new Types.ObjectId(organizationId),
    cause: new Types.ObjectId(causeId),
    amount,
    currency: 'USD',
    frequency,
    customInterval,
    startDate,
    nextDonationDate,
    isActive: true,
    totalExecutions: 0,
    specialMessage,
    stripeCustomerId,
    paymentMethod,
  });

  return scheduledDonation;
};

// 2. Get user's scheduled donations with filters and pagination (QueryBuilder)
const getUserScheduledDonations = async (
  userId: string,
  query: Record<string, unknown>
): Promise<{
  scheduledDonations: IScheduledDonationModel[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
}> => {
  // Validate user exists
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Build base query with user filter (always required)
  const baseQuery: Record<string, unknown> = { user: user._id };

  // Add isActive filter if specified
  if (query.isActive && query.isActive !== 'all') {
    baseQuery.isActive = query.isActive === 'true';
  }

  // Add frequency filter if specified
  if (query.frequency && query.frequency !== 'all') {
    baseQuery.frequency = query.frequency;
  }

  // Remove custom filters from query object to avoid interference with QueryBuilder
  const queryBuilderQuery = { ...query };
  delete queryBuilderQuery.isActive;
  delete queryBuilderQuery.frequency;

  // Define searchable fields for text search
  const searchableFields = ['specialMessage'];

  // Use QueryBuilder for search, filter, sort, pagination, and field selection
  const scheduledDonationQuery = new QueryBuilder(
    ScheduledDonation.find(baseQuery)
      .populate('organization', 'name email logo')
      .populate('cause', 'name description icon'),
    queryBuilderQuery
  )
    .search(searchableFields) // Search in specialMessage
    .filter() // Additional filters from query params
    .sort() // Sort by query param or default (-createdAt)
    .paginate() // Pagination
    .fields(); // Field selection

  const scheduledDonations = await scheduledDonationQuery.modelQuery;
  const meta = await scheduledDonationQuery.countTotal();

  return {
    scheduledDonations,
    meta,
  };
};

// 3. Get scheduled donation by ID
const getScheduledDonationById = async (
  userId: string,
  scheduledDonationId: string
): Promise<IScheduledDonationModel> => {
  // Validate user exists
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Find scheduled donation
  const scheduledDonation = await ScheduledDonation.findOne({
    _id: scheduledDonationId,
    user: user._id,
  })
    .populate('organization', 'name email logo')
    .populate('cause', 'name description icon');

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  return scheduledDonation;
};

// 4. Update scheduled donation
const updateScheduledDonation = async (
  userId: string,
  scheduledDonationId: string,
  payload: TUpdateScheduledDonation
): Promise<IScheduledDonationModel> => {
  // Validate user exists
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Find scheduled donation
  const scheduledDonation = await ScheduledDonation.findOne({
    _id: scheduledDonationId,
    user: user._id,
  });

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  // Update fields
  if (payload.amount !== undefined) {
    scheduledDonation.amount = payload.amount;
  }

  if (payload.frequency !== undefined) {
    scheduledDonation.frequency = payload.frequency;
  }

  if (payload.customInterval !== undefined) {
    scheduledDonation.customInterval = payload.customInterval;
  }

  if (payload.specialMessage !== undefined) {
    scheduledDonation.specialMessage = payload.specialMessage;
  }

  if (payload.isActive !== undefined) {
    scheduledDonation.isActive = payload.isActive;
  }

  // Recalculate next donation date if frequency or customInterval changed
  if (payload.frequency !== undefined || payload.customInterval !== undefined) {
    const nextDate = calculateNextDonationDate(
      new Date(),
      scheduledDonation.frequency,
      scheduledDonation.customInterval
    );
    scheduledDonation.nextDonationDate = nextDate;
  }

  await scheduledDonation.save();

  return scheduledDonation;
};

// 5. Pause scheduled donation
const pauseScheduledDonation = async (
  userId: string,
  scheduledDonationId: string
): Promise<IScheduledDonationModel> => {
  // Validate user exists
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Find and update
  const scheduledDonation = await ScheduledDonation.findOneAndUpdate(
    { _id: scheduledDonationId, user: user._id },
    { isActive: false },
    { new: true }
  )
    .populate('organization', 'name email logo')
    .populate('cause', 'name description icon');

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  return scheduledDonation;
};

// 6. Resume scheduled donation
const resumeScheduledDonation = async (
  userId: string,
  scheduledDonationId: string
): Promise<IScheduledDonationModel> => {
  // Validate user exists
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Find scheduled donation
  const scheduledDonation = await ScheduledDonation.findOne({
    _id: scheduledDonationId,
    user: user._id,
  });

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  // Recalculate next donation date from current date
  const nextDate = calculateNextDonationDate(
    new Date(),
    scheduledDonation.frequency,
    scheduledDonation.customInterval
  );

  scheduledDonation.isActive = true;
  scheduledDonation.nextDonationDate = nextDate;

  await scheduledDonation.save();

  await scheduledDonation.populate('organization', 'name email logo');
  await scheduledDonation.populate('cause', 'name description');

  return scheduledDonation;
};

// 7. Cancel (delete) scheduled donation
const cancelScheduledDonation = async (
  userId: string,
  scheduledDonationId: string
): Promise<void> => {
  // Validate user exists
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Find and delete
  const result = await ScheduledDonation.findOneAndDelete({
    _id: scheduledDonationId,
    user: user._id,
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }
};

// 8. Get scheduled donations due for execution (for cron job)
const getScheduledDonationsDueForExecution = async (): Promise<
  IScheduledDonationModel[]
> => {
  const now = new Date();

  const scheduledDonations = await ScheduledDonation.find({
    isActive: true,
    // nextDonationDate: { $lte: now },
  })
    .populate('user')
    .populate('organization')
    .populate('cause');

  const dateMaps = scheduledDonations.map((item) => item.nextDonationDate);
  console.log({
    dateMaps,
    now,
  });

  return scheduledDonations;
};

// 9. Execute scheduled donation - Creates actual Donation record
// BEST PRACTICE: Use database transactions for atomic operations
const executeScheduledDonation = async (
  scheduledDonationId: string
): Promise<IDonationModel> => {
  // Don't use .lean() here because we need proper ObjectId handling
  const scheduledDonation = await ScheduledDonation.findById(
    scheduledDonationId
  )
    .populate('user')
    .populate('organization')
    .populate('cause')
    .populate('paymentMethod'); // ✅ Populate payment method

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  if (!scheduledDonation.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Scheduled donation is not active!'
    );
  }

  // Validate payment method exists
  if (!scheduledDonation.paymentMethod) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment method not found!');
  }

  // Safely extract IDs from populated documents
  const userId = (
    scheduledDonation.user._id || scheduledDonation.user
  ).toString();
  const organizationId = (
    scheduledDonation.organization._id || scheduledDonation.organization
  ).toString();
  const causeId = (
    scheduledDonation.cause._id || scheduledDonation.cause
  ).toString();

  // ✅ Get payment method details from populated field
  const paymentMethod =
    scheduledDonation.paymentMethod as unknown as IPaymentMethodModel;

  // Validate payment method is active
  if (!paymentMethod.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Payment method is not active! Please update your payment method.'
    );
  }

  // Get Stripe payment method ID
  const stripePaymentMethodId = paymentMethod.stripePaymentMethodId;

  if (!stripePaymentMethodId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid payment method configuration!'
    );
  }

  // Get organization's Stripe Connect account (required for receiving payments)
  const organization =
    scheduledDonation.organization as unknown as IORGANIZATION;
  const connectedAccountId = organization.stripeConnectAccountId;

  if (!connectedAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Organization "${organization.name}" has not set up payment receiving. Scheduled donation paused.`
    );
  }

  // Validate populated fields exist
  if (
    !scheduledDonation.user ||
    !scheduledDonation.organization ||
    !scheduledDonation.cause
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Scheduled donation has invalid references. Missing user, organization, or cause.'
    );
  }

  // BEST PRACTICE: Generate idempotency key with timestamp and random string to ensure uniqueness
  const idempotencyKey = `scheduled_${scheduledDonationId}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}`;

  // BEST PRACTICE: Track retry attempts to prevent infinite loops
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(
          `🔄 Retry attempt ${attempt}/${MAX_RETRIES} for donation ${scheduledDonationId}`
        );
        // Add exponential backoff delay: 2^attempt * 1000ms
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }

      // Create Stripe PaymentIntent with Stripe Connect transfer
      const paymentIntentParams: {
        amount: number;
        currency: string;
        customer: string;
        payment_method: string;
        confirm: boolean;
        off_session: boolean;
        metadata: Record<string, string>;
        description: string;
        transfer_data: { destination: string };
      } = {
        amount: Math.round(scheduledDonation.amount * 100), // Convert to cents
        currency: scheduledDonation.currency.toLowerCase(),
        customer: scheduledDonation.stripeCustomerId,
        payment_method: stripePaymentMethodId, // ✅ Use the Stripe payment method ID, not ObjectId
        confirm: true, // Automatically confirm the payment
        off_session: true, // Indicates this is an off-session payment (recurring)
        metadata: {
          scheduledDonationId: scheduledDonationId.toString(),
          userId: userId,
          organizationId: organizationId,
          causeId: causeId,
          donationType: 'recurring',
          specialMessage: scheduledDonation.specialMessage || '',
        },
        description: scheduledDonation.specialMessage || 'Recurring donation',
        // Transfer funds directly to organization's connected account
        transfer_data: {
          destination: connectedAccountId,
        },
      };

      console.log({
        paymentIntentParams,
      });

      const paymentIntent = await stripe.paymentIntents.create(
        paymentIntentParams,
        {
          idempotencyKey, // Ensures no duplicate charges
        }
      );

      // Create Donation record with all transaction details
      const donation = await Donation.create({
        donor: userId,
        organization: organizationId,
        cause: causeId,
        donationType: 'recurring',
        amount: scheduledDonation.amount,
        currency: scheduledDonation.currency,
        status: 'processing', // ✅ Always start as processing - webhook will update to completed
        donationDate: new Date(),
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.latest_charge as string,
        stripeCustomerId: scheduledDonation.stripeCustomerId,
        stripePaymentMethodId: stripePaymentMethodId, // ✅ Use the extracted Stripe payment method ID
        specialMessage: scheduledDonation.specialMessage,
        pointsEarned: 0, // ✅ Don't award points yet - webhook will award when payment succeeds
        connectedAccountId, // Organization's Stripe Connect account
        scheduledDonationId: scheduledDonationId,
        idempotencyKey,
        paymentAttempts: attempt,
        lastPaymentAttempt: new Date(),
        receiptGenerated: false,
      });

      // ✅ DON'T update scheduled donation here - let the webhook handle it when payment succeeds
      // This ensures we only update after confirmed payment success
      // await updateScheduledDonationAfterExecution(scheduledDonationId, true);

      console.log(
        `✅ Created payment intent for donation ${donation._id} (status: processing)`
      );
      console.log(`   Payment Intent ID: ${paymentIntent.id}`);
      console.log(`   Waiting for webhook confirmation...`);
      return donation;
    } catch (error: unknown) {
      const err = error as Error & {
        code?: string;
        type?: string;
        message: string;
      };
      lastError = err;
      console.error(
        `❌ Attempt ${attempt}/${MAX_RETRIES} failed for donation ${scheduledDonationId}: ${err.message}`
      );

      // BEST PRACTICE: Check if error is retryable
      const isRetryable =
        err.code === 'card_declined' ||
        err.code === 'insufficient_funds' ||
        err.type === 'api_connection_error' ||
        err.type === 'api_error';

      // Don't retry for non-retryable errors
      if (!isRetryable && attempt < MAX_RETRIES) {
        console.log(
          `⏭️  Error not retryable, stopping attempts for ${scheduledDonationId}`
        );
        break;
      }

      // If this was the last attempt or error is not retryable, record failure
      if (attempt === MAX_RETRIES || !isRetryable) {
        // BEST PRACTICE: Create failed donation record for audit trail
        try {
          await Donation.create({
            donor: userId,
            organization: organizationId,
            cause: causeId,
            donationType: 'recurring',
            amount: scheduledDonation.amount,
            currency: scheduledDonation.currency,
            status: 'failed',
            donationDate: new Date(),
            stripeCustomerId: scheduledDonation.stripeCustomerId,
            stripePaymentMethodId: stripePaymentMethodId, // ✅ Use the extracted Stripe payment method ID
            specialMessage: scheduledDonation.specialMessage,
            pointsEarned: 0,
            connectedAccountId,
            scheduledDonationId: scheduledDonationId,
            idempotencyKey: `${idempotencyKey}_failed_${attempt}`,
            paymentAttempts: attempt,
            lastPaymentAttempt: new Date(),
            receiptGenerated: false,
          });
        } catch (createError: unknown) {
          const createErr = createError as Error;
          console.error(
            `⚠️  Failed to create failed donation record: ${createErr.message}`
          );
          // Continue even if we can't create the failed record
        }

        // Don't update scheduled donation on failure - will retry in next cron run
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Failed to process recurring donation after ${attempt} attempts: ${err.message}`
        );
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new AppError(
    httpStatus.INTERNAL_SERVER_ERROR,
    `Unexpected error processing donation: ${
      lastError?.message || 'Unknown error'
    }`
  );
};

// 10. Update scheduled donation after execution
const updateScheduledDonationAfterExecution = async (
  scheduledDonationId: string,
  success: boolean
): Promise<void> => {
  const scheduledDonation = await ScheduledDonation.findById(
    scheduledDonationId
  );

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  if (success) {
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
    }

    await scheduledDonation.save();
  }
  // If failed, don't update - it will retry next time the cron runs
};

export const ScheduledDonationService = {
  createScheduledDonation,
  getUserScheduledDonations,
  getScheduledDonationById,
  updateScheduledDonation,
  pauseScheduledDonation,
  resumeScheduledDonation,
  cancelScheduledDonation,
  getScheduledDonationsDueForExecution,
  executeScheduledDonation,
  updateScheduledDonationAfterExecution,
};

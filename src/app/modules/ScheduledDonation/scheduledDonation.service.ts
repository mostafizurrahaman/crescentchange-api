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
import { CAUSE_STATUS_TYPE } from '../Causes/causes.constant';
import { PaymentMethodService } from '../PaymentMethod/paymentMethod.service';
import QueryBuilder from '../../builders/QueryBuilder';
import { Donation } from '../Donation/donation.model';
import { IDonationModel } from '../Donation/donation.interface';
import { IPaymentMethodModel } from '../PaymentMethod/paymentMethod.interface';
import { calculateDonationFees } from '../Donation/donation.constant';
import { StripeService } from '../Stripe/stripe.service';
import { IClient } from '../Client/client.interface';
import { StripeAccount } from '../OrganizationAccount/stripe-account.model';
import { createNotification } from '../Notification/notification.service';
import { NOTIFICATION_TYPE } from '../Notification/notification.constant';
import { IORGANIZATION } from '../Organization/organization.interface';
import { SubscriptionService } from '../Subscription/subscription.service';
import { buildBaseMoneyFields } from '../../utils/currency.utils';
import {
  buildOrganizationDonationPricing,
  getOrganizationCurrencyMeta,
} from '../../utils/donation-pricing.utils';

// Helper function to calculate next donation date
export const calculateNextDonationDate = (
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
        throw new Error('Custom interval required for custom frequency');
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

// Create scheduled donation with tax calculation
const createScheduledDonation = async (
  userId: string,
  payload: TCreateScheduledDonation
): Promise<Record<string, unknown>> => {
  const {
    organizationId,
    causeId,
    amount,
    coverFees = false,
    frequency,
    customInterval,
    specialMessage,
    paymentMethodId,
    startDate,
  } = payload;

  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  const pricing = buildOrganizationDonationPricing({
    amount,
    coverFees,
    organizationCountry: organization.country,
    organizationDefaultCurrency: organization.defaultCurrency,
  });

  console.log(`💰 Scheduled Donation Template Created:`);
  console.log(`   Currency: ${pricing.organizationCurrency}`);
  console.log(`   Base: ${pricing.baseAmount.toFixed(2)} ${pricing.organizationCurrency}`);
  console.log(
    `   Total per Run: ${pricing.totalCharge.toFixed(2)} ${pricing.organizationCurrency}`
  );

  // check subscription status of organization
  await SubscriptionService.validateOrganizationAccess(
    organization?._id.toString()
  );

  
  // check is stripe account exists :
  const stripeAccount = await StripeAccount.findOne({
    organization: organization._id,
    status: 'active',
  });

  if (!stripeAccount || !stripeAccount.chargesEnabled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This organization is not set up to receive payments (Stripe account inactive).'
    );
  }

  const cause = await Cause.findById(causeId);
  if (!cause) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cause not found!');
  }
  if (cause.status !== CAUSE_STATUS_TYPE.VERIFIED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot create scheduled donation for cause with status: ${cause.status}. Only verified causes can receive donations.`
    );
  }

  const paymentMethod = await PaymentMethodService.getPaymentMethodById(
    paymentMethodId,
    userId
  );

  if (!paymentMethod.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment method is not active!');
  }

  const startDateTime = new Date(startDate);
  const now = new Date();
  if (startDateTime <= now) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Start date must be in the future.'
    );
  }

  const scheduledDonation = await ScheduledDonation.create({
    user: user._id,
    organization: new Types.ObjectId(organizationId),
    cause: new Types.ObjectId(causeId),

    amount: pricing.baseAmount,
    coverFees,

    currency: pricing.organizationCurrency,
    frequency,
    customInterval,
    startDate: startDateTime,
    nextDonationDate: startDateTime,
    isActive: true,
    status: 'active',
    totalExecutions: 0,
    specialMessage,
    stripeCustomerId: paymentMethod.stripeCustomerId,
    paymentMethod,
  });

  // 🔔 NOTIFICATION LOGIC
  try {
    // 1. To Donor
    await createNotification(
      userId,
      NOTIFICATION_TYPE.RECURRING_PLAN_STARTED,
      `Your recurring donation of $${amount} to ${organization.name} has been scheduled.`,
      scheduledDonation?._id!.toString()
    );

    // 2. To Organization
    await createNotification(
      organization.auth.toString(),
      NOTIFICATION_TYPE.RECURRING_PLAN_STARTED,
      `New Recurring Supporter: A donor has scheduled a ${frequency} donation of $${amount}.`,
      scheduledDonation?._id!.toString()
    );
  } catch (error) {
    console.error('Notification Error:', error);
  }

  return {
    scheduledDonation,
    ...getOrganizationCurrencyMeta(organization),
    message: `Recurring donations will be processed in ${pricing.organizationCurrency}`,
  };
};
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
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const baseQuery: Record<string, unknown> = { user: user._id };

  if (query.isActive && query.isActive !== 'all') {
    baseQuery.isActive = query.isActive === 'true';
  }

  if (query.frequency && query.frequency !== 'all') {
    baseQuery.frequency = query.frequency;
  }

  const queryBuilderQuery = { ...query };
  delete queryBuilderQuery.isActive;
  delete queryBuilderQuery.frequency;

  const searchableFields = ['specialMessage'];

  const scheduledDonationQuery = new QueryBuilder(
    ScheduledDonation.find(baseQuery)
      .populate('organization', 'name email logo')
      .populate('cause', 'name description icon'),
    queryBuilderQuery
  )
    .search(searchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const scheduledDonations = await scheduledDonationQuery.modelQuery;
  const meta = await scheduledDonationQuery.countTotal();

  return {
    scheduledDonations,
    meta,
  };
};

const getScheduledDonationById = async (
  userId: string,
  scheduledDonationId: string
): Promise<IScheduledDonationModel> => {
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

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

const updateScheduledDonation = async (
  userId: string,
  scheduledDonationId: string,
  payload: TUpdateScheduledDonation
): Promise<IScheduledDonationModel> => {
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const scheduledDonation = await ScheduledDonation.findOne({
    _id: scheduledDonationId,
    user: user._id,
  });

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  let newAmount = scheduledDonation.amount;
  let newCoverFees = scheduledDonation.coverFees;

  if (payload.amount !== undefined) {
    scheduledDonation.amount = payload.amount;
    newAmount = payload.amount;
  }

  if (payload.coverFees !== undefined) {
    scheduledDonation.coverFees = payload.coverFees;
    newCoverFees = payload.coverFees;
  }

  // ✅ Log calculation for debugging
  const orgForFees = await Organization.findById(scheduledDonation.organization);
  const financials = calculateDonationFees(newAmount, newCoverFees, {
    country: orgForFees?.country,
  });
  console.log(`📝 Scheduled Donation Updated:`);
  console.log(`   Base: $${newAmount.toFixed(2)}`);
  console.log(`   Cover Fees: ${newCoverFees}`);
  console.log(`   Projected Total: $${financials.totalCharge.toFixed(2)}`);

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

  // If frequency changes, recalculate next date from current nextDonationDate
  if (payload.frequency !== undefined || payload.customInterval !== undefined) {
    const nextDate = calculateNextDonationDate(
      scheduledDonation.nextDonationDate || new Date(),
      scheduledDonation.frequency,
      scheduledDonation.customInterval
    );
    scheduledDonation.nextDonationDate = nextDate;
  }

  await scheduledDonation.save();

  return scheduledDonation;
};

const pauseScheduledDonation = async (
  userId: string,
  scheduledDonationId: string
): Promise<IScheduledDonationModel> => {
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const scheduledDonation = await ScheduledDonation.findOneAndUpdate(
    { _id: scheduledDonationId, user: user._id },
    { isActive: false, status: 'paused' },
    { new: true }
  )
    .populate('organization', 'name email logo')
    .populate('cause', 'name description icon');

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  if (scheduledDonation) {
    try {
      await createNotification(
        userId,
        NOTIFICATION_TYPE.RECURRING_STATUS_CHANGED,
        `Your recurring donation to ${
          (scheduledDonation.organization as any).name
        } has been paused.`,
        scheduledDonation._id!.toString()
      );
    } catch (err) {
      console.log(`❌ Failed to send notification (Pause scheduled)`);
    }
  }

  return scheduledDonation;
};

const resumeScheduledDonation = async (
  userId: string,
  scheduledDonationId: string
): Promise<IScheduledDonationModel> => {
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const scheduledDonation = await ScheduledDonation.findOne({
    _id: scheduledDonationId,
    user: user._id,
  });

  if (!scheduledDonation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }

  const now = new Date();
  const nextDate = calculateNextDonationDate(
    now,
    scheduledDonation.frequency,
    scheduledDonation.customInterval
  );

  scheduledDonation.isActive = true;
  scheduledDonation.status = 'active';
  scheduledDonation.nextDonationDate = nextDate;

  await scheduledDonation.save();

  await scheduledDonation.populate('organization', 'name email logo');
  await scheduledDonation.populate('cause', 'name description');

  try {
    await createNotification(
      userId,
      NOTIFICATION_TYPE.RECURRING_STATUS_CHANGED,
      `Your recurring donation to ${
        (scheduledDonation.organization as any).name
      } has been resumed.`,
      scheduledDonation._id!.toString()
    );
  } catch (error) {
    console.log(`❌ Failed to sent notification!`);
  }

  return scheduledDonation;
};

const cancelScheduledDonation = async (
  userId: string,
  scheduledDonationId: string
): Promise<void> => {
  const user = await Client.findOne({ auth: userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const result = await ScheduledDonation.findOneAndDelete({
    _id: scheduledDonationId,
    user: user._id,
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Scheduled donation not found!');
  }
};

const getScheduledDonationsDueForExecution = async (): Promise<
  IScheduledDonationModel[]
> => {
  const now = new Date();

  // ✅ Only fetch active donations that are not already processing
  const scheduledDonations = await ScheduledDonation.find({
    isActive: true,
    status: 'active',
    nextDonationDate: { $lte: now },
  })
    .populate('user')
    .populate('organization')
    .populate('cause');

  return scheduledDonations;
};

/**
 * ========================================================
 * ⚡ EXECUTE SCHEDULED DONATION (CRON LOGIC REFACTORED)
 * ========================================================
 */
const executeScheduledDonation = async (
  scheduledDonationId: string
): Promise<IDonationModel> => {
  // 1. Lock document
  const lockedDonation = await ScheduledDonation.findOneAndUpdate(
    {
      _id: scheduledDonationId,
      isActive: true,
      status: 'active',
    },
    {
      $set: { status: 'processing' },
    },
    { new: true }
  )
    .populate('user')
    .populate('organization') // Need this to get Stripe Connect ID
    .populate('cause')
    .populate('paymentMethod');

  if (!lockedDonation) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Scheduled donation is already being processed or is not active'
    );
  }

  const scheduledDonation = lockedDonation;

  try {
    // 2. Validate Payment Method
    if (!scheduledDonation.paymentMethod) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment method not found!');
    }
    const paymentMethod =
      scheduledDonation.paymentMethod as unknown as IPaymentMethodModel;
    if (!paymentMethod.isActive) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Payment method is inactive.');
    }

    // 3. Validate Organization & Stripe Connection
    const organization = await Organization.findById(
      scheduledDonation.organization
    );
    if (!organization) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Organization not found.');
    }

    // check is stripe account exists :
    const stripeAccount = await StripeAccount.findOne({
      organization: organization._id,
      status: 'active',
    });

    if (!stripeAccount || !stripeAccount.chargesEnabled) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'This organization is not set up to receive payments (Stripe account inactive).'
      );
    }

    const pricing = buildOrganizationDonationPricing({
      amount: scheduledDonation.amount,
      coverFees: scheduledDonation.coverFees,
      organizationCountry: organization.country,
      organizationDefaultCurrency: organization.defaultCurrency,
    });

    const baseMoney = await buildBaseMoneyFields({
      currency: pricing.organizationCurrency,
      amount: pricing.baseAmount,
      totalAmount: pricing.totalCharge,
      netAmount: pricing.netToOrg,
      platformFee: pricing.platformFee,
      gstOnFee: pricing.gstOnFee,
      stripeFee: pricing.stripeFee,
    });

    console.log(`🔄 Executing Recurring Donation (${scheduledDonationId}):`);
    console.log(`   Currency: ${pricing.organizationCurrency}`);
    console.log(`   Base: ${pricing.baseAmount}`);
    console.log(`   Total Charge: ${pricing.totalCharge}`);
    console.log(`   App Fee: ${pricing.applicationFee}`);
    console.log(`   Destination: ${stripeAccount.stripeAccountId}`);

    const paymentIntent = await StripeService.createPaymentIntentWithMethod({
      amount: pricing.baseAmount,
      totalAmount: pricing.totalCharge,
      applicationFee: pricing.applicationFee,
      orgStripeAccountId: stripeAccount.stripeAccountId,
      connectedAccountCountry: organization.country,
      coverFees: pricing.coverFees,
      platformFee: pricing.platformFee,
      gstOnFee: pricing.gstOnFee,
      stripeFee: pricing.stripeFee,
      netToOrg: pricing.netToOrg,
      currency: pricing.organizationCurrency.toLowerCase(),
      customerId: scheduledDonation.stripeCustomerId,
      paymentMethodId: paymentMethod.stripePaymentMethodId,
      donationId: '',
      organizationId: organization._id.toString(),
      causeId: scheduledDonation.cause.toString(),
      specialMessage: scheduledDonation.specialMessage || 'Recurring Donation',
    });

    // 6. Create Donation Record
    const donation = await Donation.create({
      donor:
        (scheduledDonation.user as unknown as IClient)._id ||
        scheduledDonation.user,
      organization: organization._id,
      cause: scheduledDonation.cause,
      donationType: 'recurring',

      //  Store Financial Breakdown
      amount: pricing.baseAmount,
      coverFees: pricing.coverFees,
      platformFee: pricing.platformFee,
      gstOnFee: pricing.gstOnFee,
      stripeFee: pricing.stripeFee,
      netAmount: pricing.netToOrg,
      totalAmount: pricing.totalCharge,

      currency: pricing.organizationCurrency,
      ...baseMoney,
      pointsEarned: Math.floor(baseMoney.amountBase * 100),

      status: 'processing',
      donationDate: new Date(),

      stripePaymentIntentId: paymentIntent.payment_intent_id,
      stripeChargeId: paymentIntent.client_secret,
      stripeCustomerId: scheduledDonation.stripeCustomerId,
      stripePaymentMethodId: paymentMethod.stripePaymentMethodId,

      specialMessage: scheduledDonation.specialMessage,
      scheduledDonationId: scheduledDonation._id,

      // Idempotency
      idempotencyKey: `recurring_${scheduledDonationId}_${Date.now()}`,
      paymentAttempts: 1,
      lastPaymentAttempt: new Date(),
      receiptGenerated: false,
    });

    console.log(`✅ Recurring donation created: ${donation._id}`);

    return donation;
  } catch (error) {
    // Unlock on error
    await ScheduledDonation.findByIdAndUpdate(scheduledDonationId, {
      status: 'active',
    });
    throw error;
  }
};
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
    scheduledDonation.lastExecutedDate = new Date();
    scheduledDonation.totalExecutions += 1;

    //  Calculate next date from lastExecutedDate
    const baseDate = scheduledDonation.lastExecutedDate;
    const nextDate = calculateNextDonationDate(
      baseDate,
      scheduledDonation.frequency,
      scheduledDonation.customInterval
    );
    scheduledDonation.nextDonationDate = nextDate;

    scheduledDonation.status = 'active';

    await scheduledDonation.save();
  } else {
    // On failure, just unlock
    scheduledDonation.status = 'active';
    await scheduledDonation.save();
  }
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

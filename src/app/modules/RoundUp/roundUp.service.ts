import mongoose, { Types } from 'mongoose';
import { RoundUpModel } from './roundUp.model';
import { Donation } from '../Donation/donation.model';
import { OrganizationModel } from '../Organization/organization.model';
import { StripeService } from '../Stripe/stripe.service';
import bankConnectionService from '../BankConnection/bankConnection.service';
import { roundUpTransactionService } from '../RoundUpTransaction/roundUpTransaction.service';
import { RoundUpTransactionModel } from '../RoundUpTransaction/roundUpTransaction.model';
import { IRoundUpTransaction } from '../RoundUpTransaction/roundUpTransaction.interface';
import { StatusCodes } from 'http-status-codes';
import Cause from '../Causes/causes.model';
import { CAUSE_STATUS_TYPE } from '../Causes/causes.constant';
import { AppError } from '../../utils';
import httpStatus from 'http-status';
import Auth from '../Auth/auth.model';
import PaymentMethod from '../PaymentMethod/paymentMethod.model';
import Client from '../Client/client.model';

// Individual service functions
const savePlaidConsent = async (
  userId: string,
  payload: Record<string, unknown>
) => {
  const {
    bankConnectionId,
    organizationId,
    causeId,
    monthlyThreshold,
    specialMessage,
    paymentMethodId,
  } = payload as {
    bankConnectionId?: string;
    organizationId?: string;
    causeId?: string;
    monthlyThreshold?: number | 'no-limit';
    specialMessage?: string;
    paymentMethodId?: string;
  };

  //  check user :
  const client = await Auth.findById(userId);

  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const paymentMethod = await PaymentMethod.findById(paymentMethodId);
  console.log({ paymentMethod, userId });

  if (!paymentMethod || paymentMethod.user.toString() !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment Method not found!');
  }

  if (!bankConnectionId) {
    return {
      success: false,
      message: 'Bank connection ID is required',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Validate bank connection belongs to user
  const bankConnection = await bankConnectionService.getBankConnectionById(
    bankConnectionId
  );
  console.log({ bankConnection });
  if (
    !bankConnection ||
    String(bankConnection.user as string) !== String(userId)
  ) {
    return {
      success: false,
      message: 'Bank connection not found',
      data: null,
      statusCode: StatusCodes.NOT_FOUND,
    };
  }

  // Validate organization exists and is eligible
  console.log({ organizationId });
  const organization = await OrganizationModel.findById(organizationId);
  console.log(organization);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!organization) {
    return {
      success: false,
      message: 'Invalid organization selected',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Validate cause exists and belongs to the organization

  const cause = await Cause.findById(causeId);
  if (!cause) {
    return {
      success: false,
      message: 'Invalid cause selected',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  if (cause.organization.toString() !== organizationId) {
    return {
      success: false,
      message: 'Cause does not belong to the specified organization',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  if (cause.status !== CAUSE_STATUS_TYPE.VERIFIED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot create round-up for cause with status: ${cause.status}. Only verified causes can receive donations.`
    );
  }

  // Validate monthlyThreshold if provided
  if (
    monthlyThreshold !== null &&
    monthlyThreshold !== undefined &&
    typeof monthlyThreshold === 'number' &&
    monthlyThreshold < 3
  ) {
    return {
      success: false,
      message:
        'Monthly threshold must be at least $3, "no-limit", or undefined',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Check if round-up config already exists for this bank connection
  const existingRoundUp = await RoundUpModel.findOne({
    bankConnection: bankConnectionId,
    isActive: true,
  });

  if (existingRoundUp) {
    return {
      success: false,
      message: 'Round-up configuration already exists for this bank connection',
      data: existingRoundUp,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Create new round-up configuration
  const roundUpConfig = new RoundUpModel({
    user: userId,
    organization: organizationId,
    cause: causeId,
    bankConnection: bankConnectionId,
    paymentMethod: String(paymentMethod._id), // Use default payment method from bank connection
    monthlyThreshold: monthlyThreshold || undefined,
    specialMessage: specialMessage || undefined,
    status: 'pending', // Set initial status to pending
    isActive: true,
    enabled: true,
    totalAccumulated: 0,
    currentMonthTotal: 0,
    lastMonthReset: new Date(),
  });

  await roundUpConfig.save();

  return {
    success: true,
    message: 'Plaid consent saved and round-up configuration created',
    data: roundUpConfig,
    statusCode: StatusCodes.CREATED,
  };
};

const revokeConsent = async (userId: string, bankConnectionId: string) => {
  // Validate bank connection belongs to user
  const bankConnection = await bankConnectionService.getBankConnectionById(
    bankConnectionId
  );
  if (!bankConnection || String(bankConnection.user) !== String(userId)) {
    return {
      success: false,
      message: 'Bank connection not found',
      data: null,
      statusCode: StatusCodes.NOT_FOUND,
    };
  }

  // Cancel round-up configurations and deactivate them
  await RoundUpModel.updateMany(
    { bankConnection: bankConnectionId, isActive: true },
    {
      status: 'cancelled',
      isActive: false,
      enabled: false,
    }
  );

  // Revoke Plaid access
  await bankConnectionService.removeItem(bankConnection.itemId);

  return {
    success: true,
    message: 'Consent revoked and round-up deactivated',
    data: null,
    statusCode: StatusCodes.OK,
  };
};

const syncTransactions = async (
  userId: string,
  bankConnectionId: string,
  payload: { cursor?: string }
) => {
  const { cursor } = payload || {};

  // Validate bank connection belongs to user
  const bankConnection = await bankConnectionService.getBankConnectionById(
    bankConnectionId
  );
  if (!bankConnection || String(bankConnection.user) !== String(userId)) {
    return {
      success: false,
      message: 'Bank connection not found',
      data: null,
      statusCode: StatusCodes.NOT_FOUND,
    };
  }

  // Sync transactions from Plaid (JUST SYNC - NO ROUNDUP PROCESSING)
  const plaidSyncResponse = await bankConnectionService.syncTransactions(
    bankConnectionId,
    cursor
  );

  console.log('========plaidSyncResponse ADDED =========');
  console.log(plaidSyncResponse.added, { depth: Infinity });

  // plaidSyncResponse.added.forEach((transaction: IPlaidTransaction) => {
  //   console.log('transaction', transaction, {
  //     depth: Infinity,
  //   });
  // });

  // Note: RoundUp processing is now handled automatically by cron job
  // This endpoint now only handles transaction synchronization

  return {
    success: true,
    message:
      'Transactions synced successfully (RoundUp processing is automatic)',
    data: {
      plaidSync: plaidSyncResponse,
      hasMore: plaidSyncResponse.hasMore,
      nextCursor: plaidSyncResponse.nextCursor,
      note: 'RoundUp processing is handled automatically by background cron job every 4 hours',
    },
    statusCode: StatusCodes.OK,
  };
};

const processMonthlyDonation = async (
  userId: string,
  payload: { roundUpId?: string; specialMessage?: string }
) => {
  const { roundUpId, specialMessage } = payload;

  // Get round-up configuration
  const roundUpConfig = await RoundUpModel.findOne({
    _id: roundUpId,
    user: userId,
    isActive: true,
  });

  if (!roundUpConfig) {
    return {
      success: false,
      message: 'Round-up configuration not found',
      data: null,
      statusCode: StatusCodes.NOT_FOUND,
    };
  }

  // Check if roundUp is enabled (not paused)
  if (!roundUpConfig.enabled) {
    return {
      success: false,
      message:
        'Round-up is currently paused. Please resume it to process donation.',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Check if roundup is in processing status (threshold met)
  if (roundUpConfig.status === 'completed') {
    return {
      success: false,
      message:
        'Round-up donation already completed for this cycle. Please wait for next cycle.',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Get current date
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;

  // Check if donation already processed for this month
  if (
    await isDonationAlreadyProcessed(String(roundUpConfig._id), currentMonth)
  ) {
    return {
      success: false,
      message: 'Donation already processed for this month',
      data: null,
      statusCode: StatusCodes.CONFLICT,
    };
  }

  // Get all processed transactions for current month
  const processedTransactions = await roundUpTransactionService.getTransactions(
    {
      user: userId,
      bankConnection: roundUpConfig.bankConnection,
      status: 'processed',
      month: String(now.getMonth() + 1),
      year: now.getFullYear(),
    }
  );

  const eligibleTransactions = processedTransactions.filter(
    (transaction: IRoundUpTransaction) => !transaction.stripePaymentIntentId
  );

  if (eligibleTransactions.length === 0) {
    return {
      success: false,
      message: 'No processed transactions found for this month',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Calculate total donation amount
  const totalAmount = eligibleTransactions.reduce(
    (sum: number, transaction: IRoundUpTransaction) =>
      sum + transaction.roundUpAmount,
    0
  );

  const session = await mongoose.startSession();

  // Process donation with specialMessage using webhook approach
  try {
    await session.startTransaction();

    // ✅ NEW: Get organization's Stripe Connect account
    const organization = await OrganizationModel.findById(
      roundUpConfig.organization
    ).session(session);
    if (!organization) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'Organization not found',
        data: null,
        statusCode: StatusCodes.NOT_FOUND,
      };
    }

    const connectedAccountId = organization.stripeConnectAccountId;
    if (!connectedAccountId) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'Organization has not set up payment receiving',
        data: null,
        statusCode: StatusCodes.BAD_REQUEST,
      };
    }

    // Validate cause exists and is verified
    const cause = await Cause.findById(roundUpConfig.cause).session(session);
    if (!cause) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'Cause not found!',
        data: null,
        statusCode: StatusCodes.NOT_FOUND,
      };
    }
    if (cause.status !== CAUSE_STATUS_TYPE.VERIFIED) {
      await session.abortTransaction();
      return {
        success: false,
        message: `Cannot create donation for cause with status: ${cause.status}. Only verified causes can receive donations.`,
        data: null,
        statusCode: StatusCodes.BAD_REQUEST,
      };
    }

    // ✅ Find Client by auth ID (userId is Auth._id)
    const donor = await Client.findOne({ auth: userId }).session(session);
    if (!donor?._id) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'Donor not found!',
        data: null,
        statusCode: StatusCodes.NOT_FOUND,
      };
    }

    // ✅ NEW: Generate unique donation ID
    const donationUniqueId = new Types.ObjectId();

    // ✅ NEW: Create Donation record FIRST with status 'pending'
    const donation = new Donation({
      _id: donationUniqueId,
      donor: new Types.ObjectId(donor._id),
      organization: roundUpConfig.organization,
      cause: roundUpConfig.cause,
      donationType: 'round-up',
      amount: totalAmount,
      currency: 'USD',
      status: 'pending', // Will be updated by webhook
      specialMessage:
        specialMessage || `Manual round-up donation - ${currentMonth}`,
      pointsEarned: Math.round(totalAmount * 10), // 10 points per dollar
      connectedAccountId: connectedAccountId,
      roundUpId: roundUpConfig._id,
      roundUpTransactionIds: eligibleTransactions.map(
        (t: IRoundUpTransaction) => t.transactionId
      ),
      receiptGenerated: false,
      createdAt: new Date(),
    });

    const savedDonation = await donation.save({ session });

    console.log(`📝 Created Donation record: ${savedDonation._id}`);

    // ✅ MODIFIED: Create payment intent with donationId
    const paymentResult = await StripeService.createRoundUpPaymentIntent({
      roundUpId: String(roundUpConfig._id),
      userId,
      charityId: roundUpConfig.organization,
      causeId: roundUpConfig.cause,
      amount: totalAmount,
      month: currentMonth,
      year: now.getFullYear(),
      specialMessage:
        specialMessage || `Manual round-up donation - ${currentMonth}`,
      donationId: String(donationUniqueId), // ✅ NEW: Pass donationId
    });

    // ✅ NEW: Update Donation with payment intent ID
    savedDonation.stripePaymentIntentId = paymentResult.payment_intent_id;
    savedDonation.status = 'processing'; // Update to processing
    await savedDonation.save({ session });

    // Update round-up configuration status to processing
    roundUpConfig.status = 'processing';
    roundUpConfig.lastDonationAttempt = new Date();
    roundUpConfig.currentMonthTotal = Math.max(
      (roundUpConfig.currentMonthTotal || 0) - totalAmount,
      0
    );
    await roundUpConfig.save({ session });

    // Mark transactions as processing (payment initiated)
    await RoundUpTransactionModel.updateMany(
      {
        user: userId,
        bankConnection: roundUpConfig.bankConnection,
        transactionId: {
          $in: eligibleTransactions.map(
            (t: IRoundUpTransaction) => t.transactionId
          ),
        },
        status: 'processed',
      },
      {
        stripePaymentIntentId: paymentResult.payment_intent_id,
        donationAttemptedAt: new Date(),
        donation: donationUniqueId,
      },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    console.log(`🔄 Manual RoundUp donation initiated for user ${userId}`);
    console.log(`   Donation ID: ${donationUniqueId}`);
    console.log(`   Payment Intent ID: ${paymentResult.payment_intent_id}`);
    console.log(`   Amount: $${totalAmount}`);
    console.log(`   Charity: ${roundUpConfig.organization}`);
    console.log(`   Status: processing (awaiting webhook confirmation)`);

    return {
      success: true,
      message:
        'Manual RoundUp donation initiated successfully. Payment processing in progress.',
      data: {
        donationId: String(donationUniqueId), // ✅ NEW: Return donationId
        paymentIntentId: paymentResult.payment_intent_id,
        amount: totalAmount,
        organizationId: roundUpConfig.organization,
        causeId: roundUpConfig.cause,
        month: currentMonth,
        transactionCount: eligibleTransactions.length,
        status: 'processing',
        note: 'Donation will be completed via webhook confirmation',
      },
      statusCode: StatusCodes.OK,
    };
  } catch (error) {
    await session.abortTransaction();

    // Mark round-up as failed if donation processing fails
    await roundUpConfig.markAsFailed(
      error instanceof Error ? error.message : 'Unknown payment error'
    );

    return {
      success: false,
      message: 'Payment processing failed. Round-up marked as failed.',
      data: {
        roundUpId: String(roundUpConfig._id),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown payment error',
        amount: totalAmount,
      },
      statusCode: StatusCodes.BAD_GATEWAY,
    };
  } finally {
    await session.endSession();
  }
};

const resumeRoundUp = async (
  userId: string,
  payload: { roundUpId?: string }
) => {
  const { roundUpId } = payload;

  // Get round-up configuration
  const roundUpConfig = await RoundUpModel.findOne({
    _id: roundUpId,
    user: userId,
    isActive: true,
  });

  if (!roundUpConfig) {
    return {
      success: false,
      message: 'Round-up configuration not found',
      data: null,
      statusCode: StatusCodes.NOT_FOUND,
    };
  }

  if (roundUpConfig.enabled) {
    return {
      success: false,
      message: 'Round-up is already active',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Check if round-up was cancelled, prevent resume
  if (roundUpConfig.status === 'cancelled') {
    return {
      success: false,
      message:
        'Cannot resume cancelled round-up. Please create a new round-up configuration.',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Resume round-up and reset status to pending (for failed cases only)
  roundUpConfig.enabled = true;
  if (roundUpConfig.status === 'failed') {
    roundUpConfig.status = 'pending';
  }
  await roundUpConfig.save();

  return {
    success: true,
    message: 'Round-up has been resumed successfully',
    data: {
      roundUpId: String(roundUpConfig._id),
      enabled: true,
      organization: roundUpConfig.organization,
      cause: roundUpConfig.cause,
      monthlyThreshold: roundUpConfig.monthlyThreshold,
    },
    statusCode: StatusCodes.OK,
  };
};

const switchCharity = async (
  userId: string,
  payload: {
    roundUpId?: string;
    newOrganizationId?: string;
    newCauseId?: string;
    reason?: string;
  }
) => {
  const { roundUpId, newOrganizationId, newCauseId } = payload;

  // Get round-up configuration
  const roundUpConfig = await RoundUpModel.findOne({
    _id: roundUpId,
    user: userId,
  });

  if (!roundUpConfig) {
    return {
      success: false,
      message: 'Round-up configuration not found',
      data: null,
      statusCode: StatusCodes.NOT_FOUND,
    };
  }

  // Validate new organization
  const newOrganization = await OrganizationModel.findById(newOrganizationId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!newOrganization) {
    return {
      success: false,
      message: 'Invalid organization selected',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Validate new cause

  const newCause = await Cause.findById(newCauseId);
  if (!newCause) {
    return {
      success: false,
      message: 'Invalid cause selected',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Validate cause belongs to the new organization
  if (newCause.organization.toString() !== newOrganizationId) {
    return {
      success: false,
      message: 'Cause does not belong to the specified organization',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Check 30-day rule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canSwitch = (roundUpConfig as any).canSwitchCharity();
  if (!canSwitch) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const daysSinceSwitch = roundUpConfig.lastCharitySwitch
      ? Math.floor(
          (Date.now() - roundUpConfig.lastCharitySwitch.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : Infinity;
    const daysUntilNextSwitch = 30 - daysSinceSwitch;

    return {
      success: false,
      message: `Cannot switch charity yet. Wait ${daysUntilNextSwitch} more days`,
      data: {
        canSwitch: false,
        daysUntilNextSwitch,
        lastSwitchDate: roundUpConfig.lastCharitySwitch,
      },
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Switch organization and cause
  roundUpConfig.organization = newOrganizationId;
  roundUpConfig.cause = newCauseId || roundUpConfig.cause;
  roundUpConfig.lastCharitySwitch = new Date();
  await roundUpConfig.save();

  return {
    success: true,
    message: 'Charity switched successfully',
    data: {
      success: true,
      message: 'Charity switched successfully',
      canSwitch: true,
      newOrganizationId,
      newCauseId,
      newOrganizationName: newOrganization.name,
      newCauseName: newCause.name,
      switchedAt: new Date(),
    },
    statusCode: StatusCodes.OK,
  };
};

const getUserDashboard = async (userId: string) => {
  // Get user's round-up configuration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundUpConfig = await (RoundUpModel as any).findActiveByUserId(userId);

  if (!roundUpConfig) {
    return {
      success: true,
      message: 'No active round-up configuration',
      data: {
        hasRoundUp: false,
        config: null,
        stats: null,
        bankConnection: null,
        organization: null,
        cause: null,
      },
      statusCode: StatusCodes.OK,
    };
  }

  // Get associated data
  const [bankConnection, organization, cause, transactionSummary] =
    await Promise.all([
      bankConnectionService.getBankConnectionById(roundUpConfig.bankConnection),
      OrganizationModel.findById(roundUpConfig.organization),
      (
        await import('../Causes/causes.model')
      ).default.findById(roundUpConfig.cause),
      roundUpTransactionService.getTransactionSummary(userId),
    ]);

  // Format response
  const userStats = {
    totalDonated: transactionSummary.totalStats.totalDonated,
    totalRoundUps: transactionSummary.totalStats.totalTransactions,
    monthsDonated: 0, // TODO: Calculate from MonthlyDonationModel
    currentMonthTotal: transactionSummary.currentMonthTotal,
    currentCharity: {
      name: `${organization?.name || 'Unknown'} - ${
        cause?.name || 'Selected Cause'
      }`,
      totalFromUser: transactionSummary.totalStats.totalDonated,
    },
  };

  return {
    success: true,
    message: 'User dashboard retrieved successfully',
    data: {
      hasRoundUp: true,
      config: roundUpConfig,
      stats: userStats,
      bankConnection,
      organization,
      cause,
    },
    statusCode: StatusCodes.OK,
  };
};

// Helper method to check if donation is already processed
const isDonationAlreadyProcessed = async (
  roundUpId: string,
  month: string
): Promise<boolean> => {
  const year = new Date().getFullYear();
  const existingDonation = await Donation.findOne({
    roundUpId,
    donationType: 'round-up',
    donationDate: {
      $gte: new Date(`${year}-${month}-01`),
      $lt: new Date(`${year}-${month}-31`),
    },
  });
  return !!existingDonation;
};

// Export service functions as object
export const roundUpService = {
  savePlaidConsent,
  revokeConsent,
  syncTransactions,
  processMonthlyDonation,
  resumeRoundUp,
  switchCharity,
  getUserDashboard,
};

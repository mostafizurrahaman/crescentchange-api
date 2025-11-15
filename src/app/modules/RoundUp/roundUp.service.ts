import { RoundUpModel } from './roundUp.model';
import { Donation } from '../donation/donation.model';
import { OrganizationModel } from '../Organization/organization.model';
import { IPlaidTransaction } from '../BankConnection/bankConnection.interface';
import { StripeService } from '../Stripe/stripe.service';
import bankConnectionService from '../BankConnection/bankConnection.service';
import roundUpTransactionService from '../RoundUpTransaction/roundUpTransaction.service';
import { StatusCodes } from 'http-status-codes';
import { IRoundUpDocument } from './roundUp.model';
import Cause from '../Causes/causes.model';

// Individual service functions
const savePlaidConsent = async (userId: string, payload: any) => {
  const {
    bankConnectionId,
    organizationId,
    causeId,
    monthlyThreshold,
    specialMessage,
  } = payload;

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

  // Validate organization exists and is eligible
  const organization = await OrganizationModel.findById(organizationId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!organization || (organization as any).type !== 'charity') {
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
  payload: any
) => {
  const { cursor } = payload;

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

  // Sync transactions from Plaid
  const plaidSyncResponse = await bankConnectionService.syncTransactions(
    bankConnectionId,
    cursor
  );

  // Process new transactions for round-ups
  const processingResult =
    await roundUpTransactionService.processTransactionsFromPlaid(
      userId,
      bankConnectionId,
      plaidSyncResponse.added as IPlaidTransaction[]
    );

  return {
    success: true,
    message: 'Transactions synced and round-ups processed',
    data: {
      plaidSync: plaidSyncResponse,
      roundUpProcessing: processingResult,
      hasMore: plaidSyncResponse.hasMore,
      nextCursor: plaidSyncResponse.nextCursor,
    },
    statusCode: StatusCodes.OK,
  };
};

const processMonthlyDonation = async (userId: string, payload: any) => {
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

  if (processedTransactions.length === 0) {
    return {
      success: false,
      message: 'No processed transactions found for this month',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Calculate total donation amount
  const totalAmount = processedTransactions.reduce(
    (sum, transaction) => sum + transaction.roundUpAmount,
    0
  );

  // Process donation with specialMessage
  let donationResult;
  try {
    donationResult = await StripeService.processRoundUpDonation({
      roundUpId: String(roundUpConfig._id),
      userId,
      charityId: roundUpConfig.organization,
      causeId: roundUpConfig.cause,
      amount: totalAmount,
      month: currentMonth,
      year: now.getFullYear(),
      specialMessage: specialMessage || undefined,
    });

    // Complete donation cycle and handle status changes
    await roundUpConfig.completeDonationCycle();

    // Also pause round-up after successful donation
    roundUpConfig.enabled = false;
    await roundUpConfig.save();
  } catch (error) {
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
  }

  return {
    success: true,
    message:
      'Monthly donation processed successfully. Round-up has been paused.',
    data: {
      donationId: donationResult.donationId,
      amount: totalAmount,
      organizationId: roundUpConfig.organization,
      causeId: roundUpConfig.cause,
      month: currentMonth,
      transactionCount: processedTransactions.length,
      roundUpPaused: true,
    },
    statusCode: StatusCodes.OK,
  };
};

const resumeRoundUp = async (userId: string, payload: any) => {
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

const switchCharity = async (userId: string, payload: any) => {
  const { roundUpId, newOrganizationId, newCauseId, reason } = payload;

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
  if (!newOrganization || (newOrganization as any).type !== 'charity') {
    return {
      success: false,
      message: 'Invalid organization selected',
      data: null,
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  // Validate new cause
  const Cause = (await import('../Causes/causes.model')).default;
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
  roundUpConfig.cause = newCauseId;
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

const getTransactionDetails = async (userId: string, transactionId: string) => {
  // Get transaction (must belong to user)
  const transaction = await roundUpTransactionService.getTransactions({
    user: userId,
    // We'll need to modify the service to support transactionId lookup
  });

  // TODO: Implement transaction lookup by ID in the service
  // For now, return a sample response
  return {
    success: false,
    message: 'Transaction details endpoint not yet implemented',
    data: null,
    statusCode: StatusCodes.NOT_IMPLEMENTED,
  };
};

const getAdminDashboard = async (userRole: string[]) => {
  // Get admin statistics
  const [
    totalUsers,
    activeUsers,
    totalDonations,
    activeCharities,
    monthlyStats,
    topCharities,
  ] = await Promise.all([
    RoundUpModel.distinct('user').then((users) => users.length),
    RoundUpModel.countDocuments({ isActive: true, enabled: true }),
    Donation.aggregate([
      { $match: { donationType: 'round-up', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    RoundUpModel.distinct('organization').then((charities) => charities.length),
    // TODO: Add more detailed monthly stats
    Promise.resolve([]),
    // TODO: Add top charities stats
    Promise.resolve([]),
  ]);

  const adminStats = {
    totalUsers,
    activeUsers,
    totalDonated: totalDonations?.[0]?.total || 0,
    totalCharities: activeCharities,
    monthlyStats: [],
    topCharities: [],
    issues: {
      inactiveConnections: 0, // TODO: Calculate from BankConnectionModel
      failedTransfers: 0, // TODO: Calculate from MonthlyDonationModel
      pendingDonations: 0, // TODO: Calculate from MonthlyDonationModel
    },
  };

  return {
    success: true,
    message: 'Admin dashboard retrieved successfully',
    data: adminStats,
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
  getTransactionDetails,
  getAdminDashboard,
};

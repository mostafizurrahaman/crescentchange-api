import { PlaidApi, TransactionsGetRequest } from 'plaid';
import plaidClient from '../../config/plaid';
import { RoundUpTransactionModel } from './roundUpTransaction.model';
import { RoundUpModel } from '../RoundUp/roundUp.model';
import { BankConnectionModel } from '../BankConnection/bankConnection.model';
import {
  IRoundUpTransaction,
  ITransactionProcessingResult,
  IEligibleTransactions,
  ITransactionFilter,
} from './roundUpTransaction.interface';
import { IPlaidTransaction } from '../BankConnection/bankConnection.interface';
import { IRoundUpDocument } from '../RoundUp/roundUp.model';
import { IBankConnectionDocument } from '../BankConnection/bankConnection.model';
import { StripeService } from '../Stripe/stripe.service';
import { Donation } from '../donation/donation.model';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { OrganizationModel } from '../Organization/organization.model';
import { AppError } from '../../utils';
import httpStatus from 'http-status';

// Check and reset monthly total at the beginning of each month
const checkAndResetMonthlyTotal = async (
  roundUpConfig: IRoundUpDocument
): Promise<void> => {
  const now = new Date();
  const lastReset = new Date(roundUpConfig.lastMonthReset);

  // Check if we're in a new month
  if (
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (roundUpConfig as any).resetMonthlyTotal();
  }
};

// Trigger donation when threshold is met (webhook-based approach)
// ✅ MODIFIED: Now creates Donation record BEFORE payment intent
const triggerDonation = async (
  roundUpConfig: IRoundUpDocument
): Promise<{ paymentIntentId: string; donationId: string }> => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    // Get all pending round-up transactions for this user/month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;

    const pendingTransactions = await RoundUpTransactionModel.find({
      user: roundUpConfig.user,
      bankConnection: roundUpConfig.bankConnection,
      status: 'processed',
      transactionDate: {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    }).session(session);

    if (pendingTransactions.length === 0) {
      await session.abortTransaction();
      throw new Error('No pending transactions found for donation');
    }

    // Calculate total amount for donation
    const totalAmount = pendingTransactions.reduce(
      (sum, transaction) => sum + (transaction as any).roundUpAmount,
      0
    );

    if (totalAmount <= 0) {
      await session.abortTransaction();
      throw new Error('Invalid donation amount');
    }

    // ✅ NEW: Get organization's Stripe Connect account
    const organization = await OrganizationModel.findById(
      roundUpConfig.organization
    ).session(session);
    if (!organization) {
      await session.abortTransaction();
      throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
    }

    const connectedAccountId = organization.stripeConnectAccountId;
    if (!connectedAccountId) {
      await session.abortTransaction();
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Organization has not set up payment receiving. Please contact the organization.'
      );
    }

    // ✅ NEW: Generate unique donation ID
    const donationUniqueId = new Types.ObjectId();

    // ✅ NEW: Create Donation record FIRST with status 'pending'
    const donation = new Donation({
      _id: donationUniqueId,
      donor: roundUpConfig.user,
      organization: roundUpConfig.organization,
      cause: roundUpConfig.cause,
      donationType: 'round-up',
      amount: totalAmount,
      currency: 'USD',
      status: 'pending', // Will be updated by webhook
      specialMessage:
        roundUpConfig.specialMessage || `Round-up donation for ${currentMonth}`,
      pointsEarned: Math.round(totalAmount * 10), // 10 points per dollar
      connectedAccountId: connectedAccountId,
      roundUpId: roundUpConfig._id,
      roundUpTransactionIds: pendingTransactions.map((t) => t._id),
      receiptGenerated: false,
      createdAt: new Date(),
    });

    const savedDonation = await donation.save({ session });

    console.log(`📝 Created Donation record: ${savedDonation._id}`);
    console.log(`   Amount: $${totalAmount}`);
    console.log(`   Type: round-up`);
    console.log(`   Status: pending`);

    // ✅ MODIFIED: Create Stripe Payment Intent with donationId in metadata
    const paymentIntentResult = await StripeService.createRoundUpPaymentIntent({
      roundUpId: String(roundUpConfig._id),
      userId: String(roundUpConfig.user),
      charityId: String(roundUpConfig.organization),
      causeId: String(roundUpConfig.cause),
      amount: totalAmount,
      month: currentMonth,
      year: now.getFullYear(),
      specialMessage: roundUpConfig.specialMessage,
      donationId: String(donationUniqueId), // ✅ NEW: Pass donationId
    });

    // ✅ NEW: Update Donation with payment intent ID
    savedDonation.stripePaymentIntentId = paymentIntentResult.payment_intent_id;
    savedDonation.status = 'processing'; // Update to processing
    await savedDonation.save({ session });

    // Update round-up configuration status to processing
    roundUpConfig.status = 'processing';
    roundUpConfig.lastDonationAttempt = new Date();
    await roundUpConfig.save({ session });

    // Mark transactions as processing (payment initiated)
    await RoundUpTransactionModel.updateMany(
      { _id: { $in: pendingTransactions.map((t) => t._id) } },
      {
        status: 'processing',
        stripePaymentIntentId: paymentIntentResult.payment_intent_id,
        donationAttemptedAt: new Date(),
        donation: donationUniqueId, // ✅ NEW: Link to donation record
      },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    console.log(`🔄 RoundUp donation initiated for user ${roundUpConfig.user}`);
    console.log(`   Donation ID: ${donationUniqueId}`);
    console.log(
      `   Payment Intent ID: ${paymentIntentResult.payment_intent_id}`
    );
    console.log(`   Amount: $${totalAmount}`);
    console.log(`   Charity: ${roundUpConfig.organization}`);
    console.log(`   Status: processing (awaiting webhook confirmation)`);

    return {
      paymentIntentId: paymentIntentResult.payment_intent_id,
      donationId: String(donationUniqueId),
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error triggering RoundUp donation:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

// Process Plaid transactions and create round-up entries
const processTransactionsFromPlaid = async (
  userId: string,
  bankConnectionId: string,
  plaidTransactions: IPlaidTransaction[]
): Promise<ITransactionProcessingResult> => {
  const result: ITransactionProcessingResult = {
    processed: 0,
    skipped: 0,
    failed: 0,
    roundUpsCreated: [],
  };

  try {
    // Get user's round-up configuration
    const roundUpConfig = await RoundUpModel.findOne({
      user: userId,
      bankConnection: bankConnectionId,
      isActive: true,
      enabled: true,
    });

    if (!roundUpConfig) {
      throw new Error('No active round-up configuration found');
    }

    // Reset monthly total if needed
    await checkAndResetMonthlyTotal(roundUpConfig);

    // Check if monthly threshold is already met
    if (
      roundUpConfig.monthlyThreshold !== 'no-limit' &&
      typeof roundUpConfig.monthlyThreshold === 'number' &&
      roundUpConfig.currentMonthTotal >= roundUpConfig.monthlyThreshold
    ) {
      result.skipped = plaidTransactions.length;
      return result;
    }

    const isEligibleBeforeThresoldCheck = [];

    // Process each transaction
    for (const plaidTransaction of plaidTransactions) {
      try {
        // Skip transactions without a valid transaction_id
        // This prevents duplicate key errors when transaction_id is null/undefined
        if (
          !plaidTransaction.transaction_id ||
          plaidTransaction.transaction_id.trim() === ''
        ) {
          console.warn(
            `Skipping transaction without transaction_id: ${
              plaidTransaction.name || 'Unknown'
            } (Date: ${plaidTransaction.date})`
          );
          result.skipped++;
          continue;
        }

        // Check if transaction already processed
        // Use direct query for more reliable duplicate detection
        const existingRoundUp = await RoundUpTransactionModel.findOne({
          transactionId: plaidTransaction.transaction_id,
        }).lean();

        if (existingRoundUp) {
          console.log(
            `⏭️ Skipping duplicate transaction (found in DB): ${
              plaidTransaction.transaction_id
            } - ${plaidTransaction.name || 'Unknown'}`
          );
          result.skipped++;
          continue;
        }

        // Check if transaction is eligible for round-up
        if (!RoundUpTransactionModel.isTransactionEligible(plaidTransaction)) {
          result.skipped++;
          continue;
        }

        console.log(`========== Eligible Transaction 1 ==========`);
        console.log(plaidTransaction, { depth: Infinity });
        console.log(`========== Eligible Transaction ==========`);

        // Calculate round-up amount
        const roundUpAmount = RoundUpTransactionModel.calculateRoundUpAmount(
          plaidTransaction.amount
        );

        // Skip if no round-up needed (exact dollar amount)
        if (roundUpAmount === 0) {
          result.skipped++;
          continue;
        }

        // Check if adding this would exceed monthly threshold
        const newMonthlyTotal = roundUpConfig.currentMonthTotal + roundUpAmount;
        isEligibleBeforeThresoldCheck.push({
          plaidTransactionId: plaidTransaction.transaction_id,
          newMonthlyTotal,
          roundUpAmount,
          amount: plaidTransaction.amount,
        });
        if (
          roundUpConfig.monthlyThreshold !== 'no-limit' &&
          typeof roundUpConfig.monthlyThreshold === 'number' &&
          newMonthlyTotal > roundUpConfig.monthlyThreshold
        ) {
          result.skipped++;
          continue;
        }

        // Extract Categories:
        const categories: string[] = [];
        if (plaidTransaction.personal_finance_category?.primary) {
          categories.push(plaidTransaction.personal_finance_category.primary);
        }
        if (plaidTransaction.personal_finance_category?.detailed) {
          categories.push(plaidTransaction.personal_finance_category.detailed);
        }

        // Create round-up transaction
        const roundUpTransaction = new RoundUpTransactionModel({
          user: userId,
          bankConnection: bankConnectionId,
          roundUp: roundUpConfig._id,
          transactionId: plaidTransaction.transaction_id,
          plaidTransactionId: plaidTransaction.transaction_id, // Legacy field for database index compatibility
          originalAmount: plaidTransaction.amount,
          roundUpAmount,
          currency: plaidTransaction.iso_currency_code,
          organization: roundUpConfig.organization,
          transactionDate: new Date(plaidTransaction.date),
          transactionName: plaidTransaction.name,
          // Use the correctly extracted categories, with a fallback
          transactionCategory:
            categories.length > 0 ? categories : ['Uncategorized'],
          status: 'processed',
        });

        await roundUpTransaction.save();

        // Update round-up configuration totals
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const thresholdReached = (roundUpConfig as any).addRoundUpAmount(
          roundUpAmount
        );

        result.processed++;
        result.roundUpsCreated.push(roundUpTransaction as any);

        // If threshold reached, trigger donation
        if (thresholdReached && roundUpConfig.monthlyThreshold !== 'no-limit') {
          result.thresholdReached = {
            roundUpId: String(roundUpConfig._id),
            amount: roundUpConfig.currentMonthTotal,
            charityId: roundUpConfig.organization,
          };

          // Trigger immediate donation processing
          const donationResult = await triggerDonation(roundUpConfig);

          // ✅ NEW: Add donation info to result
          result.thresholdReached.donationId = donationResult.donationId;
          result.thresholdReached.paymentIntentId =
            donationResult.paymentIntentId;

          break; // Stop processing further transactions
        }
      } catch (error: any) {
        console.log({ error });
        // Handle duplicate key errors specifically
        if (error?.code === 11000 || error?.codeName === 'DuplicateKey') {
          console.warn(
            `Duplicate transaction detected (skipping): ${
              plaidTransaction.transaction_id || 'N/A'
            } - ${plaidTransaction.name || 'Unknown'}`
          );
          result.skipped++;
        } else {
          console.error('Error processing transaction:', error);
          result.failed++;
        }
      }
    }

    console.log(
      '✅ Finished processing Plaid transactions for RoundUp',
      isEligibleBeforeThresoldCheck
    );

    return result;
  } catch (error) {
    console.error('Error in processTransactionsFromPlaid:', error);
    throw error;
  }
};

// Get user's round-up transaction summary
const getTransactionSummary = async (userId: string): Promise<any> => {
  try {
    const pipeline = [
      {
        $match: { user: userId },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$roundUpAmount' },
        },
      },
    ];

    const statusCounts = await RoundUpTransactionModel.aggregate(pipeline);

    // Get current month total
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const currentMonthTotal = await RoundUpTransactionModel.aggregate([
      {
        $match: {
          user: userId,
          transactionDate: { $gte: currentMonthStart },
          status: { $in: ['processed', 'donated'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$roundUpAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalStats = await RoundUpTransactionModel.aggregate([
      {
        $match: { user: userId },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalDonated: { $sum: '$roundUpAmount' },
          averageRoundUp: { $avg: '$roundUpAmount' },
        },
      },
    ]);

    return {
      statusCounts: statusCounts.reduce((acc, curr) => {
        acc[curr._id] = { count: curr.count, amount: curr.totalAmount };
        return acc;
      }, {}),
      currentMonthTotal: currentMonthTotal[0]?.total || 0,
      currentMonthCount: currentMonthTotal[0]?.count || 0,
      totalStats: totalStats[0] || {
        totalTransactions: 0,
        totalDonated: 0,
        averageRoundUp: 0,
      },
    };
  } catch (error) {
    console.error('Error getting transaction summary:', error);
    throw error;
  }
};

// Get transactions with filtering
const getTransactions = async (
  filter: ITransactionFilter,
  page = 1,
  limit = 50
): Promise<IRoundUpTransaction[]> => {
  try {
    const query: any = {};

    if (filter.user) query.user = filter.user;
    if (filter.bankConnection) query.bankConnection = filter.bankConnection;
    if (filter.organization) query.organization = filter.organization;
    if (filter.status) query.status = filter.status;

    if (filter.dateRange) {
      query.transactionDate = {
        $gte: filter.dateRange.start,
        $lte: filter.dateRange.end,
      };
    } else if (filter.month && filter.year) {
      const month = String(filter.month).padStart(2, '0');
      const startDate = new Date(`${filter.year}-${month}-01`);
      const endDate = new Date(filter.year, parseInt(month), 0, 23, 59, 59);

      query.transactionDate = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    return (await RoundUpTransactionModel.find(query)
      .sort({ transactionDate: -1 })
      .limit(limit)
      .skip((page - 1) * limit)) as any;
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
};

// Get eligible transactions for date range (for admin purposes)
const getEligibleTransactions = async (
  startDate: Date,
  endDate: Date,
  charityId?: string
): Promise<IEligibleTransactions> => {
  try {
    const matchPipeline: any = {
      transactionDate: { $gte: startDate, $lte: endDate },
      status: { $in: ['processed', 'donated'] },
    };

    if (charityId) {
      matchPipeline.organization = charityId;
    }

    const pipeline = [
      { $match: matchPipeline },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalRoundUpAmount: { $sum: '$roundUpAmount' },
          averageRoundUpAmount: { $avg: '$roundUpAmount' },
        },
      },
    ];

    const stats = await RoundUpTransactionModel.aggregate(pipeline);
    const transactions = await RoundUpTransactionModel.find(matchPipeline)
      .sort({ transactionDate: -1 })
      .limit(100); // Limit for admin view

    return {
      totalTransactions: stats[0]?.totalTransactions || 0,
      eligibleTransactions: stats[0]?.totalTransactions || 0,
      totalRoundUpAmount: stats[0]?.totalRoundUpAmount || 0,
      averageRoundUpAmount: stats[0]?.averageRoundUpAmount || 0,
      transactions: transactions as any,
    };
  } catch (error) {
    console.error('Error getting eligible transactions:', error);
    throw error;
  }
};

// Get specific transaction by ID
const getTransactionById = async (
  transactionId: string,
  userId?: string
): Promise<IRoundUpTransaction | null> => {
  try {
    const query: any = { transactionId };
    if (userId) query.user = userId;

    const transaction = await RoundUpTransactionModel.findOne(query).lean();
    return transaction as IRoundUpTransaction;
  } catch (error) {
    console.error('Error getting transaction by ID:', error);
    throw error;
  }
};

export const roundUpTransactionService = {
  processTransactionsFromPlaid,
  getTransactionSummary,
  getTransactions,
  getEligibleTransactions,
  getTransactionById,
};

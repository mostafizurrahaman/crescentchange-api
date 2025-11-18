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
const triggerDonation = async (
  roundUpConfig: IRoundUpDocument
): Promise<{ paymentIntentId: string }> => {
  try {
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
    });

    if (pendingTransactions.length === 0) {
      throw new Error('No pending transactions found for donation');
    }

    // Calculate total amount for donation
    const totalAmount = pendingTransactions.reduce(
      (sum, transaction) => sum + (transaction as any).roundUpAmount,
      0
    );

    if (totalAmount <= 0) {
      throw new Error('Invalid donation amount');
    }

    // Create Stripe Payment Intent for round-up donation
    const paymentIntentResult = await StripeService.createRoundUpPaymentIntent({
      roundUpId: String(roundUpConfig._id),
      userId: roundUpConfig.user,
      charityId: roundUpConfig.organization,
      causeId: roundUpConfig.cause,
      amount: totalAmount,
      month: currentMonth,
      year: now.getFullYear(),
      specialMessage: roundUpConfig.specialMessage,
    });

    // Update round-up configuration status to processing
    roundUpConfig.status = 'processing';
    roundUpConfig.lastDonationAttempt = new Date();
    await roundUpConfig.save();

    // Mark transactions as processing (payment initiated)
    await RoundUpTransactionModel.updateMany(
      { _id: { $in: pendingTransactions.map((t) => t._id) } },
      {
        status: 'processing',
        stripePaymentIntentId: paymentIntentResult.payment_intent_id,
        donationAttemptedAt: new Date(),
      }
    );

    console.log(`🔄 RoundUp donation initiated for user ${roundUpConfig.user}`);
    console.log(
      `   Payment Intent ID: ${paymentIntentResult.payment_intent_id}`
    );
    console.log(`   Amount: $${totalAmount}`);
    console.log(`   Charity: ${roundUpConfig.organization}`);

    return { paymentIntentId: paymentIntentResult.payment_intent_id };
  } catch (error) {
    console.error('Error triggering RoundUp donation:', error);
    throw error;
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

    // Process each transaction
    for (const plaidTransaction of plaidTransactions) {
      try {
        // Check if transaction already processed
        const existingRoundUp = await RoundUpTransactionModel.existsTransaction(
          plaidTransaction.transaction_id
        );

        if (existingRoundUp) {
          result.skipped++;
          continue;
        }

        // Check if transaction is eligible for round-up
        if (!RoundUpTransactionModel.isTransactionEligible(plaidTransaction)) {
          result.skipped++;
          continue;
        }

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
        if (
          roundUpConfig.monthlyThreshold !== 'no-limit' &&
          typeof roundUpConfig.monthlyThreshold === 'number' &&
          newMonthlyTotal > roundUpConfig.monthlyThreshold
        ) {
          result.skipped++;
          continue;
        }

        // *** FIX STARTS HERE ***
        // Correctly extract categories from the personal_finance_category object
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
        // *** FIX ENDS HERE ***

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
          await triggerDonation(roundUpConfig);
          break; // Stop processing further transactions
        }
      } catch (error) {
        console.error('Error processing transaction:', error);
        result.failed++;
      }
    }

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

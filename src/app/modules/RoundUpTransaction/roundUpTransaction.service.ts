import { BadRequestError, NotFoundError } from '../../errors';
import RoundUpTransaction from './roundUpTransaction.model';
import BankConnection from '../BankConnection/bankConnection.model';
import { 
  IRoundUpTransactionPayload, 
  ICreateRoundUpTransactionPayload,
  ISyncRoundUpTransactionsResponse,
  IGetTransactionsQuery,
  ITransactionSummary,
  IPlaidTransaction,
  IPlaidTransactionWithRoundUp
} from './roundUpTransaction.interface';
import { 
  EXCLUDED_TRANSACTION_CATEGORIES,
  ELIGIBLE_TRANSACTION_TYPES
} from '../BankConnection/bankConnection.constant';
import { STATUS_CODES } from '../BankConnection/bankConnection.constant';

class RoundUpTransactionService {
  /**
   * Create round-up transactions from Plaid transactions
   */
  async createRoundUpTransactions(
    userId: string,
    bankConnectionId: string,
    plaidTransactions: IPlaidTransaction[]
  ): Promise<ISyncRoundUpTransactionsResponse> {
    try {
      // Validate bank connection belongs to user
      const bankConnection = await BankConnection.findOne({ 
        _id: bankConnectionId, 
        user: userId, 
        isActive: true 
      });
      
      if (!bankConnection) {
        throw new NotFoundError('Bank connection not found or inactive');
      }

      const createdTransactions = [];
      let totalProcessed = 0;
      let totalAmount = 0;

      for (const plaidTx of plaidTransactions) {
        // Check if transaction already exists
        const existingTx = await RoundUpTransaction.findByPlaidTransactionId(plaidTx.transaction_id);
        if (existingTx) {
          continue; // Skip if already processed
        }

        // Check if transaction is eligible for round-up
        const eligibleTx = this.filterEligibleTransaction(plaidTx);
        if (!eligibleTx) {
          continue; // Skip ineligible transactions
        }

        // Calculate round-up value
        const originalAmount = Math.abs(eligibleTx.amount);
        const roundUpValue = this.calculateRoundUp(originalAmount);

        // Only create round-up if there's a non-zero value
        if (roundUpValue <= 0) {
          continue;
        }

        // Create round-up transaction
        const roundUpTx = await RoundUpTransaction.create({
          user: userId,
          bankConnection: bankConnectionId,
          plaidTransactionId: eligibleTx.transaction_id,
          plaidAccountId: eligibleTx.account_id,
          originalAmount: originalAmount,
          roundUpValue: roundUpValue,
          transactionDate: new Date(eligibleTx.date),
          transactionDescription: eligibleTx.name || eligibleTx.merchant_name || 'Transaction',
          transactionType: 'debit',
          category: eligibleTx.category || [],
          merchantName: eligibleTx.merchant_name,
          location: this.formatLocation(eligibleTx.location),
          processed: false,
        });

        createdTransactions.push(roundUpTx);
        totalProcessed++;
        totalAmount += roundUpValue;
      }

      return {
        transactions: createdTransactions,
        totalProcessed,
        totalAmount,
        lastSyncDate: new Date(),
      };
    } catch (error: any) {
      throw new BadRequestError(`Failed to create round-up transactions: ${error.message}`);
    }
  }

  /**
   * Get round-up transactions for a user
   */
  async getUserTransactions(
    userId: string, 
    query: IGetTransactionsQuery = {}
  ): Promise<any> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100); // Max 100 items per page
      const skip = (page - 1) * limit;

      // Build filter conditions
      const filter: any = { user: userId };
      
      if (query.processed !== undefined) {
        filter.processed = query.processed;
      }
      
      if (query.startDate || query.endDate) {
        filter.transactionDate = {};
        if (query.startDate) {
          filter.transactionDate.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          filter.transactionDate.$lte = new Date(query.endDate);
        }
      }
      
      if (query.category) {
        filter.category = { $regex: query.category, $options: 'i' };
      }
      
      if (query.minAmount || query.maxAmount) {
        filter.roundUpValue = {};
        if (query.minAmount) {
          filter.roundUpValue.$gte = query.minAmount;
        }
        if (query.maxAmount) {
          filter.roundUpValue.$lte = query.maxAmount;
        }
      }
      
      if (query.searchTerm) {
        filter.$or = [
          { transactionDescription: { $regex: query.searchTerm, $options: 'i' } },
          { merchantName: { $regex: query.searchTerm, $options: 'i' } },
        ];
      }

      const transactions = await RoundUpTransaction.find(filter)
        .populate('bankConnection', 'institutionName accountName accountNumber')
        .populate('donationId', 'amount status')
        .sort({ transactionDate: -1 })
        .skip(skip)
        .limit(limit);

      const total = await RoundUpTransaction.countDocuments(filter);

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      throw new BadRequestError(`Failed to fetch transactions: ${error.message}`);
    }
  }

  /**
   * Get transaction summary for a user
   */
  async getTransactionSummary(userId: string): Promise<ITransactionSummary> {
    try {
      // Get basic summary
      const summaryResult = await RoundUpTransaction.getTransactionSummary(userId);
      const summary = summaryResult[0] || {
        totalTransactions: 0,
        totalRoundUpAmount: 0,
        totalDonatedAmount: 0,
        averageRoundUp: 0,
      };

      // Get category breakdown
      const categoryBreakdown = await RoundUpTransaction.getCategoryBreakdown(userId);

      // Get monthly breakdown to find most active month
      const monthlyBreakdown = await RoundUpTransaction.getMonthlyBreakdown(userId);
      const mostActiveMonth = monthlyBreakdown.length > 0 
        ? monthlyBreakdown[0].month 
        : null;

      return {
        ...summary,
        mostActiveMonth,
        topCategories: categoryBreakdown.slice(0, 5), // Top 5 categories
      };
    } catch (error: any) {
      throw new BadRequestError(`Failed to fetch transaction summary: ${error.message}`);
    }
  }

  /**
   * Process unprocessed round-up transactions into donations
   */
  async processUnprocessedTransactions(
    userId: string,
    thresholdAmount: number
  ): Promise<any> {
    try {
      // Get unprocessed transactions
      const unprocessedTx = await RoundUpTransaction.findUnprocessedTransactions()
        .find({ user: userId })
        .sort({ transactionDate: 1 }); // Process in chronological order

      if (unprocessedTx.length === 0) {
        return {
          message: 'No unprocessed transactions found',
          donationCreated: false,
        };
      }

      // Calculate total amount to donate
      const totalAmount = unprocessedTx.reduce((sum, tx) => sum + tx.roundUpValue, 0);

      // Check if threshold is met
      if (totalAmount < thresholdAmount) {
        return {
          message: `Threshold not met. Current total: $${totalAmount.toFixed(2)}, Required: $${thresholdAmount.toFixed(2)}`,
          donationCreated: false,
          totalAmount,
          pendingTransactions: unprocessedTx.length,
        };
      }

      // Create donation record here (would integrate with Donation module)
      // For now, we'll just mark transactions as processed
      const donationId = `DONATION_${Date.now()}`; // Placeholder
      
      // Mark all transactions as processed
      const processedTransactions = [];
      for (const tx of unprocessedTx) {
        await tx.markAsProcessed(donationId);
        processedTransactions.push(tx);
      }

      return {
        message: 'Donation created successfully',
        donationCreated: true,
        donationId,
        totalAmount,
        transactionsProcessed: processedTransactions.length,
      };
    } catch (error: any) {
      throw new BadRequestError(`Failed to process transactions: ${error.message}`);
    }
  }

  /**
   * Mark transaction as processed with donation ID
   */
  async markTransactionAsProcessed(
    transactionId: string,
    donationId: string,
    userId: string
  ): Promise<void> {
    try {
      const transaction = await RoundUpTransaction.findOne({
        _id: transactionId,
        user: userId,
      });

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      if (transaction.processed) {
        throw new BadRequestError('Transaction is already processed');
      }

      await transaction.markAsProcessed(donationId);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string, userId: string): Promise<any> {
    try {
      const transaction = await RoundUpTransaction.findById(transactionId)
        .populate('bankConnection', 'institutionName accountName accountNumber')
        .populate('donationId', 'amount status createdAt');

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      // Verify user owns this transaction
      if (transaction.user.toString() !== userId) {
        throw new BadRequestError('Access denied');
      }

      return transaction;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Calculate round-up value for an amount
   */
  calculateRoundUp(amount: number): number {
    const rounded = Math.ceil(amount);
    return parseFloat((rounded - amount).toFixed(2));
  }

  /**
   * Filter transactions eligible for round-ups
   */
  private filterEligibleTransaction(transaction: IPlaidTransaction): IPlaidTransaction | null {
    // Only process completed transactions (not pending)
    if (transaction.pending) {
      return null;
    }

    // Only process debit transactions (purchases)
    if (transaction.amount >= 0) { // Credit transactions are >= 0, debits are < 0
      return null;
    }

    // Skip if transaction falls under excluded categories
    if (transaction.category && transaction.category.some(cat => 
      EXCLUDED_TRANSACTION_CATEGORIES.some(excluded => 
        cat.toLowerCase().includes(excluded.toLowerCase())
      )
    )) {
      return null;
    }

    // Skip transfers and other non-purchase transactions
    if (transaction.transaction_type && !ELIGIBLE_TRANSACTION_TYPES.includes(transaction.transaction_type.toLowerCase())) {
      return null;
    }

    return transaction;
  }

  /**
   * Format location data from Plaid transaction
   */
  private formatLocation(location: any): any {
    if (!location) return undefined;

    return {
      address: location.address,
      city: location.city,
      region: location.region,
      postalCode: location.postal_code,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
    };
  }

  /**
   * Delete transaction (admin only)
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    try {
      const transaction = await RoundUpTransaction.findById(transactionId);
      
      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      // Only allow deletion of unprocessed transactions
      if (transaction.processed) {
        throw new BadRequestError('Cannot delete processed transactions');
      }

      await RoundUpTransaction.findByIdAndDelete(transactionId);
    } catch (error: any) {
      throw error;
    }
  }
}

export default new RoundUpTransactionService();

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IRoundUpTransaction } from './roundUpTransaction.interface';

export interface IRoundUpTransactionDocument
  extends IRoundUpTransaction,
    Document {}

export interface IRoundUpTransactionModel
  extends Model<IRoundUpTransactionDocument> {
  existsTransaction(transactionId: string): Promise<IRoundUpTransactionDocument | null>;
  calculateRoundUpAmount(amount: number): number;
  isTransactionEligible(transaction: {
    amount: number;
    category?: string[];
    name?: string;
  }): boolean;
}

// Categories to exclude from round-up calculations
const EXCLUDED_CATEGORIES = [
  'Transfer',
  'Transfer, Debit',
  'Transfer, Credit',
  'ATM',
  'ATM, Cash',
  'Withdrawal',
  'Cash Withdrawal',
  'Payment',
  'Bill Payment',
  'Refund',
  'Deposit',
  'Interest',
  'Dividend',
  'Service Fee',
  'Overdraft',
  'Loan',
  'Credit Card Payment',
];

const RoundUpTransactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Client',
      index: true,
    },
    bankConnection: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'BankConnection',
      index: true,
    },
    roundUp: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'RoundUp',
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Critical for deduplication
    },
    originalAmount: {
      type: Number,
      required: true,
    },
    roundUpAmount: {
      type: Number,
      required: true,
      min: 0.01, // Minimum round-up amount
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    organization: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Organization',
      index: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    transactionName: {
      type: String,
      required: true,
    },
    transactionCategory: {
      type: [String],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'donated', 'failed'],
      default: 'processed',
      index: true,
    },
    donation: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to check if transaction is eligible for round-up
RoundUpTransactionSchema.virtual('isEligible').get(function (this: IRoundUpTransactionDocument) {
  // Transaction must be a purchase (negative amount for outgoing money)
  if (this.originalAmount >= 0) return false;

  // Must have some round-up amount
  if (this.roundUpAmount <= 0) return false;

  // Must not be in excluded categories
  const hasExcludedCategory = this.transactionCategory.some((category: string) =>
    EXCLUDED_CATEGORIES.includes(category.toLowerCase())
  );

  return !hasExcludedCategory;
});

// Static method to check for duplicates
RoundUpTransactionSchema.statics.existsTransaction = function (
  transactionId: string
) {
  return this.findOne({ transactionId });
};

// Static method to calculate round-up amount
RoundUpTransactionSchema.statics.calculateRoundUpAmount = function (
  amount: number
): number {
  // Calculate round-up: ceil(abs(amount)) - abs(amount)
  // Example: $4.60 -> $0.40, $20.00 -> $0.00 (skip if exact dollar)
  const absAmount = Math.abs(amount);
  const roundedUp = Math.ceil(absAmount);
  const roundUpAmount = roundedUp - absAmount;

  // Return 0 if exact dollar amount (no round-up needed)
  return roundUpAmount === 0 ? 0 : roundUpAmount;
};

// Static method to check if transaction is eligible
RoundUpTransactionSchema.statics.isTransactionEligible = function (
  transaction: {
    amount: number;
    category?: string[];
    name?: string;
  }
): boolean {
  // Must be a debit (negative for outgoing)
  if (transaction.amount >= 0) return false;

  // Exclude specific transaction categories
  const excludedCategories = [
    'Transfer',
    'Withdrawal',
    'ATM',
    'Payment',
    'Refund',
    'Deposit',
    'Interest',
    'Service Fee',
    'Overdraft',
  ];

  if (transaction.category) {
    const hasExcludedCategory = transaction.category.some((cat: string) =>
      excludedCategories.some((excluded) =>
        cat.toLowerCase().includes(excluded.toLowerCase())
      )
    );

    if (hasExcludedCategory) return false;
  }

  // Check for specific transaction names to exclude
  const excludedNames = ['ATM', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'REFUND'];
  const transactionName = (transaction.name || '').toUpperCase();

  if (excludedNames.some((excluded) => transactionName.includes(excluded))) {
    return false;
  }

  return true;
};

// Compound indexes for optimal performance
RoundUpTransactionSchema.index({ user: 1, status: 1 });
RoundUpTransactionSchema.index({ bankConnection: 1, transactionDate: -1 });
RoundUpTransactionSchema.index({ organization: 1, status: 1 });
RoundUpTransactionSchema.index({ roundUp: 1, status: 1 });
RoundUpTransactionSchema.index({ transactionDate: 1, status: 1 });
RoundUpTransactionSchema.index({ user: 1, createdAt: -1 });

export const RoundUpTransactionModel =
  mongoose.model<IRoundUpTransactionDocument, IRoundUpTransactionModel>(
    'RoundUpTransaction',
    RoundUpTransactionSchema
  );

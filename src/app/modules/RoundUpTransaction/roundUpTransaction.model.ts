import mongoose, { Schema, Document, Model } from 'mongoose';
import { IRoundUpTransaction } from './roundUpTransaction.interface';
import { IPlaidTransaction } from '../BankConnection/bankConnection.interface';

export interface IRoundUpTransactionDocument
  extends IRoundUpTransaction,
    Document {}

export interface IRoundUpTransactionModel
  extends Model<IRoundUpTransactionDocument> {
  existsTransaction(
    transactionId: string
  ): Promise<IRoundUpTransactionDocument | null>;
  calculateRoundUpAmount(amount: number): number;
  isTransactionEligible(transaction: IPlaidTransaction): boolean;
}

// Categories to exclude from round-up calculations
// These match Plaid's personal_finance_category.primary values
// Based on spec: "Exclude non-roundable transactions (e.g., transfers, ATM, BPAY)"
const EXCLUDED_CATEGORIES = [
  'TRANSFER_IN', // Incoming transfers
  'TRANSFER_OUT', // Outgoing transfers
  'LOAN_PAYMENTS', // Loan payments (including credit card payments)
  'BANK_FEES', // ATM fees, service fees, overdraft fees
  'INCOME', // Income deposits (not purchases)
  'INCOME_DIVIDEND', // Dividend income
  'INCOME_INTEREST_EARNED', // Interest earned
  'REFUND', // Refunds (not purchases)
  'DEPOSIT', // Deposits
];

const RoundUpTransactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Auth',
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
      sparse: true, // Allow null values without duplicate key errors
      index: true, // Critical for deduplication
    },
    // Legacy field name - kept for database index compatibility
    // Maps to the same value as transactionId
    plaidTransactionId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
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
      enum: ['pending', 'processed', 'processing', 'donated', 'failed'],
      default: 'processed',
      index: true,
    },
    donation: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
    },
    // Webhook-based payment fields
    stripePaymentIntentId: {
      type: String,
      index: true,
    },
    stripeChargeId: {
      type: String,
    },
    donationAttemptedAt: {
      type: Date,
    },
    donatedAt: {
      type: Date,
    },
    lastPaymentFailure: {
      type: Date,
    },
    lastPaymentFailureReason: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to check if transaction is eligible for round-up
RoundUpTransactionSchema.virtual('isEligible').get(function (
  this: IRoundUpTransactionDocument
) {
  // Transaction must be a purchase (negative amount for outgoing money)
  if (this.originalAmount >= 0) return false;

  // Must have some round-up amount
  if (this.roundUpAmount <= 0) return false;

  // Must not be in excluded categories
  const hasExcludedCategory = this.transactionCategory.some(
    (category: string) => EXCLUDED_CATEGORIES.includes(category.toUpperCase())
  );

  return !hasExcludedCategory;
});

// Static method to check for duplicates
RoundUpTransactionSchema.statics.existsTransaction = function (
  transactionId: string
) {
  // Use lean() for better performance and ensure we're querying the correct field
  return this.findOne({ transactionId }).lean();
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

  // Return the rounded amount to two decimal places to avoid floating point issues
  return parseFloat(roundUpAmount.toFixed(2));
};

// Static method to check if transaction is eligible
RoundUpTransactionSchema.statics.isTransactionEligible = function (
  transaction: IPlaidTransaction
): boolean {
  // Must be a debit (positive for outgoing in Plaid's default schema)
  if (transaction.amount < 0) return false;

  // *** FIX STARTS HERE ***
  // Check the modern personal_finance_category field
  const primaryCategory =
    transaction.personal_finance_category?.primary?.toUpperCase() || '';
  if (primaryCategory && EXCLUDED_CATEGORIES.includes(primaryCategory)) {
    return false;
  }
  // *** FIX ENDS HERE ***

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

export const RoundUpTransactionModel = mongoose.model<
  IRoundUpTransactionDocument,
  IRoundUpTransactionModel
>('RoundUpTransaction', RoundUpTransactionSchema);

import { Schema, model, Document } from 'mongoose';
import { IRoundUpTransaction } from './roundUpTransaction.interface';

type RoundUpTransactionDocument = Document & IRoundUpTransaction;

const roundUpTransactionSchema = new Schema<RoundUpTransactionDocument>(
  {
    roundUp: {
      type: Schema.Types.ObjectId,
      ref: 'RoundUp',
      default: null, // Allow null initially
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    bankConnection: {
      type: Schema.Types.ObjectId,
      ref: 'BankConnection',
      required: true,
    },
    plaidTransactionId: {
      type: String,
      required: true,
      unique: true,
    },
    plaidAccountId: {
      type: String,
      required: true,
    },
    
    // Transaction details
    originalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    roundUpValue: {
      type: Number,
      required: true,
      min: 0.01,
      max: 0.99,
    },
    transactionDate: {
      type: Date,
      required: true,
    },
    transactionDescription: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Plaid-specific fields
    transactionType: {
      type: String,
      enum: ['debit', 'credit'],
      required: true,
    },
    category: {
      type: [String],
      default: [],
    },
    merchantName: {
      type: String,
      trim: true,
    },
    location: {
      address: String,
      city: String,
      region: String,
      postalCode: String,
      country: String,
      lat: Number,
      lon: Number,
    },
    
    // Status
    processed: {
      type: Boolean,
      default: false,
    },
    donationId: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        // Format dates for frontend consumption
        if (ret.transactionDate) {
          ret.transactionDate = ret.transactionDate.toISOString();
        }
        if (ret.createdAt) {
          ret.createdAt = ret.createdAt.toISOString();
        }
        if (ret.updatedAt) {
          ret.updatedAt = ret.updatedAt.toISOString();
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
roundUpTransactionSchema.index({ user: 1 });
roundUpTransactionSchema.index({ bankConnection: 1 });
roundUpTransactionSchema.index({ plaidTransactionId: 1 });
roundUpTransactionSchema.index({ processed: 1 });
roundUpTransactionSchema.index({ transactionDate: -1 });
roundUpTransactionSchema.index({ user: 1, processed: 1 });

// Compound index for user transaction queries
roundUpTransactionSchema.index({ user: 1, transactionDate: -1 });

// Static methods
roundUpTransactionSchema.statics.findByUser = function (userId: string, query: any = {}) {
  return this.find({ user: userId, ...query });
};

roundUpTransactionSchema.statics.findByBankConnection = function (bankConnectionId: string) {
  return this.find({ bankConnection: bankConnectionId });
};

roundUpTransactionSchema.statics.findUnprocessedTransactions = function () {
  return this.find({ processed: false });
};

roundUpTransactionSchema.statics.findByPlaidTransactionId = function (plaidTransactionId: string) {
  return this.findOne({ plaidTransactionId: plaidTransactionId });
};

roundUpTransactionSchema.statics.getTransactionSummary = function (userId: string) {
  return this.aggregate([
    { $match: { user: new Schema.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalRoundUpAmount: { $sum: '$roundUpValue' },
        totalDonatedAmount: {
          $sum: {
            $cond: ['$processed', '$roundUpValue', 0]
          }
        },
        averageRoundUp: { $avg: '$roundUpValue' },
      }
    },
    {
      $project: {
        _id: 0,
        totalTransactions: 1,
        totalRoundUpAmount: 1,
        totalDonatedAmount: 1,
        averageRoundUp: { $round: ['$averageRoundUp', 2] },
      }
    }
  ]);
};

roundUpTransactionSchema.statics.getCategoryBreakdown = function (userId: string) {
  return this.aggregate([
    { $match: { user: new Schema.Types.ObjectId(userId) } },
    { $unwind: { path: '$category', preserveNullIfEmpty: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        amount: { $sum: '$roundUpValue' },
      }
    },
    { $sort: { amount: -1 } },
    {
      $project: {
        category: { $ifNull: ['$_id', 'Uncategorized'] },
        count: 1,
        amount: { $round: ['$amount', 2] },
        _id: 0,
      }
    }
  ]);
};

roundUpTransactionSchema.statics.getMonthlyBreakdown = function (userId: string) {
  return this.aggregate([
    { $match: { user: new Schema.Types.ObjectId(userId) } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$transactionDate' } },
        totalTransactions: { $sum: 1 },
        totalRoundUpAmount: { $sum: '$roundUpValue' },
        totalDonatedAmount: {
          $sum: {
            $cond: ['$processed', '$roundUpValue', 0]
          }
        },
      }
    },
    { $sort: { _id: -1 } },
    {
      $project: {
        month: '$_id',
        totalTransactions: 1,
        totalRoundUpAmount: { $round: ['$totalRoundUpAmount', 2] },
        totalDonatedAmount: { $round: ['$totalDonatedAmount', 2] },
        _id: 0,
      }
    }
  ]);
};

// Instance methods
roundUpTransactionSchema.methods.markAsProcessed = function (donationId?: string) {
  this.processed = true;
  if (donationId) {
    this.donationId = donationId;
  }
  return this.save();
};

roundUpTransactionSchema.methods.calculateRoundUp = function (amount: number): number {
  const rounded = Math.ceil(amount);
  return parseFloat((rounded - amount).toFixed(2));
};

// Virtual for formatted round-up value
roundUpTransactionSchema.virtual('formattedRoundUp').get(function () {
  return this.roundUpValue.toFixed(2);
});

// Pre-save validation
roundUpTransactionSchema.pre('save', function (next) {
  // Validate round-up value is within allowed range
  if (this.roundUpValue < 0.01 || this.roundUpValue > 0.99) {
    next(new Error('Round-up value must be between 0.01 and 0.99'));
    return;
  }

  // Ensure original amount is positive
  if (this.originalAmount <= 0) {
    next(new Error('Original amount must be positive'));
    return;
  }

  // Ensure transaction type is valid for round-ups
  if (this.transactionType !== 'debit') {
    next(new Error('Only debit transactions are eligible for round-ups'));
    return;
  }

  next();
});

// Text index for searching
roundUpTransactionSchema.index({
  transactionDescription: 'text',
  merchantName: 'text',
});

const RoundUpTransaction = model<RoundUpTransactionDocument>('RoundUpTransaction', roundUpTransactionSchema);

export default RoundUpTransaction;

import { Schema, model, Document } from 'mongoose';
import { IBankConnection, TAccountType, TBankConnectionStatus } from './bankConnection.interface';

type BankConnectionDocument = Document & IBankConnection;

const bankConnectionSchema = new Schema<BankConnectionDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    plaidItemId: {
      type: String,
      required: true,
      unique: true,
    },
    plaidAccessToken: {
      type: String,
      required: true,
      select: false, // Never return in queries by default for security
    },
    institutionId: {
      type: String,
      required: true,
    },
    institutionName: {
      type: String,
      required: true,
    },
    accountId: {
      type: String,
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    accountType: {
      type: String,
      enum: ['depository', 'credit', 'loan', 'investment', 'other'],
      required: true,
    },
    accountSubtype: {
      type: String,
      required: true,
    },
    accountNumber: {
      type: String,
      required: true,
    },
    consentStatus: {
      type: String,
      enum: ['active', 'expired', 'revoked', 'error'],
      default: 'active',
    },
    consentExpiryDate: {
      type: Date,
    },
    webhookUrl: {
      type: String,
    },
    lastSuccessfulUpdate: {
      type: Date,
    },
    errorCode: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    connectedDate: {
      type: Date,
      default: Date.now,
    },
    lastSyncedDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        // Remove sensitive fields when converting to JSON
        delete ret.plaidAccessToken;
        return ret;
      },
    },
  }
);

// Indexes for performance
bankConnectionSchema.index({ user: 1 });
bankConnectionSchema.index({ plaidItemId: 1 });
bankConnectionSchema.index({ consentStatus: 1 });

// Static methods
bankConnectionSchema.statics.findByUser = function (userId: string) {
  return this.find({ user: userId, isActive: true });
};

bankConnectionSchema.statics.findByPlaidItemId = function (plaidItemId: string) {
  return this.findOne({ plaidItemId: plaidItemId });
};

bankConnectionSchema.statics.findActiveConnections = function () {
  return this.find({ consentStatus: 'active', isActive: true });
};

// Instance methods
bankConnectionSchema.methods.updateStatus = function (status: TBankConnectionStatus, errorCode?: string, errorMessage?: string) {
  this.consentStatus = status;
  if (errorCode) this.errorCode = errorCode;
  if (errorMessage) this.errorMessage = errorMessage;
  this.lastSuccessfulUpdate = new Date();
  return this.save();
};

// Pre-save validation
bankConnectionSchema.pre('save', function (next) {
  // Validate account type is a valid Plaid type
  const validAccountTypes: TAccountType[] = ['depository', 'credit', 'loan', 'investment', 'other'];
  if (this.accountType && !validAccountTypes.includes(this.accountType as TAccountType)) {
    next(new Error('Invalid account type'));
    return;
  }

  // Validate consent status
  const validStatuses: TBankConnectionStatus[] = ['active', 'expired', 'revoked', 'error'];
  if (this.consentStatus && !validStatuses.includes(this.consentStatus as TBankConnectionStatus)) {
    next(new Error('Invalid consent status'));
    return;
  }

  next();
});

// Methods to include in queries for sensitive data
bankConnectionSchema.methods.getSensitiveData = function () {
  return this.select('+plaidAccessToken');
};

const BankConnection = model<BankConnectionDocument>('BankConnection', bankConnectionSchema);

export default BankConnection;

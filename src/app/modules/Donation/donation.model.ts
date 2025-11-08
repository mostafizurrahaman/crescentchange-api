import { model, Schema } from 'mongoose';
import { IDonation } from './donation.interface';
import { donationTypeValues, donationStatusValues } from './donation.constant';

const donationSchema = new Schema<IDonation>(
  {
    donor: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Donor is required!'],
      index: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required!'],
      index: true,
    },
    cause: {
      type: Schema.Types.ObjectId,
      ref: 'Cause',
      required: false,
    },
    donationType: {
      type: String,
      required: [true, 'Donation type is required!'],
      enum: {
        values: donationTypeValues,
        message: 'Invalid donation type! Must be one of: one-time, recurring, round-up',
      },
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required!'],
      min: [100, 'Minimum amount is 100 cents ($1.00)'],
      validate: {
        validator: function(value: number) {
          // Amount must be in cents and multiple of 1 cent
          return value > 0 && Number.isInteger(value);
        },
        message: 'Amount must be a positive integer in cents!',
      },
    },
    currency: {
      type: String,
      required: false,
      default: 'USD',
      uppercase: true,
      enum: ['USD'],
    },
    stripePaymentIntentId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
    },
    stripeChargeId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    stripeConnectAccountId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: donationStatusValues,
        message: 'Invalid donation status!',
      },
      default: 'pending',
      index: true,
    },
    donationDate: {
      type: Date,
      required: false,
      default: Date.now,
      index: true,
    },
    specialMessage: {
      type: String,
      required: false,
      maxlength: [500, 'Special message cannot exceed 500 characters!'],
      trim: true,
    },
    scheduledDonationId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledDonation',
      required: false,
    },
    roundUpId: {
      type: Schema.Types.ObjectId,
      ref: 'RoundUp',
      required: false,
    },
    roundUpTransactionIds: [{
      type: Schema.Types.ObjectId,
      ref: 'RoundUpTransaction',
    }],
    receiptGenerated: {
      type: Boolean,
      required: false,
      default: false,
    },
    receiptId: {
      type: Schema.Types.ObjectId,
      ref: 'DonationReceipt',
      required: false,
    },
    pointsEarned: {
      type: Number,
      required: false,
      default: 0,
      validate: {
        validator: function(value: number) {
          return value >= 0 && Number.isInteger(value);
        },
        message: 'Points earned must be a non-negative integer!',
      },
    },
    refundAmount: {
      type: Number,
      required: false,
      validate: {
        validator: function(value: number) {
          if (value !== undefined) {
            return value >= 0 && Number.isInteger(value);
          }
          return true;
        },
        message: 'Refund amount must be a non-negative integer in cents!',
      },
    },
    refundDate: {
      type: Date,
      required: false,
    },
    refundReason: {
      type: String,
      required: false,
      maxlength: [500, 'Refund reason cannot exceed 500 characters!'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        // Convert amount from cents to dollars for API responses
        if (ret.amount) {
          ret.amountInDollars = (ret.amount / 100).toFixed(2);
        }
        if (ret.refundAmount) {
          ret.refundAmountInDollars = (ret.refundAmount / 100).toFixed(2);
        }
        return ret;
      },
    },
  }
);

// Compound indexes for common queries
donationSchema.index({ donor: 1, donationDate: -1 });
donationSchema.index({ organization: 1, donationDate: -1 });
donationSchema.index({ donor: 1, organization: 1 });

// Virtual field for amount in dollars
donationSchema.virtual('amountInDollars').get(function(this: IDonation) {
  return (this.amount / 100).toFixed(2);
});

// Virtual field for refund amount in dollars
donationSchema.virtual('refundAmountInDollars').get(function(this: IDonation) {
  return this.refundAmount ? (this.refundAmount / 100).toFixed(2) : '0.00';
});

// Pre-save middleware to calculate points earned
donationSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('amount')) {
    // Points calculation: $1 USD = 100 points (amount is in cents)
    this.pointsEarned = Math.floor(this.amount / 100);
  }
  next();
});

// Pre-save middleware to handle refund logic
donationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'refunded') {
    if (!this.refundDate) {
      this.refundDate = new Date();
    }
  }
  next();
});

const Donation = model<IDonation>('Donation', donationSchema);

export default Donation;

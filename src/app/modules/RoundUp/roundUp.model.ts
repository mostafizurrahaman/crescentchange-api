import { Schema, model } from 'mongoose';
import {
  ROUNDUP_THRESHOLD_OPTIONS,
  AUTODONATE_TRIGGER_TYPE,
} from '../Donation/donation.constant';
import {
  IRoundUp,
  IRoundUpModel,
} from '../Donation/donation.interface';

const roundUpSchema = new Schema<IRoundUp>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    bankConnection: {
      type: Schema.Types.ObjectId,
      ref: 'BankConnection',
      required: true,
    },
    thresholdAmount: {
      type: Number,
    },
    monthlyLimit: {
      type: Number,
      min: 0,
    },
    autoDonateTrigger: {
      type: {
        type: String,
        enum: AUTODONATE_TRIGGER_TYPE,
        required: true,
      },
      amount: {
        type: Number,
        min: 0,
      },
      days: {
        type: Number,
        default: 30,
        min: 1,
      },
    },
    specialMessage: {
      type: String,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    currentAccumulatedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastDonationDate: {
      type: Date,
    },
    nextAutoDonationDate: {
      type: Date,
    },
    cycleStartDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
roundUpSchema.index({ user: 1, isActive: 1 });
roundUpSchema.index({ organization: 1 });
roundUpSchema.index({ bankConnection: 1, isActive: 1 });
roundUpSchema.index({ nextAutoDonationDate: 1, isActive: 1 });

export const RoundUp = model<IRoundUpModel>('RoundUp', roundUpSchema);

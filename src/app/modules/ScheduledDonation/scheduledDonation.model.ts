import { Schema, model } from 'mongoose';
import {
  RECURRING_FREQUENCY,
  DEFAULT_CURRENCY,
} from '../donation/donation.constant';
import {
  IScheduledDonationModel,
} from '../donation/donation.interface';

const scheduledDonationSchema = new Schema<IScheduledDonationModel>(
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
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be at least 0.01'],
    },
    currency: {
      type: String,
      default: DEFAULT_CURRENCY,
    },
    frequency: {
      type: String,
      enum: RECURRING_FREQUENCY,
      required: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    nextDonationDate: {
      type: Date,
      required: [true, 'Next donation date is required'],
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastExecutedDate: {
      type: Date,
    },
    totalExecutions: {
      type: Number,
      default: 0,
      min: 0,
    },
    causeCategory: {
      type: String,
    },
    specialMessage: {
      type: String,
      maxlength: 500,
    },
    stripeCustomerId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
scheduledDonationSchema.index({ user: 1, isActive: 1 });
scheduledDonationSchema.index({ organization: 1, isActive: 1 });
scheduledDonationSchema.index({ nextDonationDate: 1, isActive: 1 });
scheduledDonationSchema.index({ stripeCustomerId: 1 });

export const ScheduledDonation = model<IScheduledDonationModel>(
  'ScheduledDonation',
  scheduledDonationSchema
);

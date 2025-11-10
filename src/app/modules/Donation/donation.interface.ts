import { Document, Types } from 'mongoose';

export interface IDonation {
  donor: Types.ObjectId;
  organization: Types.ObjectId;
  cause?: Types.ObjectId;
  donationType: 'one-time' | 'recurring' | 'round-up';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  donationDate: Date;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeSessionId?: string;
  stripeCustomerId?: string;
  specialMessage?: string;
  pointsEarned: number;
  connectedAccountId?: string;
  // Additional fields for recurring and round-up donations
  scheduledDonationId?: Types.ObjectId;
  roundUpId?: Types.ObjectId;
  roundUpTransactionIds?: Types.ObjectId[];
  receiptGenerated: boolean;
  receiptId?: Types.ObjectId;
  // New fields for idempotency and payment tracking
  idempotencyKey?: string;
  paymentAttempts?: number;
  lastPaymentAttempt?: Date;
}

// Extended interface for donations with tracking data
export interface IDonationWithTracking extends IDonation {
  paymentAttempts: number;
  lastPaymentAttempt?: Date;
  _id: Types.ObjectId;
}

// Donation service response type
export interface IDonationWithPopulated {
  _id: Types.ObjectId;
  donor: { _id: Types.ObjectId; name: string; email: string };
  organization: { _id: Types.ObjectId; name: string };
  cause?: { _id: Types.ObjectId; name: string; description?: string };
  donationType: 'one-time' | 'recurring' | 'round-up';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  donationDate: Date;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeSessionId?: string;
  stripeCustomerId?: string;
  specialMessage?: string;
  pointsEarned: number;
  connectedAccountId?: string;
  paidAmount?: number;
}

export interface IDonationModel extends IDonation, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ICheckoutSessionRequest {
  amount: number;
  causeId?: string;
  organizationId: string;
  userId: string;
  connectedAccountId?: string;
  specialMessage?: string;
}

// ScheduledDonation interface for recurring donations
export interface IScheduledDonation {
  user: Types.ObjectId;
  organization: Types.ObjectId;
  amount: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate: Date;
  nextDonationDate: Date;
  endDate?: Date;
  isActive: boolean;
  lastExecutedDate?: Date;
  totalExecutions: number;
  causeCategory?: string;
  specialMessage?: string;
  stripeCustomerId?: string;
}

// RoundUp interface
export interface IRoundUp {
  user: Types.ObjectId;
  organization: Types.ObjectId;
  bankConnection: Types.ObjectId;
  thresholdAmount?: number;
  monthlyLimit?: number;
  autoDonateTrigger: {
    type: 'amount' | 'days' | 'both';
    amount?: number;
    days?: number;
  };
  specialMessage?: string;
  isActive: boolean;
  currentAccumulatedAmount: number;
  lastDonationDate?: Date;
  nextAutoDonationDate?: Date;
  cycleStartDate: Date;
}

// Note: IRoundUpTransaction interface is handled by the existing RoundUpTransaction module
// The existing module has a more comprehensive interface with additional fields

// Extended model interfaces
export interface IScheduledDonationModel extends IScheduledDonation, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoundUpModel extends IRoundUp, Document {
  createdAt: Date;
  updatedAt: Date;
}

// Note: IRoundUpTransactionModel is handled by the existing RoundUpTransaction module
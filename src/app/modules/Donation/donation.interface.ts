import { Document, Types } from 'mongoose';
import { DONATION_TYPE, DONATION_STATUS } from './donation.constant';

export type DonationType = typeof DONATION_TYPE[keyof typeof DONATION_TYPE];
export type DonationStatus = typeof DONATION_STATUS[keyof typeof DONATION_STATUS];

// Interface for creating a donation
export interface ICreateDonation {
  donor?: Types.ObjectId | string;
  organization: Types.ObjectId | string;
  cause?: Types.ObjectId | string;
  donationType: DonationType;
  amount: number; // Amount in cents (e.g., 1000 for $10.00)
  currency?: string;
  specialMessage?: string;
  roundUpTransactionIds?: Types.ObjectId[] | string[];
  scheduledDonationId?: Types.ObjectId | string;
}

// Interface for Stripe payment intent creation
export interface ICreatePaymentIntent {
  amount: number;
  currency?: string;
  metadata: {
    donorId: string;
    organizationId: string;
    causeId?: string;
    donationType: string;
  };
  transfer_data?: {
    destination: string; // Stripe Connect account ID
  };
}

// Interface for donation progress statistics
export interface IDonationStats {
  totalDonations: number;
  totalAmount: number; // In cents
  averageAmount: number;
  donationCounts: {
    oneTime: number;
    recurring: number;
    roundUp: number;
  };
  monthlyStats: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
}

// Main donation document interface
export interface IDonation extends Document {
  _id: Types.ObjectId;
  donor: Types.ObjectId;
  organization: Types.ObjectId;
  cause?: Types.ObjectId;
  donationType: DonationType;
  amount: number; // Amount in cents
  currency: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeConnectAccountId: string; // Organization's Stripe Connect account
  status: DonationStatus;
  donationDate: Date;
  specialMessage?: string;
  scheduledDonationId?: Types.ObjectId;
  roundUpId?: Types.ObjectId;
  roundUpTransactionIds?: Types.ObjectId[];
  receiptGenerated: boolean;
  receiptId?: Types.ObjectId;
  pointsEarned: number; // Calculated: amount / 100
  refundAmount?: number; // Amount refunded in cents
  refundDate?: Date;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for donation filter options
export interface IDonationFilters {
  donor?: Types.ObjectId | string;
  organization?: Types.ObjectId | string;
  cause?: Types.ObjectId | string;
  donationType?: DonationType;
  status?: DonationStatus;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fields?: string;
}

// Interface for Stripe webhook event
export interface IStripeWebhookEvent {
  id: string;
  object: string;
  api_version: string;
  created: number;
  type: string;
  data: {
    object: unknown;
  };
}

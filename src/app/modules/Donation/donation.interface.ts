import { Document, Types } from 'mongoose';

export type TDonationType = 'one-time' | 'recurring' | 'round-up';
export type TDonationStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface IDonation extends Document {
  _id: Types.ObjectId;
  donor: Types.ObjectId;
  organization: Types.ObjectId;
  donationType: TDonationType;
  amount: number;
  currency: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  status: TDonationStatus;
  donationDate: Date;
  causeCategory?: string;
  specialMessage?: string;
  scheduledDonationId?: Types.ObjectId;
  roundUpId?: Types.ObjectId;
  roundUpTransactionIds?: Types.ObjectId[];
  receiptGenerated: boolean;
  receiptId?: Types.ObjectId;
  pointsEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

import { model, Schema } from 'mongoose';
import { IDonation } from './donation.interface';

const donationSchema = new Schema<IDonation>(
  {
    donor: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Donor is required!'],
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required!'],
    },
    donationType: {
      type: String,
      enum: ['one-time', 'recurring', 'round-up'],
      required: [true, 'Donation type is required!'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required!'],
      min: [0.01, 'Amount must be at least 0.01'],
    },
    currency: {
      type: String,
      default: 'USD',
    },
    stripePaymentIntentId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    stripeChargeId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    donationDate: {
      type: Date,
      default: Date.now,
    },
    causeCategory: {
      type: String,
    },
    specialMessage: {
      type: String,
    },
    scheduledDonationId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledDonation',
    },
    roundUpId: {
      type: Schema.Types.ObjectId,
      ref: 'RoundUp',
    },
    roundUpTransactionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'RoundUpTransaction',
      },
    ],
    receiptGenerated: {
      type: Boolean,
      default: false,
    },
    receiptId: {
      type: Schema.Types.ObjectId,
      ref: 'DonationReceipt',
    },
    pointsEarned: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, versionKey: false }
);

// Indexes for better query performance
donationSchema.index({ donor: 1, donationDate: -1 });
donationSchema.index({ organization: 1, donationDate: -1 });
donationSchema.index({ status: 1, donationDate: -1 });
donationSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, sparse: true }
);

// Pre-save hook to calculate points earned (1 USD = 100 points)
donationSchema.pre('save', function (next) {
  if (this.isModified('amount') && this.amount) {
    this.pointsEarned = Math.round(this.amount * 100);
  }
  next();
});

const Donation = model<IDonation>('Donation', donationSchema);

export default Donation;

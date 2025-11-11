import { model, Schema, Model } from 'mongoose';
import { IPaymentMethod, IPaymentMethodModel } from './paymentMethod.interface';
import { PAYMENT_METHOD_TYPE } from './paymentMethod.constant';

const paymentMethodSchema = new Schema<IPaymentMethod, Model<IPaymentMethod>>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'Auth',
      required: [true, 'User is required!'],
      index: true,
    },
    stripePaymentMethodId: {
      type: String,
      required: [true, 'Stripe payment method ID is required!'],
      unique: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      required: [true, 'Stripe customer ID is required!'],
      index: true,
    },
    type: {
      type: String,
      enum: ['card'],
      default: 'card',
      required: [true, 'Payment method type is required!'],
    },
    cardBrand: {
      type: String,
      required: [true, 'Card brand is required!'],
    },
    cardLast4: {
      type: String,
      required: [true, 'Card last 4 digits is required!'],
    },
    cardExpMonth: {
      type: Number,
      required: [true, 'Card expiry month is required!'],
    },
    cardExpYear: {
      type: Number,
      required: [true, 'Card expiry year is required!'],
    },
    cardHolderName: {
      type: String,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

// Index for efficient queries
paymentMethodSchema.index({ user: 1, isActive: 1 });
paymentMethodSchema.index({ user: 1, isDefault: 1 });

// Ensure only one default payment method per user
paymentMethodSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other payment methods for this user
    await PaymentMethod.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

const PaymentMethod = model<IPaymentMethod>(
  'PaymentMethod',
  paymentMethodSchema
);

export default PaymentMethod;

import { Document, Types } from 'mongoose';

export interface IPaymentMethod {
  user: Types.ObjectId;
  stripePaymentMethodId: string;
  stripeCustomerId: string;
  type: 'card';
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: number;
  cardExpYear: number;
  cardHolderName?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface IPaymentMethodModel extends IPaymentMethod, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentMethodWithStripeData extends IPaymentMethod {
  stripeData?: {
    id: string;
    customer: string;
    type: string;
    card?: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    };
  };
}

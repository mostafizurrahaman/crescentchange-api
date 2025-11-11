import { Types } from 'mongoose';
import PaymentMethod from './paymentMethod.model';
import { IPaymentMethod } from './paymentMethod.interface';
import { TAddPaymentMethodPayload } from './paymentMethod.validation';
import { AppError } from '../../utils';
import httpStatus from 'http-status';
import { StripeService } from '../Stripe/stripe.service';
import Auth from '../Auth/auth.model';

// 1. Create setup intent for adding card payment method
const createSetupIntent = async (
  userId: string,
  email: string
): Promise<{ client_secret: string; setup_intent_id: string }> => {
  // Validate user exists
  const user = await Auth.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Create setup intent via Stripe (card only)
  const setupIntent = await StripeService.createSetupIntent({
    userId,
    email,
    paymentMethodType: 'card',
  });

  return setupIntent;
};

// 2. Add payment method (after setup intent succeeded)
const addPaymentMethod = async (
  userId: string,
  payload: TAddPaymentMethodPayload
): Promise<IPaymentMethod> => {
  const { stripePaymentMethodId, cardHolderName, isDefault } = payload;

  // Validate user exists
  const user = await Auth.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Get payment method details from Stripe
  const stripePaymentMethod = await StripeService.getPaymentMethod(
    stripePaymentMethodId
  );

  // Get or create Stripe customer
  const stripeCustomer = await StripeService.getOrCreateCustomer(user.email);

  // Attach payment method to customer
  await StripeService.attachPaymentMethod({
    paymentMethodId: stripePaymentMethodId,
    customerId: stripeCustomer.id,
  });

  // Check if payment method already exists
  const existingPaymentMethod = await PaymentMethod.findOne({
    stripePaymentMethodId,
  });

  if (existingPaymentMethod) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This payment method is already added!'
    );
  }

  // Only support card payment methods
  if (stripePaymentMethod.type !== 'card') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only card payment methods are supported!'
    );
  }

  if (!stripePaymentMethod.card) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid card payment method!'
    );
  }

  // Extract payment method details
  const paymentMethodData: Partial<IPaymentMethod> = {
    user: new Types.ObjectId(userId),
    stripePaymentMethodId,
    stripeCustomerId: stripeCustomer.id,
    type: 'card',
    cardBrand: stripePaymentMethod.card.brand,
    cardLast4: stripePaymentMethod.card.last4,
    cardExpMonth: stripePaymentMethod.card.exp_month,
    cardExpYear: stripePaymentMethod.card.exp_year,
    cardHolderName,
    isDefault,
    isActive: true,
  };

  // Create payment method record
  const paymentMethod = new PaymentMethod(paymentMethodData);
  await paymentMethod.save();

  return paymentMethod;
};

// 3. Get user's payment methods
const getUserPaymentMethods = async (
  userId: string,
  includeInactive: boolean = false
): Promise<IPaymentMethod[]> => {
  // Validate user exists
  const user = await Auth.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  const filter: { user: Types.ObjectId; isActive?: boolean } = { 
    user: new Types.ObjectId(userId) 
  };

  if (!includeInactive) {
    filter.isActive = true;
  }

  const paymentMethods = await PaymentMethod.find(filter).sort({
    isDefault: -1,
    createdAt: -1,
  });

  return paymentMethods;
};

// 4. Get payment method by ID
const getPaymentMethodById = async (
  paymentMethodId: string,
  userId: string
): Promise<IPaymentMethod> => {
  const paymentMethod = await PaymentMethod.findOne({
    _id: paymentMethodId,
    user: new Types.ObjectId(userId),
  });

  if (!paymentMethod) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment method not found!');
  }

  return paymentMethod;
};

// 5. Set default payment method
const setDefaultPaymentMethod = async (
  paymentMethodId: string,
  userId: string
): Promise<IPaymentMethod> => {
  // Find payment method
  const paymentMethod = await PaymentMethod.findOne({
    _id: paymentMethodId,
    user: new Types.ObjectId(userId),
  });

  if (!paymentMethod) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment method not found!');
  }

  if (!paymentMethod.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot set inactive payment method as default!'
    );
  }

  // Set as default (pre-save hook will handle removing default from others)
  paymentMethod.isDefault = true;
  await paymentMethod.save();

  return paymentMethod;
};

// 6. Delete payment method
const deletePaymentMethod = async (
  paymentMethodId: string,
  userId: string
): Promise<void> => {
  // Find payment method
  const paymentMethod = await PaymentMethod.findOne({
    _id: paymentMethodId,
    user: new Types.ObjectId(userId),
  });

  if (!paymentMethod) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment method not found!');
  }

  // Detach from Stripe
  try {
    await StripeService.detachPaymentMethod(
      paymentMethod.stripePaymentMethodId
    );
  } catch {
    // Silently fail - payment method will still be marked inactive
    // Error is likely due to Stripe payment method already being detached
  }

  // Mark as inactive instead of deleting
  paymentMethod.isActive = false;
  paymentMethod.isDefault = false;
  await paymentMethod.save();
};

// 7. Get default payment method
const getDefaultPaymentMethod = async (
  userId: string
): Promise<IPaymentMethod | null> => {
  const paymentMethod = await PaymentMethod.findOne({
    user: new Types.ObjectId(userId),
    isDefault: true,
    isActive: true,
  });

  return paymentMethod;
};

// 8. Get Stripe customer ID for user
const getStripeCustomerIdForUser = async (
  userId: string
): Promise<string | null> => {
  const paymentMethod = await PaymentMethod.findOne({
    user: new Types.ObjectId(userId),
    isActive: true,
  }).sort({ createdAt: -1 });

  return paymentMethod ? paymentMethod.stripeCustomerId : null;
};

export const PaymentMethodService = {
  createSetupIntent,
  addPaymentMethod,
  getUserPaymentMethods,
  getPaymentMethodById,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  getDefaultPaymentMethod,
  getStripeCustomerIdForUser,
};

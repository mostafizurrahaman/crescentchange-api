import { Stripe } from 'stripe';
import { stripe } from '../../lib/stripeHelper';
import config from '../../config';
import { AppError } from '../../utils';
import httpStatus from 'http-status';
import {
  ICheckoutSessionRequest,
  ICheckoutSessionResponse,
  IPaymentIntentRequest,
  IPaymentIntentResponse,
} from './stripe.interface';

// 1. Create checkout session for one-time donation
const createCheckoutSession = async (
  payload: ICheckoutSessionRequest
): Promise<ICheckoutSessionResponse> => {
  const {
    amount,
    causeId,
    organizationId,
    userId,
    connectedAccountId,
    specialMessage,
  } = payload;

  // Validate amount is reasonable
  if (amount < 0.01 || amount > 99999.99) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid donation amount!');
  }

  // Create Stripe Checkout Session
  const checkoutSessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    success_url:
      config.stripe.stripeSuccessUrl + `?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.stripe.stripeFailedUrl,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: causeId ? 'Donation for Cause' : 'General Donation',
            description: specialMessage || 'Thank you for your donation!',
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      causeId: causeId || '',
      organizationId,
      userId,
    },
  };

  // Always include payment intent data to ensure metadata transfer to Payment Intent
  checkoutSessionParams.payment_intent_data = {
    metadata: {
      causeId: causeId || '',
      organizationId,
      userId,
      specialMessage: specialMessage || '',
    },
  };

  // Add connected account for transfers if provided
  if (connectedAccountId) {
    checkoutSessionParams.payment_intent_data.transfer_data = {
      destination: connectedAccountId,
    };
  }

  // Create session with error handling
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(checkoutSessionParams);
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create checkout session: ${(error as Error).message}`
    );
  }

  return {
    sessionId: session.id,
    url: session.url!,
  };
};

// 2. Create checkout session with donation record
const createCheckoutSessionWithDonation = async (
  payload: ICheckoutSessionRequest,
  donationId: string
): Promise<ICheckoutSessionResponse> => {
  const {
    amount,
    causeId,
    organizationId,
    userId,
    connectedAccountId,
    specialMessage,
  } = payload;

  // Validate amount is reasonable
  if (amount < 0.01 || amount > 99999.99) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid donation amount!');
  }

  // Create Stripe Checkout Session
  const checkoutSessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    success_url:
      config.stripe.stripeSuccessUrl + `?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.stripe.stripeFailedUrl,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: causeId ? 'Donation for Cause' : 'General Donation',
            description: specialMessage || 'Thank you for your donation!',
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      donationId,
      causeId: causeId || '',
      organizationId,
      userId,
    },
  };

  // Always include payment intent data to ensure metadata transfer to Payment Intent
  checkoutSessionParams.payment_intent_data = {
    metadata: {
      donationId,
      causeId: causeId || '',
      organizationId,
      userId,
      specialMessage: specialMessage || '',
    },
  };

  // Add connected account for transfers if provided
  if (connectedAccountId) {
    checkoutSessionParams.payment_intent_data.transfer_data = {
      destination: connectedAccountId,
    };
  }

  // Create session with error handling
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(checkoutSessionParams);
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create checkout session: ${(error as Error).message}`
    );
  }

  console.log({ session }, { depth: Infinity });

  return {
    sessionId: session.id,
    url: session.url!,
  };
};

// 3. Retrieve checkout session by ID
const retrieveCheckoutSession = async (
  sessionId: string
): Promise<Stripe.Checkout.Session> => {
  if (!sessionId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Session ID is required!');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      `Checkout session not found: ${(error as Error).message}`
    );
  }
};

// 4. Create refund for payment intent
const createRefund = async (
  paymentIntentId: string,
  amount?: number
): Promise<Stripe.Refund> => {
  if (!paymentIntentId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Payment intent ID is required!'
    );
  }

  try {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    // Add amount if specified (partial refund)
    if (amount && amount > 0) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundParams);
    return refund;
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create refund: ${(error as Error).message}`
    );
  }
};

// 5. Create customer
const createCustomer = async (
  email: string,
  name?: string
): Promise<Stripe.Customer> => {
  if (!email) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is required!');
  }

  try {
    const customer = await stripe.customers.create({
      email,
      name,
    });
    return customer;
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create customer: ${(error as Error).message}`
    );
  }
};

// 6. Get payment intent details
const getPaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> => {
  if (!paymentIntentId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Payment intent ID is required!'
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      `Payment intent not found: ${(error as Error).message}`
    );
  }
};

// 7. Create payment intent for one-time donation
const createPaymentIntent = async (
  payload: IPaymentIntentRequest
): Promise<IPaymentIntentResponse> => {
  const {
    amount,
    currency = 'usd',
    donorId,
    organizationId,
    causeId,
    connectedAccountId,
    specialMessage,
  } = payload;

  // Validate amount is reasonable
  if (amount < 0.01 || amount > 99999.99) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid donation amount!');
  }

  // Create Stripe Payment Intent
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    metadata: {
      donorId,
      organizationId,
      causeId: causeId || '',
      specialMessage: specialMessage || '',
    },
    automatic_payment_methods: {
      enabled: true,
    },
  };

  // Add transfer data for connected accounts
  if (connectedAccountId) {
    paymentIntentParams.transfer_data = {
      destination: connectedAccountId,
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams
    );

    return {
      client_secret: paymentIntent.client_secret || '',
      payment_intent_id: paymentIntent.id,
    };
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create payment intent: ${(error as Error).message}`
    );
  }
};

// 8. Verify webhook signature
const verifyWebhookSignature = (body: string, signature: string): any => {
  try {
    const webhookSecret = config.stripe.webhookSecret;

    if (!webhookSecret) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Stripe webhook secret not configured'
      );
    }

    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Webhook signature verification failed: ${(error as Error).message}`
    );
  }
};

export const StripeService = {
  createCheckoutSession,
  createCheckoutSessionWithDonation,
  retrieveCheckoutSession,
  createRefund,
  createCustomer,
  getPaymentIntent,
  createPaymentIntent,
  verifyWebhookSignature,
};

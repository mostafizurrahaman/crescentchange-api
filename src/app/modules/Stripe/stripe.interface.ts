export interface ICheckoutSessionRequest {
  amount: number;
  causeId: string; // Made required
  organizationId: string;
  connectedAccountId?: string;
  specialMessage?: string;
  userId: string;
}

export interface ICheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface IPaymentIntentRequest {
  amount: number;
  currency?: string;
  donorId: string;
  organizationId: string;
  causeId: string; // Made required
  connectedAccountId?: string;
  specialMessage?: string;
}

export interface IPaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
}

export interface IDonationUpdateRequest {
  donationId: string;
  status: 'completed' | 'failed' | 'refunded';
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
}

export interface IStripeWebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>; // Stripe.PaymentIntent | Stripe.Charge
  };
}

export interface ISetupIntentRequest {
  userId: string;
  email: string;
  paymentMethodType?: 'card' | 'ideal' | 'sepa_debit';
}

export interface ISetupIntentResponse {
  client_secret: string;
  setup_intent_id: string;
}

export interface IAttachPaymentMethodRequest {
  paymentMethodId: string;
  customerId: string;
}

export interface ICreatePaymentIntentWithMethodRequest {
  amount: number;
  currency?: string;
  customerId: string;
  paymentMethodId: string;
  donationId: string;
  organizationId: string;
  causeId: string;
  connectedAccountId?: string;
  specialMessage?: string;
}

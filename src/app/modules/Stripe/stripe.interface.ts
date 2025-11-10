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
    object: any; // Stripe.PaymentIntent | Stripe.Charge
  };
}

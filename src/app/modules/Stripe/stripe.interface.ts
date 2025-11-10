export interface ICheckoutSessionRequest {
  amount: number;
  causeId?: string;
  organizationId: string;
  connectedAccountId?: string;
  specialMessage?: string;
  userId: string;
}

export interface ICheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface IDonationUpdateRequest {
  donationId: string;
  status: 'completed' | 'failed' | 'refunded';
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
}

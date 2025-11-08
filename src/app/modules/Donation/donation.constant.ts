export const DONATION_TYPE = {
  ONE_TIME: 'one-time',
  RECURRING: 'recurring',
  ROUND_UP: 'round-up',
} as const;

export const DONATION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export const donationTypeValues = Object.values(DONATION_TYPE);
export const donationStatusValues = Object.values(DONATION_STATUS);

// Points calculation: $1 USD = 100 points
export const POINTS_PER_DOLLAR = 100;

// Stripe webhook events
export const STRIPE_WEBHOOK_EVENTS = {
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed',
  PAYMENT_INTENT_CANCELED: 'payment_intent.canceled',
  CHARGE_DISPUTE_CREATED: 'charge.dispute.created',
  CHARGE_DISPUTE_LOST: 'charge.dispute.lost',
} as const;

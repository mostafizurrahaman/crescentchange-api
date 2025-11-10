export const STRIPE_CURRENCY = {
  USD: 'usd',
  EUR: 'eur',
  GBP: 'gbp',
  AUD: 'aud',
  CAD: 'cad',
} as const;

export const STRIPE_PAYMENT_MODES = {
  PAYMENT: 'payment',
  SUBSCRIPTION: 'subscription',
  SETUP: 'setup',
} as const;

export const DEFAULT_CURRENCY = STRIPE_CURRENCY.USD;

import { Stripe } from 'stripe';
import config from '../config';
import { getStripeCountryCode } from '../config/stripe-countries.config';

/** ISO country of the platform Stripe account (e.g. US). Set via STRIPE_PLATFORM_COUNTRY. */
export const getStripePlatformCountry = (): string =>
  getStripeCountryCode(config.stripe.platformCountry) ||
  config.stripe.platformCountry.toUpperCase();

const normalizeCountry = (country?: string | null): string | undefined => {
  if (!country) return undefined;
  return getStripeCountryCode(country) || country.trim().toUpperCase();
};

/**
 * Cross-border destination charges require `on_behalf_of` so settlement
 * happens in the connected account's country (e.g. AU org, US platform).
 */
export const requiresOnBehalfOfDestinationCharge = (
  connectedAccountCountry?: string | null
): boolean => {
  const connectedCountry = normalizeCountry(connectedAccountCountry);
  if (!connectedCountry) return false;

  const platformCountry = getStripePlatformCountry();
  return connectedCountry !== platformCountry;
};

export interface IDestinationChargeConnectOptions {
  orgStripeAccountId: string;
  connectedAccountCountry?: string | null;
}

/** Apply Connect destination-charge fields to a PaymentIntent create payload. */
export const applyDestinationChargeConnectParams = (
  params: Stripe.PaymentIntentCreateParams,
  applicationFeeAmount: number,
  { orgStripeAccountId, connectedAccountCountry }: IDestinationChargeConnectOptions
): Stripe.PaymentIntentCreateParams => {
  const nextParams: Stripe.PaymentIntentCreateParams = {
    ...params,
    application_fee_amount: applicationFeeAmount,
    transfer_data: {
      destination: orgStripeAccountId,
    },
  };

  if (requiresOnBehalfOfDestinationCharge(connectedAccountCountry)) {
    nextParams.on_behalf_of = orgStripeAccountId;
  }

  return nextParams;
};

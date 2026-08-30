import { Convert } from 'easy-currencies';
import {
  getCurrencyForCountry as getCurrencyForStripeCountry,
  getStripeCountryCode,
  getStripeCurrencyForCountry,
  isSupportedStripeCountry,
  isZeroDecimalStripeCurrency,
  resolveStripeCountry,
  STRIPE_COUNTRY_CODES,
  STRIPE_CONNECT_COUNTRIES,
  STRIPE_SETTLEMENT_CURRENCIES,
  STRIPE_ZERO_DECIMAL_CURRENCIES,
} from '../config/stripe-countries.config';

/** Platform reporting currency — all analytics sum amounts in this unit. */
export const PLATFORM_BASE_CURRENCY = 'USD';

/** Re-export Stripe country registry for API/controllers */
export {
  getStripeCountryCode,
  getStripeCurrencyForCountry,
  isSupportedStripeCountry,
  isZeroDecimalStripeCurrency,
  resolveStripeCountry,
  STRIPE_COUNTRY_CODES,
  STRIPE_CONNECT_COUNTRIES,
  STRIPE_SETTLEMENT_CURRENCIES,
  STRIPE_ZERO_DECIMAL_CURRENCIES,
};

export const normalizeCurrency = (currency?: string | null): string =>
  (currency || PLATFORM_BASE_CURRENCY).trim().toUpperCase();

export const normalizeCountry = (country?: string | null): string =>
  (country || '').trim().toUpperCase();

/**
 * Resolve org charge currency from country (Stripe Connect matrix).
 * Unknown country → USD fallback.
 */
export const getCurrencyForCountry = (country?: string | null): string =>
  getCurrencyForStripeCountry(country);

/** True when GST applies (Australia only for now). */
export const countryAppliesGst = (country?: string | null): boolean => {
  const code = getStripeCountryCode(country);
  return code === 'AU';
};

/**
 * Stripe amount in smallest currency unit (cents), respecting zero-decimal currencies.
 */
export const toStripeAmount = (
  amount: number,
  currency?: string | null
): number => {
  const cur = normalizeCurrency(currency);
  if (isZeroDecimalStripeCurrency(cur)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
};

/** Convert Stripe smallest currency unit back to major units. */
export const fromStripeAmount = (
  amount: number,
  currency?: string | null
): number => {
  const cur = normalizeCurrency(currency);
  if (!Number.isFinite(amount)) return 0;
  if (isZeroDecimalStripeCurrency(cur)) {
    return Number(amount.toFixed(2));
  }
  return Number((amount / 100).toFixed(2));
};

/**
 * Convert amount from `fromCurrency` into platform base (USD).
 */
export const convertToBaseCurrency = async (
  amount: number,
  fromCurrency?: string | null
): Promise<{
  amountBase: number;
  exchangeRate: number;
  baseCurrency: string;
}> => {
  const from = normalizeCurrency(fromCurrency);
  const baseCurrency = PLATFORM_BASE_CURRENCY;

  if (!Number.isFinite(amount)) {
    return { amountBase: 0, exchangeRate: 1, baseCurrency };
  }

  if (from === baseCurrency) {
    return {
      amountBase: Number(amount.toFixed(2)),
      exchangeRate: 1,
      baseCurrency,
    };
  }

  try {
    const converted = await Convert(amount).from(from).to(baseCurrency);
    const amountBase = Number(Number(converted).toFixed(2));
    const exchangeRate =
      amount === 0 ? 1 : Number((amountBase / amount).toFixed(8));

    return { amountBase, exchangeRate, baseCurrency };
  } catch (error) {
    console.error(
      `FX conversion failed (${from} → ${baseCurrency}). Falling back to rate=1.`,
      error
    );
    return {
      amountBase: Number(amount.toFixed(2)),
      exchangeRate: 1,
      baseCurrency,
    };
  }
};

export const applyExchangeRate = (
  amount: number,
  exchangeRate: number
): number => Number((amount * exchangeRate).toFixed(2));

/** Convert between any two ISO currencies (presentment ↔ settlement). */
export const convertBetweenCurrencies = async (
  amount: number,
  fromCurrency?: string | null,
  toCurrency?: string | null
): Promise<number> => {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);

  if (!Number.isFinite(amount)) return 0;
  if (from === to) return Number(amount.toFixed(2));

  try {
    const converted = await Convert(amount).from(from).to(to);
    return Number(Number(converted).toFixed(2));
  } catch (error) {
    console.error(`FX conversion failed (${from} → ${to}).`, error);
    throw error;
  }
};

export const buildBaseMoneyFields = async (input: {
  currency: string;
  amount: number;
  totalAmount: number;
  netAmount: number;
  platformFee?: number;
  gstOnFee?: number;
  stripeFee?: number;
}) => {
  const { amountBase, exchangeRate, baseCurrency } =
    await convertToBaseCurrency(input.amount, input.currency);

  return {
    baseCurrency,
    exchangeRate,
    amountBase,
    totalAmountBase: applyExchangeRate(input.totalAmount, exchangeRate),
    netAmountBase: applyExchangeRate(input.netAmount, exchangeRate),
    platformFeeBase: applyExchangeRate(input.platformFee ?? 0, exchangeRate),
    gstOnFeeBase: applyExchangeRate(input.gstOnFee ?? 0, exchangeRate),
    stripeFeeBase: applyExchangeRate(input.stripeFee ?? 0, exchangeRate),
  };
};

/** Display symbol via Intl (works for all Stripe settlement currencies). */
export const currencySymbol = (currency?: string | null): string => {
  const code = normalizeCurrency(currency);
  try {
    const part = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
};

import { Convert } from 'easy-currencies';

/** Platform reporting currency — all analytics sum amounts in this unit. */
export const PLATFORM_BASE_CURRENCY = 'USD';

/** Supported charge currencies (ISO 4217 uppercase). */
export const SUPPORTED_CURRENCIES = ['USD', 'AUD', 'CAD'] as const;
export type TSupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Map ISO country codes (and common names) → default currency.
 * Stripe Connect country is typically a 2-letter ISO code.
 */
const COUNTRY_TO_CURRENCY: Record<string, TSupportedCurrency> = {
  US: 'USD',
  USA: 'USD',
  'UNITED STATES': 'USD',
  AU: 'AUD',
  AUS: 'AUD',
  AUSTRALIA: 'AUD',
  CA: 'CAD',
  CAN: 'CAD',
  CANADA: 'CAD',
};

export const normalizeCurrency = (currency?: string | null): string =>
  (currency || PLATFORM_BASE_CURRENCY).trim().toUpperCase();

export const normalizeCountry = (country?: string | null): string =>
  (country || '').trim().toUpperCase();

/**
 * Resolve an organization's charge currency from country.
 * Falls back to USD when country is unknown/empty.
 */
export const getCurrencyForCountry = (
  country?: string | null
): TSupportedCurrency => {
  const key = normalizeCountry(country);
  if (!key) return PLATFORM_BASE_CURRENCY;
  return COUNTRY_TO_CURRENCY[key] || PLATFORM_BASE_CURRENCY;
};

/** True when GST (or equivalent platform-fee tax) applies for this country. */
export const countryAppliesGst = (country?: string | null): boolean => {
  const key = normalizeCountry(country);
  return key === 'AU' || key === 'AUS' || key === 'AUSTRALIA';
};

/**
 * Convert amount from `fromCurrency` into platform base (USD).
 * Same-currency → rate 1. Uses easy-currencies (already in the project).
 */
export const convertToBaseCurrency = async (
  amount: number,
  fromCurrency?: string | null
): Promise<{ amountBase: number; exchangeRate: number; baseCurrency: string }> => {
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

/**
 * Apply a locked exchange rate to an amount (for fee fields after rate is known).
 */
export const applyExchangeRate = (
  amount: number,
  exchangeRate: number
): number => Number((amount * exchangeRate).toFixed(2));

/**
 * Build base-currency money snapshot from original-currency financials.
 * Call once at payment time and persist — do not recompute on read.
 */
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

export const currencySymbol = (currency?: string | null): string => {
  switch (normalizeCurrency(currency)) {
    case 'AUD':
      return 'A$';
    case 'CAD':
      return 'C$';
    case 'USD':
    default:
      return '$';
  }
};

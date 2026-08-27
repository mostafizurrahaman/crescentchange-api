import config from '../../config';
import {
  PLATFORM_BASE_CURRENCY,
  countryAppliesGst,
} from '../../utils/currency.utils';

export const DONATION_STATUS = [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'canceled',
  'refunding',
  'renewed',
] as const;

export const DONATION_TYPE = ['one-time', 'recurring', 'round-up'] as const;

/** @deprecated Prefer PLATFORM_BASE_CURRENCY — kept for existing imports */
export const DEFAULT_CURRENCY = PLATFORM_BASE_CURRENCY;

// Recurring donation frequency options
export const RECURRING_FREQUENCY = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
] as const;

// Round-up threshold options
export const ROUNDUP_THRESHOLD_OPTIONS = [
  '10',
  '20',
  '25',
  '40',
  '50',
  'custom',
  'none',
] as const;

// Auto donate trigger types
export const AUTODONATE_TRIGGER_TYPE = ['amount', 'days', 'both'] as const;

// Bank account status
export const BANK_ACCOUNT_STATUS = [
  'active',
  'login_required',
  'disconnected',
] as const;

export const REFUND_WINDOW_DAYS = config.paymentSetting.clearingPeriodDays;

export const monthAbbreviations = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

export type TFeeCountryOptions = {
  /** Org country — GST applied only for AU */
  country?: string | null;
};

/**
 * Calculate donation fees for the org's country.
 *
 * Logic:
 * 1. Donation itself is GST-Free.
 * 2. Platform Fee attracts GST only for AU orgs.
 * 3. Stripe Fee is always paid by the donor (added on top).
 * 4. coverFees determines if Platform Fee (+ GST) are added on top or deducted.
 */
export const calculateDonationFees = (
  baseAmount: number,
  coverFees: boolean,
  options: TFeeCountryOptions = {}
) => {
  const platformFeePercent =
    Number(config.paymentSetting.platformFeePercent) || 0.05;
  const gstRate = countryAppliesGst(options.country)
    ? Number(config.paymentSetting.gstPercentage) || 0.1
    : 0;
  const stripeFeePercent =
    Number(config.paymentSetting.stripeFeePercent) || 0.029;
  const stripeFixedFee = Number(config.paymentSetting.stripeFixedFee) || 0.3;

  const platformFee = Number((baseAmount * platformFeePercent).toFixed(2));
  const gstOnFee = Number((platformFee * gstRate).toFixed(2));
  const applicationFee = platformFee + gstOnFee;

  let totalCharge = 0;
  let stripeFee = 0;
  let netToOrg = 0;

  if (coverFees) {
    const numerator = baseAmount + applicationFee + stripeFixedFee;
    const denominator = 1 - stripeFeePercent;
    totalCharge = Number((numerator / denominator).toFixed(2));

    stripeFee = Number(
      (totalCharge * stripeFeePercent + stripeFixedFee).toFixed(2)
    );

    netToOrg = Number((totalCharge - stripeFee - applicationFee).toFixed(2));
  } else {
    const numerator = baseAmount + stripeFixedFee;
    const denominator = 1 - stripeFeePercent;
    totalCharge = Number((numerator / denominator).toFixed(2));

    stripeFee = Number(
      (totalCharge * stripeFeePercent + stripeFixedFee).toFixed(2)
    );

    netToOrg = Number((totalCharge - stripeFee - applicationFee).toFixed(2));
  }

  const platformFeeWithStripe = Number((stripeFee + applicationFee).toFixed(2));

  return {
    baseAmount,
    platformFee,
    gstOnFee,
    stripeFee,
    totalCharge,
    applicationFee,
    netToOrg,
    coverFees,
    platformFeeWithStripe,
  };
};

/** @deprecated Use calculateDonationFees — kept so existing call sites keep compiling during migration */
export const calculateAustralianFees = (
  baseAmount: number,
  coverFees: boolean,
  options: TFeeCountryOptions = {}
) => calculateDonationFees(baseAmount, coverFees, options);

/**
 * Get current GST rate as a percentage string
 */
export const getTaxRateDisplay = (): string => {
  const gstRate = Number(config.paymentSetting.gstPercentage) || 0.1;
  return `${(gstRate * 100).toFixed(0)}%`;
};

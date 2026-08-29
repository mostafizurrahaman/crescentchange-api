import { calculateDonationFees } from '../modules/Donation/donation.constant';
import {
  currencySymbol,
  getCurrencyForCountry,
  normalizeCurrency,
} from './currency.utils';

export interface IOrganizationDonationPricingInput {
  /** Donation base amount — always in organization currency */
  amount: number;
  coverFees: boolean;
  organizationCountry?: string | null;
  organizationDefaultCurrency?: string | null;
}

export interface IOrganizationDonationPricing {
  organizationCurrency: string;
  baseAmount: number;
  platformFee: number;
  gstOnFee: number;
  stripeFee: number;
  totalCharge: number;
  applicationFee: number;
  netToOrg: number;
  coverFees: boolean;
}

export const resolveOrganizationChargeCurrency = (
  organizationCountry?: string | null,
  organizationDefaultCurrency?: string | null
): string =>
  normalizeCurrency(
    organizationDefaultCurrency || getCurrencyForCountry(organizationCountry)
  );

/** UI helper — show org currency beside amounts on frontend. */
export const buildOrganizationCurrencyDisplay = (currency: string) => {
  const organizationCurrency = normalizeCurrency(currency);
  return {
    organizationCurrency,
    currencySymbol: currencySymbol(organizationCurrency),
    stripeCurrency: organizationCurrency.toLowerCase(),
    amountLabel: organizationCurrency,
  };
};

/** UI + API metadata for an organization record. */
export const getOrganizationCurrencyMeta = (organization: {
  country?: string | null;
  defaultCurrency?: string | null;
}) =>
  buildOrganizationCurrencyDisplay(
    resolveOrganizationChargeCurrency(
      organization.country,
      organization.defaultCurrency
    )
  );

/**
 * Donation pricing in organization currency only.
 * Organizations always receive charges/settlement in their local currency.
 */
export const buildOrganizationDonationPricing = (
  input: IOrganizationDonationPricingInput
): IOrganizationDonationPricing => {
  const organizationCurrency = resolveOrganizationChargeCurrency(
    input.organizationCountry,
    input.organizationDefaultCurrency
  );

  const financials = calculateDonationFees(input.amount, input.coverFees, {
    country: input.organizationCountry,
  });

  return {
    organizationCurrency,
    baseAmount: financials.baseAmount,
    platformFee: financials.platformFee,
    gstOnFee: financials.gstOnFee,
    stripeFee: financials.stripeFee,
    totalCharge: financials.totalCharge,
    applicationFee: financials.platformFeeWithStripe,
    netToOrg: financials.netToOrg,
    coverFees: financials.coverFees,
  };
};

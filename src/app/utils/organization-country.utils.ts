import httpStatus from 'http-status';
import AppError from './AppError';
import {
  getStripeCountryCode,
  resolveStripeCountry,
} from '../config/stripe-countries.config';
import { StripeAccount } from '../modules/OrganizationAccount/stripe-account.model';

export const resolveOrganizationCountryFields = (input: string) => {
  const resolved = resolveStripeCountry(input);
  if (!resolved) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Country is not supported for Stripe Connect on this platform.'
    );
  }

  return {
    country: resolved.countryCode,
    defaultCurrency: resolved.currency,
  };
};

export const normalizeOrganizationCountryCode = (
  country?: string | null
): string | undefined => {
  if (!country) return undefined;
  return getStripeCountryCode(country) ?? country.toUpperCase();
};

export const isOrganizationCountryLocked = async (
  organizationId: string
): Promise<boolean> => {
  const stripeAccount = await StripeAccount.findOne({
    organization: organizationId,
  })
    .select('_id')
    .lean();

  return !!stripeAccount;
};

export const assertOrganizationCountryMutable = async (
  organizationId: string,
  currentCountry: string | undefined,
  nextCountry: string | undefined
) => {
  if (nextCountry === undefined) return;

  const currentCode = normalizeOrganizationCountryCode(currentCountry);
  const nextCode = normalizeOrganizationCountryCode(nextCountry);

  if (currentCode && nextCode && currentCode === nextCode) return;

  const locked = await isOrganizationCountryLocked(organizationId);
  if (locked) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Country and currency cannot be changed after Stripe Connect onboarding has started.'
    );
  }
};

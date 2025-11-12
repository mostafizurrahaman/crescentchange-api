import httpStatus from 'http-status';
import { AppError } from '../../utils';
import Organization from './organization.model';
import Auth from '../Auth/auth.model';
import { StripeService } from '../Stripe/stripe.service';

/**
 * Start Stripe Connect onboarding for an organization
 * Creates a Stripe Connect account and returns onboarding URL
 */
const startStripeConnectOnboarding = async (
  userId: string
): Promise<{ onboardingUrl: string; accountId: string }> => {
  // Find user
  const user = await Auth.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Find organization
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Organization not found! Only organizations can onboard for payment receiving.'
    );
  }

  // Check if already has Stripe Connect account
  if (organization.stripeConnectAccountId) {
    // Account exists, create new onboarding link
    const { onboardingUrl } = await StripeService.createAccountLink(
      organization.stripeConnectAccountId
    );

    return {
      onboardingUrl,
      accountId: organization.stripeConnectAccountId,
    };
  }

  // Create new Stripe Connect account
  const { accountId, onboardingUrl } = await StripeService.createConnectAccount(
    user.email,
    organization.name || 'Organization',
    'US' // You can make this configurable
  );

  // Save account ID to organization
  organization.stripeConnectAccountId = accountId;
  await organization.save();

  return {
    onboardingUrl,
    accountId,
  };
};

/**
 * Get Stripe Connect account status
 */
const getStripeConnectStatus = async (
  userId: string
): Promise<{
  hasAccount: boolean;
  accountId?: string;
  isActive: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> => {
  // Find organization
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Organization not found!'
    );
  }

  // Check if has Stripe Connect account
  if (!organization.stripeConnectAccountId) {
    return {
      hasAccount: false,
      isActive: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  // Fetch account details from Stripe
  try {
    const account = await StripeService.getConnectAccount(
      organization.stripeConnectAccountId
    );

    return {
      hasAccount: true,
      accountId: account.id,
      isActive: account.charges_enabled && account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to fetch Stripe Connect account status: ${(error as Error).message}`
    );
  }
};

/**
 * Refresh Stripe Connect onboarding link
 */
const refreshStripeConnectOnboarding = async (
  userId: string
): Promise<{ onboardingUrl: string }> => {
  // Find organization
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Organization not found!'
    );
  }

  if (!organization.stripeConnectAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No Stripe Connect account found! Please start onboarding first.'
    );
  }

  // Create new account link
  const { onboardingUrl } = await StripeService.createAccountLink(
    organization.stripeConnectAccountId
  );

  return { onboardingUrl };
};

export const OrganizationService = {
  startStripeConnectOnboarding,
  getStripeConnectStatus,
  refreshStripeConnectOnboarding,
};
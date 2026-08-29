import { Stripe } from 'stripe';
import { stripe } from '../../lib/stripeHelper';
import {
  StripeAccount,
  TStripeAccountStatus,
} from './stripe-account.model';
import { IStripeAccount } from './stripe-account.interface';

const capabilityIsActive = (capability: unknown): boolean => {
  if (!capability) return false;
  if (typeof capability === 'string') return capability === 'active';
  if (typeof capability === 'object' && capability !== null && 'status' in capability) {
    return (capability as { status?: string }).status === 'active';
  }
  return false;
};

/** Resolve charge flag — Stripe dashboard capability can be active before top-level flag syncs. */
export const resolveChargesEnabled = (account: Stripe.Account): boolean =>
  Boolean(
    account.charges_enabled ||
      capabilityIsActive(account.capabilities?.card_payments)
  );

/** Resolve payout flag — align DB with Stripe Connect capabilities dashboard. */
export const resolvePayoutsEnabled = (account: Stripe.Account): boolean =>
  Boolean(
    account.payouts_enabled ||
      capabilityIsActive(account.capabilities?.transfers)
  );

export const deriveStripeAccountStatus = (
  account: Stripe.Account
): TStripeAccountStatus => {
  const requirements = account.requirements;
  const chargesEnabled = resolveChargesEnabled(account);
  const payoutsEnabled = resolvePayoutsEnabled(account);

  if (requirements?.disabled_reason) return 'rejected';
  if (chargesEnabled && payoutsEnabled) return 'active';
  if ((requirements?.currently_due || []).length > 0) return 'restricted';
  if (account.details_submitted) return 'pending';
  return 'pending';
};

export const buildStripeAccountSyncPayload = (account: Stripe.Account) => {
  const chargesEnabled = resolveChargesEnabled(account);
  const payoutsEnabled = resolvePayoutsEnabled(account);

  return {
    status: deriveStripeAccountStatus(account),
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted: account.details_submitted ?? false,
    requirements: {
      currently_due: account.requirements?.currently_due || [],
      eventually_due: account.requirements?.eventually_due || [],
      disabled_reason: account.requirements?.disabled_reason || null,
    },
  };
};

/**
 * Pull latest Connect account state from Stripe and persist to MongoDB.
 * Call on status checks, onboarding refresh, and before payout/charge guards.
 */
export const syncStripeAccountFromStripe = async (
  stripeAccountId: string
): Promise<IStripeAccount | null> => {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const syncPayload = buildStripeAccountSyncPayload(account);

  return StripeAccount.findOneAndUpdate(
    { stripeAccountId },
    { $set: syncPayload },
    { new: true }
  );
};

export const syncStripeAccountForOrganization = async (
  organizationId: string
): Promise<IStripeAccount | null> => {
  const stripeAccount = await StripeAccount.findOne({
    organization: organizationId,
  }).lean();

  if (!stripeAccount?.stripeAccountId) return null;

  return syncStripeAccountFromStripe(stripeAccount.stripeAccountId);
};

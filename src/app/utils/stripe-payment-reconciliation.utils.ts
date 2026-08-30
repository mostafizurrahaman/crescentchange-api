import Stripe from 'stripe';
import { stripe } from '../lib/stripeHelper';
import {
  buildBaseMoneyFields,
  fromStripeAmount,
  normalizeCurrency,
} from './currency.utils';

export type ReconciledDonationAmounts = {
  amount: number;
  totalAmount: number;
  stripeFee: number;
  platformFee: number;
  gstOnFee: number;
  netAmount: number;
  applicationFeeAmount: number;
  currency: string;
  stripeChargeId: string;
  stripeBalanceTransactionId?: string;
  stripeTransferId?: string;
  baseCurrency: string;
  exchangeRate: number;
  amountBase: number;
  totalAmountBase: number;
  netAmountBase: number;
  platformFeeBase: number;
  gstOnFeeBase: number;
  stripeFeeBase: number;
};

const parseMetadataAmount = (
  metadata: Stripe.Metadata,
  key: string,
  fallback = 0
): number => {
  const raw = metadata[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
};

const resolveCharge = async (
  paymentIntent: Stripe.PaymentIntent
): Promise<Stripe.Charge> => {
  const { latest_charge: latestCharge } = paymentIntent;

  if (latestCharge && typeof latestCharge === 'object') {
    return latestCharge;
  }

  const chargeId =
    typeof latestCharge === 'string'
      ? latestCharge
      : typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : null;

  if (!chargeId) {
    throw new Error(
      `PaymentIntent ${paymentIntent.id} has no charge to reconcile`
    );
  }

  return stripe.charges.retrieve(chargeId, {
    expand: ['balance_transaction', 'transfer'],
  });
};

const getBalanceTransaction = (
  charge: Stripe.Charge
): Stripe.BalanceTransaction | null => {
  const { balance_transaction: balanceTransaction } = charge;
  if (balanceTransaction && typeof balanceTransaction === 'object') {
    return balanceTransaction;
  }
  return null;
};

const logAmountVariance = (
  paymentIntentId: string,
  field: string,
  estimated: number,
  actual: number
) => {
  const delta = Number((actual - estimated).toFixed(2));
  if (Math.abs(delta) < 0.01) return;

  console.warn(
    `[Stripe reconcile] ${paymentIntentId} ${field}: estimated=${estimated.toFixed(2)} actual=${actual.toFixed(2)} delta=${delta.toFixed(2)}`
  );
};

/**
 * Pull actual charge / fee / transfer amounts from Stripe and map them onto
 * donation financial fields. Platform fee + GST stay from PI metadata (business
 * rules); Stripe processing fee and org net come from balance transactions.
 */
export const reconcileDonationFromStripePaymentIntent = async (
  paymentIntentId: string,
  metadata: Stripe.Metadata = {},
  existing?: {
    amount?: number;
    totalAmount?: number;
    stripeFee?: number;
    platformFee?: number;
    gstOnFee?: number;
    netAmount?: number;
    currency?: string;
  }
): Promise<ReconciledDonationAmounts> => {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge.balance_transaction', 'latest_charge.transfer'],
  });

  const charge = await resolveCharge(paymentIntent);
  const currency = normalizeCurrency(paymentIntent.currency);
  const connectedAccountId = metadata.destinationAccount || undefined;

  const totalAmount = fromStripeAmount(paymentIntent.amount, currency);
  const applicationFeeAmount = fromStripeAmount(
    paymentIntent.application_fee_amount ??
      charge.application_fee_amount ??
      0,
    currency
  );

  const amount =
    parseMetadataAmount(metadata, 'baseAmount', existing?.amount ?? 0) ||
    existing?.amount ||
    0;
  const platformFee = parseMetadataAmount(
    metadata,
    'platformFee',
    existing?.platformFee ?? 0
  );
  const gstOnFee = parseMetadataAmount(
    metadata,
    'gstOnFee',
    existing?.gstOnFee ?? 0
  );

  let stripeFee = 0;
  let netAmount = 0;
  let stripeBalanceTransactionId: string | undefined;
  let stripeTransferId: string | undefined;

  const transfer =
    charge.transfer && typeof charge.transfer === 'object'
      ? charge.transfer
      : null;

  if (transfer) {
    stripeTransferId = transfer.id;
    netAmount = fromStripeAmount(transfer.amount, currency);
  }

  if (connectedAccountId) {
    try {
      const connectedCharge = await stripe.charges.retrieve(
        charge.id,
        { expand: ['balance_transaction'] },
        { stripeAccount: connectedAccountId }
      );
      const connectedBalanceTxn = getBalanceTransaction(connectedCharge);
      if (connectedBalanceTxn) {
        stripeBalanceTransactionId = connectedBalanceTxn.id;
        stripeFee = fromStripeAmount(connectedBalanceTxn.fee, currency);
        netAmount = fromStripeAmount(connectedBalanceTxn.net, currency);
      }
    } catch (error) {
      console.warn(
        `[Stripe reconcile] Could not load connected-account charge for ${paymentIntentId}:`,
        (error as Error).message
      );
    }
  }

  if (!stripeFee) {
    const platformBalanceTxn = getBalanceTransaction(charge);
    if (platformBalanceTxn) {
      stripeBalanceTransactionId ??= platformBalanceTxn.id;
      stripeFee = fromStripeAmount(platformBalanceTxn.fee, currency);
    }
  }

  if (!stripeFee) {
    stripeFee = parseMetadataAmount(
      metadata,
      'stripeFee',
      existing?.stripeFee ?? 0
    );
  }

  if (!netAmount) {
    netAmount = parseMetadataAmount(
      metadata,
      'netToOrg',
      existing?.netAmount ?? 0
    );
  }

  if (!netAmount && totalAmount > 0) {
    if (applicationFeeAmount > 0) {
      netAmount = Number((totalAmount - applicationFeeAmount).toFixed(2));
    } else if (stripeFee > 0) {
      netAmount = Number(
        (totalAmount - stripeFee - platformFee - gstOnFee).toFixed(2)
      );
    }
  }

  const estimatedTotal = parseMetadataAmount(
    metadata,
    'totalAmount',
    existing?.totalAmount ?? totalAmount
  );
  const estimatedStripeFee = parseMetadataAmount(
    metadata,
    'stripeFee',
    existing?.stripeFee ?? stripeFee
  );
  const estimatedNet = parseMetadataAmount(
    metadata,
    'netToOrg',
    existing?.netAmount ?? netAmount
  );

  logAmountVariance(paymentIntentId, 'totalAmount', estimatedTotal, totalAmount);
  logAmountVariance(
    paymentIntentId,
    'stripeFee',
    estimatedStripeFee,
    stripeFee
  );
  logAmountVariance(paymentIntentId, 'netAmount', estimatedNet, netAmount);

  const baseFields = await buildBaseMoneyFields({
    currency,
    amount,
    totalAmount,
    netAmount,
    platformFee,
    gstOnFee,
    stripeFee,
  });

  return {
    amount,
    totalAmount,
    stripeFee,
    platformFee,
    gstOnFee,
    netAmount,
    applicationFeeAmount,
    currency,
    stripeChargeId: charge.id,
    stripeBalanceTransactionId,
    stripeTransferId,
    ...baseFields,
  };
};

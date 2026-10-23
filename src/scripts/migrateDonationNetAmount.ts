/**
 * Migration: Correct netAmount on existing donations.
 *
 * Problem:
 * During Stripe reconciliation, `transfer.amount` (gross charge) was previously
 * assigned to `netAmount`, causing donations with `coverFees: true` to have
 * `netAmount = totalAmount` instead of the base `amount`.
 *
 * Fix:
 * 1. If `coverFees === true` and `amount > 0`:
 *    `netAmount` should be `amount`.
 *    `netAmountBase` should be `amountBase` (or `applyExchangeRate(amount, exchangeRate)`).
 * 2. If `coverFees === false` and `netAmount === totalAmount` with fees > 0:
 *    `netAmount = Number(Math.max(0, totalAmount - (platformFee || 0) - (gstOnFee || 0) - (stripeFee || 0)).toFixed(2))`.
 *    `netAmountBase = applyExchangeRate(netAmount, exchangeRate)`.
 *
 * Usage:
 *   npx ts-node src/scripts/migrateDonationNetAmount.ts
 */
import mongoose from 'mongoose';
import config from '../app/config';
import Donation from '../app/modules/Donation/donation.model';
import { applyExchangeRate } from '../app/utils/currency.utils';

const migrate = async () => {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.dbUrl);
  console.log('Connected.\n');

  const donations = await Donation.find({});
  console.log(`Found ${donations.length} total donations to inspect.`);

  let updatedCount = 0;

  for (const donation of donations) {
    let correctedNet: number | null = null;
    const isCoverFees = Boolean(donation.coverFees);
    const amount = Number(donation.amount) || 0;
    const totalAmount = Number(donation.totalAmount) || 0;
    const currentNet = Number(donation.netAmount) || 0;
    const platformFee = Number(donation.platformFee) || 0;
    const gstOnFee = Number(donation.gstOnFee) || 0;
    const stripeFee = Number(donation.stripeFee) || 0;
    const exchangeRate = Number(donation.exchangeRate) || 1;

    if (isCoverFees && amount > 0) {
      if (currentNet !== amount) {
        correctedNet = amount;
      }
    } else if (!isCoverFees && totalAmount > 0) {
      const expectedNet = Number(
        Math.max(0, totalAmount - platformFee - gstOnFee - stripeFee).toFixed(2)
      );
      if (currentNet === totalAmount && (platformFee > 0 || stripeFee > 0 || gstOnFee > 0)) {
        correctedNet = expectedNet;
      }
    }

    if (correctedNet !== null && correctedNet !== currentNet) {
      console.log(
        `Fixing donation ${donation._id} (${donation.donationType}): netAmount ${currentNet} -> ${correctedNet} (amount: ${amount}, total: ${totalAmount}, coverFees: ${isCoverFees})`
      );
      donation.netAmount = correctedNet;
      donation.netAmountBase = applyExchangeRate(correctedNet, exchangeRate);
      await donation.save();
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} donations.`);
  console.log('Done.');
  await mongoose.disconnect();
};

migrate().catch(async (err) => {
  console.error('Migration failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});

/**
 * Backfill multi-currency base fields on existing documents.
 *
 * Existing data is treated as already in USD (platform base):
 *   exchangeRate = 1
 *   amountBase = amount
 *
 * Usage:
 *   npx ts-node src/scripts/backfillCurrencyBase.ts
 */
import mongoose from 'mongoose';
import config from '../app/config';
import Donation from '../app/modules/Donation/donation.model';
import Organization from '../app/modules/Organization/organization.model';
import {
  PLATFORM_BASE_CURRENCY,
  getCurrencyForCountry,
} from '../app/utils/currency.utils';

const backfill = async () => {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.dbUrl);
  console.log('Connected.\n');

  // 1. Organizations → defaultCurrency from country
  const orgs = await Organization.find({}).select('_id country defaultCurrency');
  let orgUpdated = 0;
  for (const org of orgs) {
    const currency = getCurrencyForCountry(org.country);
    if (org.defaultCurrency !== currency) {
      org.defaultCurrency = currency;
      await org.save();
      orgUpdated++;
    }
  }
  console.log(`Organizations updated: ${orgUpdated}/${orgs.length}`);

  // 2. Donations missing amountBase (or amountBase === 0 with amount > 0)
  const donationResult = await Donation.updateMany(
    {
      $or: [
        { amountBase: { $exists: false } },
        { amountBase: null },
        { amountBase: 0, amount: { $gt: 0 } },
      ],
    },
    [
      {
        $set: {
          baseCurrency: PLATFORM_BASE_CURRENCY,
          exchangeRate: 1,
          currency: {
            $toUpper: { $ifNull: ['$currency', PLATFORM_BASE_CURRENCY] },
          },
          amountBase: '$amount',
          totalAmountBase: '$totalAmount',
          netAmountBase: '$netAmount',
          platformFeeBase: { $ifNull: ['$platformFee', 0] },
          gstOnFeeBase: { $ifNull: ['$gstOnFee', 0] },
          stripeFeeBase: { $ifNull: ['$stripeFee', 0] },
        },
      },
    ]
  );

  console.log(`Donations backfilled: ${donationResult.modifiedCount}`);
  console.log('\nDone. Safe to exit.');
  await mongoose.disconnect();
};

backfill().catch(async (err) => {
  console.error('Backfill failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});

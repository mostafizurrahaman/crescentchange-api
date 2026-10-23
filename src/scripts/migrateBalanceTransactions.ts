/**
 * Migration: Sync BalanceTransaction amount with corrected donation.netAmount
 */
import mongoose from 'mongoose';
import config from '../app/config';
import { BalanceTransaction } from '../app/modules/Balance/balance.model';
import Donation from '../app/modules/Donation/donation.model';

const migrate = async () => {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.dbUrl);
  console.log('Connected.\n');

  const transactions = await BalanceTransaction.find({ donation: { $exists: true, $ne: null } });
  console.log(`Found ${transactions.length} balance transactions with donations.`);

  let updatedCount = 0;

  for (const tx of transactions) {
    const donation = await Donation.findById(tx.donation);
    if (!donation) continue;

    const currentAmount = Number(tx.amount) || 0;
    const expectedAmount = Number(donation.netAmount) || 0;

    if (currentAmount !== expectedAmount) {
      console.log(
        `Fixing BalanceTransaction ${tx._id}: amount ${currentAmount} -> ${expectedAmount} (Donation ${donation._id})`
      );
      tx.amount = expectedAmount;
      await tx.save();
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} balance transactions.`);
  console.log('Done.');
  await mongoose.disconnect();
};

migrate().catch(async (err) => {
  console.error('Migration failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});

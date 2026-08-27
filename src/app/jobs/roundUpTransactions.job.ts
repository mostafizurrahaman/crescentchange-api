import cron from 'node-cron';
import mongoose from 'mongoose';
import {
  RoundUpModel,
  IRoundUpDocument,
} from '../modules/RoundUp/roundUp.model';
import { roundUpService } from '../modules/RoundUp/roundUp.service';
import { roundUpTransactionService } from '../modules/RoundUpTransaction/roundUpTransaction.service';
import { cronJobTracker } from './cronJobTracker';
import { StripeService } from '../modules/Stripe/stripe.service';
import { RoundUpTransactionModel } from '../modules/RoundUpTransaction/roundUpTransaction.model';
import Donation from '../modules/Donation/donation.model';
import { calculateDonationFees } from '../modules/Donation/donation.constant'; // ✅ Fixed Import
import { IAuth } from '../modules/Auth/auth.interface';
import Client from '../modules/Client/client.model';
import {
  buildBaseMoneyFields,
  getCurrencyForCountry,
  normalizeCurrency,
} from '../utils/currency.utils';
import { OrganizationModel } from '../modules/Organization/organization.model';
import { StripeAccount } from '../modules/OrganizationAccount/stripe-account.model';
import { AppError } from '../utils';

interface IPopulatedRoundUpConfig extends Omit<IRoundUpDocument, 'user'> {
  user: IAuth;
}

/**
 * RoundUp Transactions Cron Job
 */

let isProcessing = false; // Prevents overlapping executions
const JOB_NAME = 'roundup-transactions-main';
/**
 * Triggers end-of-month donations for users who have an accumulated balance
 */
const processEndOfMonthDonations = async () => {
  console.log('\n🎯 Checking for end-of-month donations to process...');

  // Find users with a balance from the previous month who are ready for donation
  const configsForDonation = await RoundUpModel.find<IPopulatedRoundUpConfig>({
    isActive: true,
    enabled: true,
    status: 'pending',
    currentMonthTotal: { $gt: 0 },
  }).populate('user');

  if (configsForDonation.length === 0) {
    console.log(' No users with pending balances for month-end processing.');
    return { processed: 0, success: 0, failed: 0 };
  }

  console.log(
    `📊 Found ${configsForDonation.length} user(s) for month-end donation processing.`
  );

  let successCount = 0;
  let failureCount = 0;

  for (const config of configsForDonation) {
    const userId = config.user._id.toString();
    if (!userId) {
      failureCount++;
      console.log(
        `   ⏭️ Skipping config ${config._id}: Invalid user reference.`
      );
      continue;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const totalAmount = config.currentMonthTotal;
      const coverFees = config.coverFees || false;

      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthStr = String(lastMonth.getMonth() + 1).padStart(2, '0');
      const year = lastMonth.getFullYear();

      // ✅ Fetch Organization to get Stripe Connect ID + currency
      const organizationDoc = await OrganizationModel.findById(
        config.organization
      ).session(session);

      if (!organizationDoc) {
        throw new Error(`Organization ${config.organization} not found!`);
      }

      const currency = normalizeCurrency(
        organizationDoc.defaultCurrency ||
          getCurrencyForCountry(organizationDoc.country)
      );

      //  Calculate Fees (country-aware)
      const financials = calculateDonationFees(totalAmount, coverFees, {
        country: organizationDoc.country,
      });
      const applicationFee = financials.platformFeeWithStripe;
      const baseMoney = await buildBaseMoneyFields({
        currency,
        amount: financials.baseAmount,
        totalAmount: financials.totalCharge,
        netAmount: financials.netToOrg,
        platformFee: financials.platformFee,
        gstOnFee: financials.gstOnFee,
        stripeFee: financials.stripeFee,
      });

      console.log(
        `   Initiating month-end donation of ${totalAmount} ${currency} for user ${userId}...`
      );
      console.log(
        `   Base Amount: ${financials.baseAmount.toFixed(2)} ${currency}`
      );
      console.log(
        `   Total Charged: ${financials.totalCharge.toFixed(2)} ${currency}`
      );

      const stripeAccount = await StripeAccount.findOne({
        organization: organizationDoc._id,
        status: 'active',
      });

      if (!stripeAccount) {
        throw new Error('Stripe Account either not connected or exist!');
      }

      // Get all processed transactions for this round-up config for the month
      const monthTransactions = await RoundUpTransactionModel.find({
        roundUp: config._id,
        user: userId,
        status: 'processed',
        stripePaymentIntentId: { $in: [null, undefined] },
        transactionDate: {
          $gte: new Date(year, lastMonth.getMonth(), 1),
          $lt: new Date(year, lastMonth.getMonth() + 1, 1),
        },
      });

      if (monthTransactions.length === 0) {
        console.warn(
          `   ⚠️ No transactions found for RoundUp ${config._id} in ${monthStr}/${year}`
        );
        await session.abortTransaction();
        await session.endSession();
        failureCount++;
        continue;
      }

      // Find Client by auth ID
      const donor = await Client.findOne({ auth: userId }).session(session);
      if (!donor?._id) {
        console.error(
          `   ❌ Donor not found for user ${userId} in RoundUp ${config._id}`
        );
        await session.abortTransaction();
        await session.endSession();
        failureCount++;
        continue;
      }

      // STEP 1: Create Donation record
      const [donation] = await Donation.create(
        [
          {
            donor: donor._id,
            organization: config.organization,
            cause: config.cause,
            donationType: 'round-up',

            //  Store Financial Breakdown
            amount: financials.baseAmount,
            coverFees: financials.coverFees,
            platformFee: financials.platformFee,
            gstOnFee: financials.gstOnFee,
            stripeFee: financials.stripeFee,
            netAmount: financials.netToOrg,
            totalAmount: financials.totalCharge,

            currency,
            ...baseMoney,
            status: 'pending',
            donationDate: new Date(),
            specialMessage:
              config.specialMessage ||
              `Automatic monthly round-up for ${monthStr}/${year}`,
            pointsEarned: Math.round(baseMoney.amountBase * 100),
            roundUpId: config._id,
            roundUpTransactionIds: monthTransactions.map((t) => t._id),
            receiptGenerated: false,
            metadata: {
              userId: String(userId),
              roundUpId: String(config._id),
              month: `${year}-${monthStr}`,
              year: year.toString(),
              type: 'roundup_donation',
              isMonthEnd: true,
              transactionCount: monthTransactions.length,
            },
          },
        ],
        { session }
      );

      console.log(`   ✅ Donation record created: ${donation._id}`);

      // STEP 2: Create Stripe PaymentIntent (Destination Charge)
      const paymentResult = await StripeService.createRoundUpPaymentIntent({
        roundUpId: String(config._id),
        userId: String(userId),
        charityId: String(config.organization),
        causeId: String(config.cause),

        amount: financials.baseAmount,
        totalAmount: financials.totalCharge,
        currency: currency.toLowerCase(),

        // Destination Charge
        applicationFee: applicationFee,

        // Financial Breakdown Metadata
        coverFees: financials.coverFees,
        platformFee: financials.platformFee,
        gstOnFee: financials.gstOnFee,
        stripeFee: financials.stripeFee,
        netToOrg: financials.netToOrg,

        month: `${year}-${monthStr}`,
        year: year,
        specialMessage: `Automatic monthly round-up for ${monthStr}/${year}`,
        donationId: String(donation._id),
        paymentMethodId: config.paymentMethod as string,
      });

      // STEP 3: Update Donation to PROCESSING
      const donationDoc = donation.toObject();
      await Donation.findByIdAndUpdate(
        donation._id,
        {
          status: 'processing',
          stripePaymentIntentId: paymentResult.payment_intent_id,
          metadata: {
            ...(donationDoc.metadata || {}),
            paymentInitiatedAt: new Date(),
          },
        },
        { session }
      );

      // STEP 4: Update RoundUp config
      config.status = 'processing';
      config.lastDonationAttempt = new Date();
      config.currentMonthTotal = 0; // Reset balance for the new month
      config.lastMonthReset = new Date();
      await config.save({ session });

      // STEP 5: Update transactions
      await RoundUpTransactionModel.updateMany(
        {
          roundUp: config._id,
          _id: { $in: monthTransactions.map((t) => t._id) },
        },
        {
          stripePaymentIntentId: paymentResult.payment_intent_id,
          donation: donation._id,
          donationAttemptedAt: new Date(),
        },
        { session }
      );

      await session.commitTransaction();
      console.log(
        `   ✅ Month-end donation initiated for RoundUp ${config._id}`
      );
      successCount++;
    } catch (error) {
      try {
        await session.abortTransaction();
      } catch {
        // session may already be aborted
      }
      failureCount++;
      console.error(
        `❌ Error processing month-end donation for RoundUp ${config._id}:`,
        error
      );
      await config.markAsFailed('Month-end donation trigger failed');
    } finally {
      await session.endSession();
    }
  }

  return {
    processed: configsForDonation.length,
    success: successCount,
    failed: failureCount,
  };
};

export const startRoundUpProcessingCron = () => {
  const monthEndSchedule = '0 */4 1 * *';
  cron.schedule(monthEndSchedule, async () => {
    console.log('🗓️ 1st of Month: Running RoundUp cleanup and reset...');

    try {
      // STEP 1: Process donations for anyone who didn't hit the threshold last month
      const donationResults = await processEndOfMonthDonations();
      console.log('📤 Month-End Donation Results:', donationResults);

      // STEP 2: Reset Statuses for the NEW Month
      const resetResult = await RoundUpModel.updateMany(
        {
          isActive: true,
          status: { $in: ['completed', 'failed'] },
        },
        {
          $set: {
            status: 'pending',
            currentMonthTotal: 0,
            lastMonthReset: new Date(),
          },
        }
      );

      console.log(
        `✅ Reset ${resetResult.modifiedCount} users to pending for the new month.`
      );
    } catch (error) {
      console.error('❌ Month-end cleanup failed:', error);
    }
  });
};

// // corn
// export const startRoundUpProcessingCron = () => {
//   const schedule = '0 */4 * * *'; // Every 4 hours

//   console.log('\n====================================================');
//   console.log('🔧 Initializing RoundUp Cron Job...');
//   console.log(`⏰ Cron Schedule: ${schedule}`);
//   console.log('====================================================\n');

//   cronJobTracker.registerJob(JOB_NAME, schedule);
//   cronJobTracker.setJobStatus(JOB_NAME, true);

//   const job = cron.schedule(schedule, async () => {
//     console.log('\n====================================================');
//     console.log('🚀 Cron Job Triggered');
//     console.log(`🕒 Trigger Time: ${new Date().toLocaleString()}`);
//     console.log('====================================================');

//     if (isProcessing) {
//       console.log('⏭️ Job skipped — previous run still in progress.');
//       return;
//     }

//     isProcessing = true;
//     const startTime = Date.now();
//     cronJobTracker.startExecution(JOB_NAME);

//     console.log('⚙️ Starting RoundUp Transaction Sync & Processing...');

//     try {
//       // Step 1
//       const today = new Date();
//       console.log('\n📌 Step 1: Month-End Donation Check');

//       if (today.getDate() === 1) {
//         console.log(
//           '🗓️ First of the month: Resetting all completed round-ups to pending...'
//         );
//         await RoundUpModel.updateMany(
//           { status: { $in: ['completed', 'failed'] } },
//           { $set: { status: 'pending', currentMonthTotal: 0 } }
//         );
//       }
//       if (today.getDate() === 1) {
//         console.log(
//           '🗓️ Today is the 1st → Processing end-of-month donations...'
//         );
//         const donationResults = await processEndOfMonthDonations();
//         console.log('📤 Month-End Donation Results:', donationResults);
//       } else {
//         console.log('✔️ Not the 1st — skipping month-end donations.');
//       }

//       // Step 2
//       console.log('\n📌 Step 2: Fetching Active Round-Up Configurations...');
//       const activeRoundUpConfigs =
//         await RoundUpModel.find<IPopulatedRoundUpConfig>({
//           isActive: true,
//           enabled: true,
//           bankConnection: { $ne: null },
//         }).populate('user');

//       console.log(`🔎 Found ${activeRoundUpConfigs.length} active users.`);

//       if (activeRoundUpConfigs.length === 0) {
//         console.log('✔️ No active round-ups detected.');
//         isProcessing = false;
//         cronJobTracker.completeExecution(JOB_NAME, {
//           totalProcessed: 0,
//           successCount: 0,
//           failureCount: 0,
//         });
//         return;
//       }

//       let successCount = 0;
//       let failureCount = 0;

//       for (const config of activeRoundUpConfigs) {
//         console.log('\n----------------------------------------------------');
//         console.log(`👤 Processing user: ${config.user?._id}`);
//         console.log('----------------------------------------------------');

//         if (config.status === 'processing') {
//           console.log(
//             '⏭️ Skipped — donation already processing for this user.'
//           );
//           continue;
//         }

//         const userId = config.user._id.toString();
//         const bankConnectionId = config.bankConnection.toString();

//         console.log(`🔗 User ID: ${userId}`);
//         console.log(`🏦 Bank Connection: ${bankConnectionId}`);

//         if (!userId || !bankConnectionId) {
//           console.log('❌ Invalid user/bank reference — skipping user.');
//           failureCount++;
//           continue;
//         }

//         try {
//           console.log('🔄 Syncing transactions from Plaid...');
//           const syncResult = await roundUpService.syncTransactions(
//             String(userId),
//             String(bankConnectionId),
//             {}
//           );

//           const newTransactions = syncResult.data?.plaidSync?.added || [];
//           console.log(`📥 Transactions Synced: ${newTransactions.length}`);

//           if (newTransactions.length === 0) {
//             console.log('ℹ️ No new transactions found.');
//             successCount++;
//             continue;
//           }

//           console.log('⚙️ Processing new transactions...');
//           const processingResult =
//             await roundUpTransactionService.processTransactionsFromPlaid(
//               String(userId),
//               String(bankConnectionId),
//               newTransactions
//             );

//           console.log('📤 Transaction Processing Result:', processingResult);

//           if (processingResult.thresholdReached) {
//             console.log(
//               `🎯 Donation Triggered! Amount: $${processingResult.thresholdReached.amount}`
//             );
//           }

//           successCount++;
//         } catch (error) {
//           console.log('❌ ERROR during processing for user:', userId);
//           console.error(error);
//           failureCount++;
//         }
//       }

//       const duration = ((Date.now() - startTime) / 1000).toFixed(2);
//       console.log('\n====================================================');
//       console.log('📊 RoundUp Sync & Processing Summary');
//       console.log('====================================================');
//       console.log(`👥 Total Users Processed: ${activeRoundUpConfigs.length}`);
//       console.log(`✅ Successful: ${successCount}`);
//       console.log(`❌ Failed: ${failureCount}`);
//       console.log(`⏱️ Duration: ${duration}s`);
//       console.log('====================================================\n');

//       cronJobTracker.completeExecution(JOB_NAME, {
//         totalProcessed: activeRoundUpConfigs.length,
//         successCount,
//         failureCount,
//       });
//     } catch (error: unknown) {
//       console.log('\n❌ CRITICAL ERROR IN CRON JOB');
//       console.error(error);

//       const errorMessage =
//         error instanceof Error ? error.message : 'Unknown error';
//       cronJobTracker.failExecution(JOB_NAME, errorMessage);
//     } finally {
//       console.log('🏁 Cron job cycle completed.\n');
//       isProcessing = false;
//     }
//   });

//   job.start();
//   console.log('✅ RoundUp Cron Job started successfully.\n');
//   return job;
// };

// Manual trigger
export const manualTriggerRoundUpProcessing = async (): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
}> => {
  console.log('\n🔧 Manual RoundUp Sync Triggered...');
  if (isProcessing) {
    console.log('⏭️ Manual trigger skipped — already processing.');
    return {
      success: false,
      data: { message: 'Processing already in progress' },
    };
  }

  isProcessing = true;
  cronJobTracker.startExecution(JOB_NAME);

  try {
    console.log('📌 Checking month-end donation condition...');
    const today = new Date();
    if (today.getDate() === 1) {
      console.log(
        '🗓️ Today is the 1st → Running end-of-month donation handler.'
      );
      await processEndOfMonthDonations();
    }

    console.log('🔄 Fetching active round-up configurations...');
    const activeRoundUpConfigs =
      await RoundUpModel.find<IPopulatedRoundUpConfig>({
        isActive: true,
        enabled: true,
        bankConnection: { $ne: null },
      }).populate('user');
    console.log(`👥 Found ${activeRoundUpConfigs.length} active configs.`);

    if (activeRoundUpConfigs.length === 0) {
      console.log('✔️ No active round-ups available.');
      isProcessing = false;
      cronJobTracker.completeExecution(JOB_NAME, {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
      });
      return {
        success: true,
        data: { message: 'No active round-ups to sync' },
      };
    }

    let successCount = 0;
    let failureCount = 0;

    for (const config of activeRoundUpConfigs) {
      console.log('\n----------------------------------------------------');
      console.log(`👤 Processing user: ${config.user?._id}`);
      console.log('----------------------------------------------------');

      if (config.status === 'processing') {
        console.log('⏭️ Already processing — skipping.');
        continue;
      }

      const userId = config.user._id.toString();
      const bankConnectionId = config.bankConnection.toString();

      if (!userId || !bankConnectionId) {
        console.log('❌ Invalid user/bank reference.');
        failureCount++;
        continue;
      }

      try {
        console.log('🔄 Syncing user transactions...');
        const syncResult = await roundUpService.syncTransactions(
          String(userId),
          String(bankConnectionId),
          {}
        );

        const newTransactions = syncResult.data?.plaidSync?.added || [];

        console.log(`📥 Synced Transactions: ${newTransactions.length}`);

        if (newTransactions.length === 0) {
          console.log('ℹ️ No new transactions.');
          successCount++;
          continue;
        }

        console.log('⚙️ Processing transactions...');
        await roundUpTransactionService.processTransactionsFromPlaid(
          String(userId),
          String(bankConnectionId),
          newTransactions
        );

        console.log('✔️ Processing completed.');
        successCount++;
      } catch (error) {
        console.log('❌ Error while syncing/processing this user.');
        console.error(error);
        failureCount++;
      }
    }

    console.log('\n====================================================');
    console.log('📊 Manual Sync Summary');
    console.log('====================================================');
    console.log(`👥 Total Users: ${activeRoundUpConfigs.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log('====================================================\n');

    cronJobTracker.completeExecution(JOB_NAME, {
      totalProcessed: activeRoundUpConfigs.length,
      successCount,
      failureCount,
    });

    return {
      success: true,
      data: {
        totalProcessed: activeRoundUpConfigs.length,
        successCount,
        failureCount,
      },
    };
  } catch (error: unknown) {
    console.log('❌ Manual Trigger Critical Error');
    console.error(error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    cronJobTracker.failExecution(JOB_NAME, errorMessage);

    return {
      success: false,
      data: { error: errorMessage },
    };
  } finally {
    console.log('🏁 Manual trigger completed.\n');
    isProcessing = false;
  }
};

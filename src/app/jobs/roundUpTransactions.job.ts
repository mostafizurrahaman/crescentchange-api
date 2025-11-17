import cron from 'node-cron';
import { Types } from 'mongoose';
import { roundUpService } from '../modules/RoundUp/roundUp.service';
import { RoundUpModel } from '../modules/RoundUp/roundUp.model';
import { cronJobTracker } from './cronJobTracker';
import { roundUpTransactionService } from '../modules/RoundUpTransaction/roundUpTransaction.service';
import { RoundUpTransactionModel } from '../modules/RoundUpTransaction/roundUpTransaction.model';
import { Donation } from '../modules/donation/donation.model';

/**
 * RoundUp Transactions Cron Job
 *
 * Automatically syncs transactions and processes round-ups for all active users.
 * This replaces the manual API-triggered approach with true automation.
 *
 * Schedule: '0 *\/4 * * *' = Every 4 hours at minute 0
 * Examples: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
 */

let isProcessing = false; // Prevent overlapping executions

const JOB_NAME = 'roundup-transactions';

/**
 * Check and process monthly donations for round-ups that have reached their threshold
 */
const processMonthlyDonations = async (allConfigs: any[] = []) => {
  console.log('\n🎯 Checking for monthly donations ready to process...');

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = now.getFullYear();
  console.log({
    allConfigs,
  });

  // Filter out configs with null user or organization
  const validConfigs = allConfigs.filter(
    (config) => config.user && config.organization
  );

  console.log({ validConfigs });

  // Find round-ups ready for donation processing
  const readyForDonation = validConfigs.filter((config) => {
    return (
      config.status === 'completed' &&
      config.currentMonthTotal >= config.monthlyThreshold &&
      config.enabled
    );
  });

  console.log({
    readyForDonation,
  });

  if (readyForDonation.length === 0) {
    console.log('✅ No round-ups ready for monthly donation processing');
    return { processed: 0, success: 0, failed: 0 };
  }

  console.log(
    `📊 Found ${readyForDonation.length} round-up(s) ready for donation processing`
  );

  let successCount = 0;
  let failureCount = 0;

  // Process each ready round-up
  for (const roundUpConfig of readyForDonation) {
    // Extract user ID safely
    const configUserId = (roundUpConfig.user as any)?._id || roundUpConfig.user;
    const roundUpId = String(roundUpConfig._id);

    // Skip if user ID is still invalid
    if (!configUserId) {
      console.log(
        `⏭️  Skipping round-up ${roundUpId} - invalid user reference`
      );
      failureCount++;
      continue;
    }

    try {
      // Check if donation already processed for this month
      const existingDonation = await Donation.findOne({
        roundUpId,
        donationType: 'round-up',
        donationDate: {
          $gte: new Date(`${currentYear}-${currentMonth}-01`),
          $lt: new Date(
            `${currentYear}-${currentMonth}-${new Date(
              currentYear,
              parseInt(currentMonth),
              0
            ).getDate()}`
          ),
        },
      });

      if (existingDonation) {
        console.log(
          `⏭️  Donation already processed for round-up ${roundUpId} this month`
        );
        continue;
      }

      // Get processed transactions for current month
      const processedTransactions =
        await roundUpTransactionService.getTransactions({
          user: configUserId,
          bankConnection: roundUpConfig.bankConnection,
          status: 'processed',
          month: currentMonth,
          year: currentYear,
        });

      if (processedTransactions.length === 0) {
        console.log(
          `⏭️  No processed transactions found for round-up ${roundUpId}`
        );
        continue;
      }

      // Calculate total donation amount
      const totalAmount = processedTransactions.reduce(
        (sum: number, transaction: any) => sum + transaction.roundUpAmount,
        0
      );

      // Process donation using roundUpService.processMonthlyDonation
      const donationResult = await roundUpService.processMonthlyDonation(
        configUserId,
        {
          roundUpId,
          specialMessage: `Automatic round-up donation - ${currentMonth}/${currentYear}`,
        }
      );

      if (donationResult.success) {
        successCount++;
        console.log(
          `✅ Monthly donation processed successfully for round-up ${roundUpId}`
        );
        console.log(`   Amount: $${totalAmount}`);
        console.log(`   Transactions: ${processedTransactions.length}`);
      } else {
        failureCount++;
        console.log(
          `❌ Monthly donation processing failed for round-up ${roundUpId}:`
        );
        console.log(`   Error: ${donationResult.message}`);
      }
    } catch (error) {
      failureCount++;
      console.error(
        `❌ Error processing monthly donation for round-up ${roundUpId}:`,
        error
      );
    }
  }

  console.log(`\n📊 Monthly donation processing summary:`);
  console.log(`   Total ready: ${readyForDonation.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);

  return {
    processed: readyForDonation.length,
    success: successCount,
    failed: failureCount,
  };
};

export const startRoundUpProcessingCron = () => {
  // Run every 4 hours to check for new transactions

  const schedule = '*/3 * * * *'; // Every 10 minutes

  // Register job with tracker
  cronJobTracker.registerJob(JOB_NAME, schedule);
  cronJobTracker.setJobStatus(JOB_NAME, true);

  // Calculate next run time
  const getNextRunTime = () => {
    const now = new Date();
    const nextRun = new Date(now);

    const interval = 3; // 3 minutes

    // Round current time up to the next 3-minute boundary
    const nextMinute = Math.ceil(now.getMinutes() / interval) * interval;

    nextRun.setMinutes(nextMinute, 0, 0);

    // If the calculated time is not ahead, push by 3 minutes
    if (nextRun <= now) {
      nextRun.setMinutes(nextRun.getMinutes() + interval);
    }

    return nextRun.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  console.log('🔄 RoundUp Transactions Cron Job initialized');
  console.log(`   Schedule: ${schedule} (Every 10 minutes)`);
  console.log(
    `   Started at: ${new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    })}`
  );
  console.log(`   Next run: ${getNextRunTime()}`);

  const job = cron.schedule(schedule, async () => {
    // Prevent overlapping executions
    if (isProcessing) {
      console.log(
        '⏭️  Skipping RoundUp processing - previous run still in progress'
      );
      return;
    }

    isProcessing = true;
    const startTime = Date.now();

    // Start tracking execution
    cronJobTracker.startExecution(JOB_NAME);

    // Calculate next run time
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setMinutes(Math.ceil(now.getMinutes() / 10) * 10, 0, 0);
    if (nextRun <= now) {
      nextRun.setMinutes(nextRun.getMinutes() + 10);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔄 Starting RoundUp Transactions Processing');
    console.log(
      `   Current Time: ${now.toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      })}`
    );
    console.log(
      `   Next Run: ${nextRun.toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      })}`
    );
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Get all active round-up configurations with populated user and bankConnection
      const activeRoundUpConfigs = await RoundUpModel.find({
        isActive: true,
        enabled: true,
        bankConnection: { $ne: null }, // Must have bank connection
      })
        .populate('user')
        .populate('bankConnection');

      console.log({
        activeRoundUpConfigs,
      });

      console.log(
        `📊 Found ${activeRoundUpConfigs.length} active round-up configuration(s)`
      );

      if (activeRoundUpConfigs.length === 0) {
        console.log('✅ No active round-ups to process');
        return;
      }

      // Filter out configs with null user or bankConnection
      const validConfigs = activeRoundUpConfigs.filter(
        (config) => config.user && config.bankConnection
      );

      console.log('Valid Config', { depth: Infinity });
      console.log(
        'Valid Config',
        {
          user: validConfigs[0].user,
        },
        { depth: Infinity }
      );

      console.log(
        `📊 Found ${validConfigs.length} valid round-up configuration(s) after filtering`
      );

      if (validConfigs.length === 0) {
        console.log(
          '✅ No valid round-ups to process (all have missing references)'
        );
        return;
      }

      // Track execution statistics
      let successCount = 0;
      let failureCount = 0;
      let thresholdReachedCount = 0;
      let totalCount = 0;

      console.log(`📦 Processing round-ups for all active users`);

      // BEST PRACTICE: Process in parallel with Promise.allSettled
      const results = await Promise.allSettled(
        validConfigs.map(async (roundUpConfig) => {
          // Extract user ID safely
          const userId = (roundUpConfig.user as any)?._id || roundUpConfig.user;
          const bankConnectionId =
            (roundUpConfig.bankConnection as any)?._id ||
            roundUpConfig.bankConnection;

          // Skip if user or bank connection is still invalid
          if (!userId || !bankConnectionId) {
            console.log(`⏭️  Skipping round-up with invalid references`);
            return {
              userId,
              success: false,
              error: 'Invalid user or bank connection reference',
            };
          }

          console.log(`\n📝 Processing round-up for user: ${userId}`);
          console.log(`   Bank Connection: ${bankConnectionId}`);
          console.log(`   Current Total: $${roundUpConfig.currentMonthTotal}`);
          console.log(
            `   Monthly Threshold: ${roundUpConfig.monthlyThreshold}`
          );

          try {
            // Sync transactions and process round-ups
            const syncResult = await roundUpService.syncTransactions(
              String(userId),
              String(bankConnectionId),
              {} // Don't pass cursor to let service use stored cursor or undefined
            );

            console.log(syncResult);

            console.log(`✅ Sync completed for user ${userId}`);
            console.log(
              `   Note: RoundUp processing is handled automatically by background cron job`
            );
            console.log(
              `   Bank transactions synced: ${
                syncResult.data?.plaidSync?.added?.length || 0
              } new transactions`
            );
            console.log(
              `   Has More: ${syncResult.data?.plaidSync?.hasMore || false}`
            );

            return {
              userId,
              success: true,
              syncResult,
              thresholdReached: false, // Individual threshold checking is handled by webhooks, not sync
            };
          } catch (error) {
            console.error(
              `❌ Failed to process round-up for user ${userId}:`,
              error
            );
            return {
              userId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      // Process results and collect configs for donation processing
      const allReturnedConfigs: any[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successCount++;
          // Note: Individual threshold tracking is removed - handled by webhook system
        } else {
          failureCount++;
          const errorMessage = result.reason?.message || 'Unknown error';
          console.error(`❌ RoundUp processing failed:`, errorMessage);
        }
      });

      // Process monthly donations after all transaction syncs are complete
      const donationResults = await processMonthlyDonations(validConfigs);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📊 RoundUp Sync & Donation Summary');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`   Total Users Processed: ${validConfigs.length}`);
      console.log(`   ✅ Transaction Syncs Successful: ${successCount}`);
      console.log(`   ❌ Transaction Syncs Failed: ${failureCount}`);
      console.log(
        `   🎯 Monthly Donations Processed: ${donationResults.processed}`
      );
      console.log(`   ✅ Donations Successful: ${donationResults.success}`);
      console.log(`   ❌ Donations Failed: ${donationResults.failed}`);
      console.log(`   📊 Total Transactions Synced: ${validConfigs.length}`);
      console.log(`   ⏱️  Duration: ${duration}s`);
      console.log('═══════════════════════════════════════════════════════\n');

      // Complete tracking execution
      cronJobTracker.completeExecution(JOB_NAME, {
        totalProcessed: validConfigs.length,
        successCount,
        failureCount,
        errors: [],
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('❌ Critical error in RoundUp processing cron job:');
      console.error(error);

      // Mark execution as failed
      cronJobTracker.failExecution(JOB_NAME, err.message || 'Unknown error');
    } finally {
      isProcessing = false;
    }
  });

  // Start the cron job
  job.start();
  console.log('✅ RoundUp Transactions Cron Job started successfully\n');

  return job;
};

/**
 * Manual trigger for testing/debugging RoundUp processing
 * Can be called via API endpoint or console
 */
export const manualTriggerRoundUpProcessing = async (
  userId?: string,
  options?: { syncTransactions?: boolean; processDonations?: boolean }
) => {
  console.log('🔧 Manually triggering RoundUp processing...');

  const { syncTransactions = true, processDonations = true } = options || {};

  if (isProcessing) {
    console.log('⏭️  Cannot trigger - RoundUp processing already in progress');
    return { success: false, message: 'Processing already in progress' };
  }

  isProcessing = true;
  const startTime = Date.now();

  try {
    let query: any = {
      isActive: true,
      bankConnection: { $ne: null },
    };

    // If specific user provided, limit to their config
    if (userId) {
      query.user = userId;
    }

    // Get all active round-up configurations with populated references
    const activeRoundUpConfigs = await RoundUpModel.find(query)
      .populate('user')
      .populate('bankConnection');

    console.log({ activeRoundUpConfigs });

    console.log(
      `Found ${activeRoundUpConfigs.length} active round-up configurations to process`
    );

    // Filter out configs with null user or bankConnection
    const validConfigs = activeRoundUpConfigs.filter(
      (config) => config.user && config.bankConnection
    );

    console.log({ validConfigs });

    console.log(
      `Found ${validConfigs.length} valid round-up configurations after filtering`
    );

    const results: any = {
      transactionSync: { success: 0, failed: 0, details: [] },
      donationProcessing: { processed: 0, success: 0, failed: 0 },
      totalProcessed: validConfigs.length,
    };

    // Step 1: Sync transactions (if requested)
    if (syncTransactions) {
      console.log('\n📊 Step 1: Syncing transactions...');
      const syncProcessResults = await Promise.allSettled(
        validConfigs.map(async (roundUpConfig) => {
          // Extract user ID safely
          const configUserId =
            (roundUpConfig.user as any)?._id || roundUpConfig.user;
          const bankConnectionId =
            (roundUpConfig.bankConnection as any)?._id ||
            roundUpConfig.bankConnection;

          console.log();

          // Skip if user or bank connection is invalid
          if (!configUserId || !bankConnectionId) {
            return {
              success: false,
              userId: configUserId,
              error: 'Invalid user or bank connection reference',
            };
          }

          const syncResult = await roundUpService.syncTransactions(
            String(configUserId),
            String(bankConnectionId),
            {} // Don't pass cursor to let service use stored cursor or undefined
          );

          return {
            success: true,
            userId: configUserId,
            bankConnectionId,
            result: syncResult,
          };
        })
      );

      // Process sync results
      syncProcessResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.transactionSync.success++;
          results.transactionSync.details.push({
            success: true,
            userId: result.value.userId,
            result: result.value.result,
          });
        } else {
          results.transactionSync.failed++;
          results.transactionSync.details.push({
            success: false,
            userId: result.reason?.userId || null,
            error: result.reason?.message || 'Unknown error',
          });
        }
      });

      console.log(
        `Transaction sync completed: ${results.transactionSync.success} success, ${results.transactionSync.failed} failed`
      );
    }

    // Step 2: Process monthly donations (if requested)
    if (processDonations) {
      console.log('\n🎯 Step 2: Processing monthly donations...');

      // Filter onlyEnabled configurations for donation processing
      const enabledConfigsForDonation = validConfigs.filter(
        (config) => config.enabled
      );

      const donationResults = await processMonthlyDonations(
        enabledConfigsForDonation
      );
      results.donationProcessing = donationResults;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 Manual RoundUp Processing Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Total Configurations: ${results.totalProcessed}`);

    if (syncTransactions) {
      console.log(
        `   📊 Transaction Syncs: ${results.transactionSync.success} success, ${results.transactionSync.failed} failed`
      );
    }

    if (processDonations) {
      console.log(
        `   🎯 Monthly Donations: ${results.donationProcessing.processed} processed, ${results.donationProcessing.success} success, ${results.donationProcessing.failed} failed`
      );
    }

    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log('═══════════════════════════════════════════════════════\n');

    return {
      success: true,
      summary: results,
      message: 'Manual RoundUp processing completed',
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in manual RoundUp processing trigger:', error);
    return { success: false, error: err.message };
  } finally {
    isProcessing = false;
  }
};

export const mostafizTriggerRoundUpDonation = async () => {
  // Prevent overlapping executions
  if (isProcessing) {
    console.log(
      '⏭️  Skipping RoundUp processing - previous run still in progress'
    );
    return;
  }

  isProcessing = true;
  const startTime = Date.now();

  // Start tracking execution
  cronJobTracker.startExecution(JOB_NAME);

  // Calculate next run time
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setMinutes(Math.ceil(now.getMinutes() / 10) * 10, 0, 0);
  if (nextRun <= now) {
    nextRun.setMinutes(nextRun.getMinutes() + 10);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔄 Starting RoundUp Transactions Processing');
  console.log(
    `   Current Time: ${now.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    })}`
  );
  console.log(
    `   Next Run: ${nextRun.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    })}`
  );
  console.log('═══════════════════════════════════════════════════════');

  try {
    // Get all active round-up configurations with populated user and bankConnection
    const activeRoundUpConfigs = await RoundUpModel.find({
      isActive: true,
      enabled: true,
      bankConnection: { $ne: null }, // Must have bank connection
    })
      .populate('user')
      .populate('bankConnection');

    console.log({
      activeRoundUpConfigs,
    });

    console.log(
      `📊 Found ${activeRoundUpConfigs.length} active round-up configuration(s)`
    );

    if (activeRoundUpConfigs.length === 0) {
      console.log('✅ No active round-ups to process');
      return;
    }

    // Filter out configs with null user or bankConnection
    const validConfigs = activeRoundUpConfigs.filter(
      (config) => config.user && config.bankConnection
    );

    console.log('Valid Config', { depth: Infinity });
    console.log(
      'Valid Config',
      {
        user: validConfigs[0].user,
      },
      { depth: Infinity }
    );

    console.log(
      `📊 Found ${validConfigs.length} valid round-up configuration(s) after filtering`
    );

    if (validConfigs.length === 0) {
      console.log(
        '✅ No valid round-ups to process (all have missing references)'
      );
      return;
    }

    // Track execution statistics
    let successCount = 0;
    let failureCount = 0;
    let thresholdReachedCount = 0;
    let totalCount = 0;

    console.log(`📦 Processing round-ups for all active users`);

    // BEST PRACTICE: Process in parallel with Promise.allSettled
    const results = await Promise.allSettled(
      validConfigs.map(async (roundUpConfig) => {
        // Extract user ID safely
        const userId = (roundUpConfig.user as any)?._id || roundUpConfig.user;
        const bankConnectionId =
          (roundUpConfig.bankConnection as any)?._id ||
          roundUpConfig.bankConnection;

        // Skip if user or bank connection is still invalid
        if (!userId || !bankConnectionId) {
          console.log(`⏭️  Skipping round-up with invalid references`);
          return {
            userId,
            success: false,
            error: 'Invalid user or bank connection reference',
          };
        }

        console.log(`\n📝 Processing round-up for user: ${userId}`);
        console.log(`   Bank Connection: ${bankConnectionId}`);
        console.log(`   Current Total: $${roundUpConfig.currentMonthTotal}`);
        console.log(`   Monthly Threshold: ${roundUpConfig.monthlyThreshold}`);

        try {
          // Sync transactions and process round-ups
          const syncResult = await roundUpService.syncTransactions(
            String(userId),
            String(bankConnectionId),
            {} // Don't pass cursor to let service use stored cursor or undefined
          );

          console.log(syncResult);

          console.log(`✅ Sync completed for user ${userId}`);
          console.log(
            `   Note: RoundUp processing is handled automatically by background cron job`
          );
          console.log(
            `   Bank transactions synced: ${
              syncResult.data?.plaidSync?.added?.length || 0
            } new transactions`
          );
          console.log(
            `   Has More: ${syncResult.data?.plaidSync?.hasMore || false}`
          );

          return {
            userId,
            success: true,
            syncResult,
            thresholdReached: false, // Individual threshold checking is handled by webhooks, not sync
          };
        } catch (error) {
          console.error(
            `❌ Failed to process round-up for user ${userId}:`,
            error
          );
          return {
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Process results and collect configs for donation processing
    const allReturnedConfigs: any[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        successCount++;
        // Note: Individual threshold tracking is removed - handled by webhook system
      } else {
        failureCount++;
        const errorMessage = result.reason?.message || 'Unknown error';
        console.error(`❌ RoundUp processing failed:`, errorMessage);
      }
    });

    // Process monthly donations after all transaction syncs are complete
    const donationResults = await processMonthlyDonations(validConfigs);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RoundUp Sync & Donation Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Total Users Processed: ${validConfigs.length}`);
    console.log(`   ✅ Transaction Syncs Successful: ${successCount}`);
    console.log(`   ❌ Transaction Syncs Failed: ${failureCount}`);
    console.log(
      `   🎯 Monthly Donations Processed: ${donationResults.processed}`
    );
    console.log(`   ✅ Donations Successful: ${donationResults.success}`);
    console.log(`   ❌ Donations Failed: ${donationResults.failed}`);
    console.log(`   📊 Total Transactions Synced: ${validConfigs.length}`);
    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Complete tracking execution
    cronJobTracker.completeExecution(JOB_NAME, {
      totalProcessed: validConfigs.length,
      successCount,
      failureCount,
      errors: [],
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Critical error in RoundUp processing cron job:');
    console.error(error);

    // Mark execution as failed
    cronJobTracker.failExecution(JOB_NAME, err.message || 'Unknown error');
  } finally {
    isProcessing = false;
  }
};

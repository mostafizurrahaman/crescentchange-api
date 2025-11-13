import { cronJobTracker } from '../../jobs/cronJobTracker';
import { ScheduledDonationService } from '../ScheduledDonation/scheduledDonation.service';
import { manualTriggerScheduledDonations } from '../../jobs/scheduledDonations.job';

/**
 * CronJobs Service
 * 
 * Business logic for cron job management and monitoring
 */

// 1. Manual trigger for scheduled donations
const triggerScheduledDonations = async () => {
  return await manualTriggerScheduledDonations();
};

// 2. Get cron job status (all or specific)
const getCronJobStatus = async (jobName?: string, hours?: number) => {
  if (jobName) {
    // Get specific job status
    const jobStats = cronJobTracker.getJobStats(jobName);
    
    if (!jobStats) {
      return null;
    }

    // Get execution summary for specified period
    const period = hours || 24;
    const summary = cronJobTracker.getExecutionSummary(jobName, period);

    // Get recent executions
    const recentExecutions = cronJobTracker.getRecentExecutions(jobName, 10);

    return {
      job: jobStats,
      summary,
      recentExecutions,
    };
  } else {
    // Get all jobs status
    const allJobs = cronJobTracker.getAllJobsStats();

    // Enhance with current system status
    const enhancedJobs = await Promise.all(
      allJobs.map(async (job) => {
        if (job.jobName === 'scheduled-donations') {
          // Get current due count
          const dueDonations = await ScheduledDonationService
            .getScheduledDonationsDueForExecution();
          
          return {
            ...job,
            currentStatus: {
              dueDonationsCount: dueDonations.length,
              isProcessing: job.lastExecution?.status === 'running',
            },
          };
        }
        return job;
      })
    );

    return {
      jobs: enhancedJobs,
      summary: {
        totalJobs: allJobs.length,
        activeJobs: allJobs.filter(j => j.isActive).length,
        inactiveJobs: allJobs.filter(j => !j.isActive).length,
      },
    };
  }
};

// 3. Get execution history for a specific job
const getExecutionHistory = async (
  jobName: string,
  limit?: number,
  hours?: number
) => {
  const jobStats = cronJobTracker.getJobStats(jobName);
  
  if (!jobStats) {
    return null;
  }

  // Get executions with optional limit
  const executionLimit = limit || 50;
  const recentExecutions = cronJobTracker.getRecentExecutions(jobName, executionLimit);

  // Get summary for period
  const period = hours || 24;
  const summary = cronJobTracker.getExecutionSummary(jobName, period);

  return {
    jobName,
    executions: recentExecutions,
    summary,
    statistics: jobStats.statistics,
  };
};

// 4. Get dashboard data
const getDashboard = async () => {
  const allJobs = cronJobTracker.getAllJobsStats();

  // Get scheduled donations specific data
  const dueDonations = await ScheduledDonationService
    .getScheduledDonationsDueForExecution();
  
  const scheduledDonationJob = allJobs.find(j => j.jobName === 'scheduled-donations');

  // Calculate overall metrics
  const totalExecutions = allJobs.reduce((sum, job) => 
    sum + job.statistics.totalExecutions, 0
  );
  
  const totalProcessed = allJobs.reduce((sum, job) => 
    sum + job.statistics.totalProcessed, 0
  );

  const totalSuccessful = allJobs.reduce((sum, job) => 
    sum + job.statistics.totalSuccessful, 0
  );

  const totalFailed = allJobs.reduce((sum, job) => 
    sum + job.statistics.totalFailed, 0
  );

  const overallSuccessRate = totalProcessed > 0
    ? (totalSuccessful / totalProcessed) * 100
    : 0;

  // Get recent activity (last 24 hours)
  const recentSummaries = allJobs.map(job => ({
    jobName: job.jobName,
    ...cronJobTracker.getExecutionSummary(job.jobName, 24),
  }));

  return {
    overview: {
      totalJobs: allJobs.length,
      activeJobs: allJobs.filter(j => j.isActive).length,
      totalExecutions,
      totalProcessed,
      totalSuccessful,
      totalFailed,
      overallSuccessRate: parseFloat(overallSuccessRate.toFixed(2)),
    },
    scheduledDonations: {
      dueDonationsCount: dueDonations.length,
      isProcessing: scheduledDonationJob?.lastExecution?.status === 'running',
      lastExecution: scheduledDonationJob?.statistics.lastExecutionTime,
      nextExecution: scheduledDonationJob?.statistics.nextExecutionTime,
      successRate: scheduledDonationJob?.statistics.successRate || 0,
      totalExecutions: scheduledDonationJob?.statistics.totalExecutions || 0,
    },
    recentActivity: recentSummaries,
    jobs: allJobs.map(job => ({
      jobName: job.jobName,
      schedule: job.schedule,
      isActive: job.isActive,
      lastExecution: job.statistics.lastExecutionTime,
      successRate: parseFloat(job.statistics.successRate.toFixed(2)),
      status: job.lastExecution?.status || 'idle',
    })),
  };
};

// 5. Get health check
const getHealthCheck = async () => {
  const allJobs = cronJobTracker.getAllJobsStats();
  
  const healthStatus = allJobs.map(job => {
    const lastExecution = job.lastExecution;
    const stats = job.statistics;
    
    // Determine health status
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    // Check if job is running
    if (!job.isActive) {
      health = 'warning';
      issues.push('Job is not active');
    }

    // Check last execution time (should run within expected interval)
    if (stats.lastExecutionTime) {
      const hoursSinceLastExecution = 
        (Date.now() - stats.lastExecutionTime.getTime()) / (1000 * 60 * 60);
      
      // For hourly jobs, alert if not run in 2+ hours
      if (job.schedule === '0 * * * *' && hoursSinceLastExecution > 2) {
        health = 'critical';
        issues.push(`Last execution was ${hoursSinceLastExecution.toFixed(1)} hours ago`);
      }
    }

    // Check success rate
    if (stats.successRate < 50) {
      health = 'critical';
      issues.push(`Low success rate: ${stats.successRate.toFixed(1)}%`);
    } else if (stats.successRate < 80) {
      if (health !== 'critical') health = 'warning';
      issues.push(`Moderate success rate: ${stats.successRate.toFixed(1)}%`);
    }

    // Check last execution status
    if (lastExecution?.status === 'failed') {
      if (health !== 'critical') health = 'warning';
      issues.push('Last execution failed');
    }

    return {
      jobName: job.jobName,
      health,
      isActive: job.isActive,
      issues: issues.length > 0 ? issues : ['No issues detected'],
      lastExecution: stats.lastExecutionTime,
      successRate: stats.successRate,
    };
  });

  // Overall system health
  const criticalJobs = healthStatus.filter(j => j.health === 'critical').length;
  const warningJobs = healthStatus.filter(j => j.health === 'warning').length;
  
  let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (criticalJobs > 0) {
    overallHealth = 'critical';
  } else if (warningJobs > 0) {
    overallHealth = 'warning';
  }

  return {
    overallHealth,
    timestamp: new Date().toISOString(),
    jobs: healthStatus,
    summary: {
      total: healthStatus.length,
      healthy: healthStatus.filter(j => j.health === 'healthy').length,
      warning: warningJobs,
      critical: criticalJobs,
    },
  };
};

export const CronJobsService = {
  triggerScheduledDonations,
  getCronJobStatus,
  getExecutionHistory,
  getDashboard,
  getHealthCheck,
};

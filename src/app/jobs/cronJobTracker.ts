/**
 * Cron Job Execution Tracker
 * 
 * Tracks execution statistics and status for all cron jobs
 */

export interface CronExecutionRecord {
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  status: 'running' | 'completed' | 'failed';
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors?: Array<{ id: string; error: string }>;
}

export interface CronJobStats {
  jobName: string;
  schedule: string;
  isActive: boolean;
  lastExecution?: CronExecutionRecord;
  executions: CronExecutionRecord[];
  statistics: {
    totalExecutions: number;
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    averageDuration: number; // in seconds
    successRate: number; // percentage
    lastExecutionTime?: Date;
    nextExecutionTime?: Date;
  };
}

class CronJobTracker {
  private jobs: Map<string, CronJobStats> = new Map();
  private maxHistorySize = 50; // Keep last 50 executions

  /**
   * Register a cron job
   */
  registerJob(jobName: string, schedule: string): void {
    if (!this.jobs.has(jobName)) {
      this.jobs.set(jobName, {
        jobName,
        schedule,
        isActive: true,
        executions: [],
        statistics: {
          totalExecutions: 0,
          totalProcessed: 0,
          totalSuccessful: 0,
          totalFailed: 0,
          averageDuration: 0,
          successRate: 100,
        },
      });
    }
  }

  /**
   * Start tracking a job execution
   */
  startExecution(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (!job) return;

    const execution: CronExecutionRecord = {
      startTime: new Date(),
      status: 'running',
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
    };

    job.lastExecution = execution;
  }

  /**
   * Complete tracking a job execution
   */
  completeExecution(
    jobName: string,
    data: {
      totalProcessed: number;
      successCount: number;
      failureCount: number;
      errors?: Array<{ id: string; error: string }>;
    }
  ): void {
    const job = this.jobs.get(jobName);
    if (!job || !job.lastExecution) return;

    const execution = job.lastExecution;
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    execution.status = 'completed';
    execution.totalProcessed = data.totalProcessed;
    execution.successCount = data.successCount;
    execution.failureCount = data.failureCount;
    execution.errors = data.errors;

    // Add to executions history
    job.executions.unshift(execution);

    // Limit history size
    if (job.executions.length > this.maxHistorySize) {
      job.executions = job.executions.slice(0, this.maxHistorySize);
    }

    // Update statistics
    this.updateStatistics(jobName);
  }

  /**
   * Mark execution as failed
   */
  failExecution(jobName: string, error: string): void {
    const job = this.jobs.get(jobName);
    if (!job || !job.lastExecution) return;

    const execution = job.lastExecution;
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    execution.status = 'failed';
    execution.totalProcessed = 0; // No items processed due to failure
    execution.successCount = 0;
    execution.failureCount = 1; // Count as 1 failure for the entire job
    execution.errors = [{ id: 'job-execution', error: error }];

    // Add to executions history
    job.executions.unshift(execution);

    // Limit history size
    if (job.executions.length > this.maxHistorySize) {
      job.executions = job.executions.slice(0, this.maxHistorySize);
    }

    // Update statistics
    this.updateStatistics(jobName);
  }

  /**
   * Update job statistics
   */
  private updateStatistics(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (!job) return;

    const stats = job.statistics;
    
    // Total executions
    stats.totalExecutions = job.executions.length;
    
    // Sum up all metrics
    stats.totalProcessed = job.executions.reduce((sum, exec) => sum + exec.totalProcessed, 0);
    stats.totalSuccessful = job.executions.reduce((sum, exec) => sum + exec.successCount, 0);
    stats.totalFailed = job.executions.reduce((sum, exec) => sum + exec.failureCount, 0);
    
    // Average duration (in seconds)
    const completedExecutions = job.executions.filter(e => e.duration);
    if (completedExecutions.length > 0) {
      const totalDuration = completedExecutions.reduce((sum, exec) => sum + (exec.duration || 0), 0);
      stats.averageDuration = (totalDuration / completedExecutions.length) / 1000;
    }
    
    // Success rate
    if (stats.totalProcessed > 0) {
      stats.successRate = (stats.totalSuccessful / stats.totalProcessed) * 100;
    }
    
    // Last execution time
    if (job.executions.length > 0) {
      stats.lastExecutionTime = job.executions[0].startTime;
    }
  }

  /**
   * Set next execution time
   */
  setNextExecutionTime(jobName: string, nextTime: Date): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.statistics.nextExecutionTime = nextTime;
    }
  }

  /**
   * Set job active status
   */
  setJobStatus(jobName: string, isActive: boolean): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.isActive = isActive;
    }
  }

  /**
   * Get job statistics
   */
  getJobStats(jobName: string): CronJobStats | undefined {
    return this.jobs.get(jobName);
  }

  /**
   * Get all jobs statistics
   */
  getAllJobsStats(): CronJobStats[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get recent executions for a job
   */
  getRecentExecutions(jobName: string, limit: number = 10): CronExecutionRecord[] {
    const job = this.jobs.get(jobName);
    if (!job) return [];
    
    return job.executions.slice(0, limit);
  }

  /**
   * Get execution history summary
   */
  getExecutionSummary(jobName: string, hours: number = 24): {
    period: string;
    totalExecutions: number;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    averageDuration: number;
    successRate: number;
  } {
    const job = this.jobs.get(jobName);
    if (!job) {
      return {
        period: `Last ${hours} hours`,
        totalExecutions: 0,
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
        successRate: 0,
      };
    }

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentExecutions = job.executions.filter(
      exec => exec.startTime >= cutoffTime
    );

    const totalProcessed = recentExecutions.reduce((sum, exec) => sum + exec.totalProcessed, 0);
    const successCount = recentExecutions.reduce((sum, exec) => sum + exec.successCount, 0);
    const failureCount = recentExecutions.reduce((sum, exec) => sum + exec.failureCount, 0);
    
    const completedExecutions = recentExecutions.filter(e => e.duration);
    const averageDuration = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, exec) => sum + (exec.duration || 0), 0) / completedExecutions.length / 1000
      : 0;

    const successRate = totalProcessed > 0
      ? (successCount / totalProcessed) * 100
      : 0;

    return {
      period: `Last ${hours} hours`,
      totalExecutions: recentExecutions.length,
      totalProcessed,
      successCount,
      failureCount,
      averageDuration,
      successRate,
    };
  }

  /**
   * Clear all tracking data (use cautiously)
   */
  clearAllData(): void {
    this.jobs.clear();
  }

  /**
   * Clear job history (keep current stats)
   */
  clearJobHistory(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.executions = [];
      job.lastExecution = undefined;
    }
  }
}

// Export singleton instance
export const cronJobTracker = new CronJobTracker();

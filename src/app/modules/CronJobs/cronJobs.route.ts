import { Router } from 'express';
import { ROLE } from '../Auth/auth.constant';
import { CronJobsController } from './cronJobs.controller';
import { auth } from '../../middlewares';

const router = Router();

/**
 * CronJobs Routes
 *
 * All routes for cron job management and monitoring
 * Protected by ADMIN/SUPER_ADMIN authentication
 */

// Manual trigger for scheduled donations (testing/debugging)
router
  .route('/trigger/scheduled-donations')
  .post(auth(ROLE.ADMIN), CronJobsController.triggerScheduledDonations);

// Get comprehensive cron job status
// Query params: ?jobName=scheduled-donations&hours=24
router
  .route('/status')
  .get(auth(ROLE.ADMIN), CronJobsController.getCronJobStatus);

// Get execution history for a specific job
// Query params: ?limit=50&hours=24
router
  .route('/:jobName/history')
  .get(auth(ROLE.ADMIN), CronJobsController.getExecutionHistory);

// Get cron jobs dashboard (overview of all jobs)
router
  .route('/dashboard')
  .get(auth(ROLE.ADMIN), CronJobsController.getDashboard);

// Get health check for all cron jobs
router
  .route('/health')
  .get(auth(ROLE.ADMIN), CronJobsController.getHealthCheck);

export const CronJobsRoutes = router;

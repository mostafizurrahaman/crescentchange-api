# CronJobs Module - Quick Reference

## 🚀 Quick Start

### Module Location
```
src/app/modules/CronJobs/
├── cronJobs.service.ts      # Business logic
├── cronJobs.controller.ts   # HTTP handlers
└── cronJobs.route.ts        # API routes
```

### API Base URL
```
/api/cron-jobs
```

---

## 📡 API Endpoints

### 1. Manual Trigger
```
POST /api/cron-jobs/trigger/scheduled-donations
Authorization: Bearer <admin-token>
```

### 2. Get Status (All Jobs)
```
GET /api/cron-jobs/status
Authorization: Bearer <admin-token>
```

### 3. Get Status (Specific Job)
```
GET /api/cron-jobs/status?jobName=scheduled-donations&hours=24
Authorization: Bearer <admin-token>
```

### 4. Get Execution History
```
GET /api/cron-jobs/scheduled-donations/history?limit=50&hours=24
Authorization: Bearer <admin-token>
```

### 5. Get Dashboard
```
GET /api/cron-jobs/dashboard
Authorization: Bearer <admin-token>
```

### 6. Get Health Check
```
GET /api/cron-jobs/health
Authorization: Bearer <admin-token>
```

---

## 🔧 Common Tasks

### Monitor All Cron Jobs
```bash
curl -X GET http://localhost:5000/api/cron-jobs/status \
  -H "Authorization: Bearer <admin-token>"
```

### Check Specific Job
```bash
curl -X GET "http://localhost:5000/api/cron-jobs/status?jobName=scheduled-donations&hours=24" \
  -H "Authorization: Bearer <admin-token>"
```

### Manual Trigger (Testing)
```bash
curl -X POST http://localhost:5000/api/cron-jobs/trigger/scheduled-donations \
  -H "Authorization: Bearer <admin-token>"
```

### View Dashboard
```bash
curl -X GET http://localhost:5000/api/cron-jobs/dashboard \
  -H "Authorization: Bearer <admin-token>"
```

### Health Check
```bash
curl -X GET http://localhost:5000/api/cron-jobs/health \
  -H "Authorization: Bearer <admin-token>"
```

---

## 📊 Response Formats

### Status Response
```json
{
  "success": true,
  "message": "All cron jobs status retrieved successfully",
  "data": {
    "jobs": [{
      "jobName": "scheduled-donations",
      "schedule": "0 * * * *",
      "isActive": true,
      "statistics": {
        "totalExecutions": 100,
        "successRate": 95
      }
    }],
    "summary": {
      "totalJobs": 1,
      "activeJobs": 1
    }
  }
}
```

### Dashboard Response
```json
{
  "success": true,
  "message": "Dashboard data retrieved successfully",
  "data": {
    "overview": {
      "totalJobs": 1,
      "totalExecutions": 100,
      "overallSuccessRate": 95
    },
    "scheduledDonations": {
      "dueDonationsCount": 5,
      "isProcessing": false
    }
  }
}
```

### Health Check Response
```json
{
  "success": true,
  "message": "Health check completed",
  "data": {
    "overallHealth": "healthy",
    "jobs": [{
      "jobName": "scheduled-donations",
      "health": "healthy",
      "issues": ["No issues detected"]
    }],
    "summary": {
      "healthy": 1,
      "warning": 0,
      "critical": 0
    }
  }
}
```

---

## 🏥 Health Status Levels

- **healthy** ✅ - All systems operational
- **warning** ⚠️ - Minor issues (success rate 50-80%)
- **critical** 🚨 - Serious issues (job not running 2+ hours, success rate < 50%)

---

## 🔐 Authentication

All endpoints require **ADMIN** or **SUPER_ADMIN** role:

```typescript
auth(ROLE.SUPER_ADMIN, ROLE.ADMIN)
```

---

## 📝 Adding New Cron Job

### 1. Create Job File
```typescript
// src/app/jobs/newJob.job.ts
import { cronJobTracker } from './cronJobTracker';

const JOB_NAME = 'new-job';

export const startNewJobCron = () => {
  cronJobTracker.registerJob(JOB_NAME, '0 */2 * * *');
  
  cron.schedule('0 */2 * * *', async () => {
    cronJobTracker.startExecution(JOB_NAME);
    
    try {
      // Your job logic here
      
      cronJobTracker.completeExecution(JOB_NAME, {
        totalProcessed: 10,
        successCount: 9,
        failureCount: 1
      });
    } catch (error) {
      cronJobTracker.failExecution(JOB_NAME, error.message);
    }
  });
};
```

### 2. Register in jobs/index.ts
```typescript
export const initializeJobs = () => {
  startScheduledDonationsCron();
  startNewJobCron(); // ← Add here
};
```

### 3. Access via API
```bash
# Automatically available!
GET /api/cron-jobs/status?jobName=new-job
```

---

## 🎯 Key Features

1. ✅ **Automatic Tracking** - No manual setup needed
2. ✅ **Comprehensive Monitoring** - Status, history, health
3. ✅ **Manual Controls** - Trigger jobs for testing
4. ✅ **Health Checks** - Automatic issue detection
5. ✅ **Admin Protected** - Secure endpoints

---

## 📚 Documentation

- Full docs: `CRONJOBS_MODULE_RESTRUCTURE.md`
- Implementation: `CRON_JOB_IMPLEMENTATION.md`
- Monitoring: `CRON_MONITORING_SYSTEM.md`

---

## 🆘 Troubleshooting

### Cron Job Not Running
```bash
# Check status
GET /api/cron-jobs/status?jobName=scheduled-donations

# Check health
GET /api/cron-jobs/health

# Manual trigger
POST /api/cron-jobs/trigger/scheduled-donations
```

### High Failure Rate
```bash
# View execution history
GET /api/cron-jobs/scheduled-donations/history?limit=20

# Check for patterns in errors
```

---

## ✅ Quick Checklist

- [ ] Server running
- [ ] Cron jobs initialized
- [ ] Admin token available
- [ ] Test manual trigger
- [ ] Monitor dashboard
- [ ] Check health status

---

**Ready to use!** 🚀

All cron job monitoring and management available at:
```
/api/cron-jobs/*
```

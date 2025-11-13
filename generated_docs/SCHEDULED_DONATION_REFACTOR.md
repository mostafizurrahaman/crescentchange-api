# Scheduled Donation Module - Minimal Approach Refactor

## Overview
Refactored the ScheduledDonation module to follow the **Minimal Approach** architecture, where ScheduledDonation acts as a **template/configuration** for recurring donations, and actual donation transactions are stored in the Donation collection.

## Architecture

### ScheduledDonation (Template/Configuration)
**Purpose**: Stores scheduling configuration and donation template data

**Contains**:
1. **Template Data** (what to donate):
   - `user`: Reference to Client
   - `organization`: Reference to Organization
   - `cause`: Reference to Cause
   - `amount`: Donation amount
   - `currency`: Currency code
   - `specialMessage`: Optional message

2. **Payment Information**:
   - `stripeCustomerId`: Stripe customer ID (required)
   - `paymentMethodId`: Payment method ID (required)

3. **Scheduling Configuration**:
   - `frequency`: daily, weekly, monthly, quarterly, yearly, custom
   - `customInterval`: { value, unit } for custom frequency
   - `startDate`: When recurring donation starts
   - `nextDonationDate`: When next donation should occur
   - `endDate`: Optional end date

4. **Execution Tracking**:
   - `isActive`: Whether scheduled donation is active
   - `lastExecutedDate`: Last execution timestamp
   - `totalExecutions`: Total number of successful executions

### Donation (Actual Transaction Record)
**Purpose**: Stores actual donation transactions

**When a scheduled donation executes, it creates a Donation record with**:
- `donationType: 'recurring'`
- `scheduledDonationId`: Reference back to ScheduledDonation
- All payment fields: `stripePaymentIntentId`, `stripeChargeId`, `status`, etc.
- Transaction tracking: `idempotencyKey`, `paymentAttempts`, `lastPaymentAttempt`

## Key Changes

### 1. Schema Refactor (`scheduledDonation.model.ts`)
- ✅ Reorganized fields into logical sections with comments
- ✅ Added field-level indexes for better query performance
- ✅ Added validation (endDate must be after startDate)
- ✅ Enhanced error messages for all validations
- ✅ Added comprehensive schema documentation

### 2. Interface Update (`donation.interface.ts`)
- ✅ Updated `IScheduledDonation` with clear sections
- ✅ Made `stripeCustomerId` and `paymentMethodId` required
- ✅ Added JSDoc comments explaining the minimal approach

### 3. Service Enhancement (`scheduledDonation.service.ts`)
- ✅ Added `executeScheduledDonation()` method that:
  - Creates Stripe PaymentIntent
  - Creates Donation record with proper fields
  - Handles success/failure tracking
  - Uses idempotency keys to prevent duplicate charges
  - Updates execution tracking on success
  - Creates failed donation records for audit trail

### 4. Key Indexes
```javascript
// Critical for cron job queries
{ nextDonationDate: 1, isActive: 1 }

// User and organization queries
{ user: 1, isActive: 1 }
{ organization: 1, isActive: 1 }

// Payment method tracking
{ stripeCustomerId: 1, isActive: 1 }
```

## Execution Flow

### Creating a Scheduled Donation
1. User provides: organizationId, causeId, amount, frequency, paymentMethodId
2. System validates: user, organization, cause, payment method
3. Calculates `nextDonationDate` based on frequency
4. Creates ScheduledDonation record with all template data

### Executing a Scheduled Donation (Cron Job)
1. Query active scheduled donations where `nextDonationDate <= now`
2. For each scheduled donation:
   - Call `executeScheduledDonation(scheduledDonationId)`
   - Create Stripe PaymentIntent with template data
   - Create Donation record with transaction details
   - Update execution tracking (lastExecutedDate, totalExecutions, nextDonationDate)
   - Check if endDate passed and deactivate if needed
3. On failure: Create failed Donation record, don't update schedule (will retry)

## Benefits

### 1. Clear Separation of Concerns
- **ScheduledDonation**: "What" and "When" to donate
- **Donation**: Actual transaction records

### 2. Full Transaction History
- Every execution creates a Donation record
- Easy to track: success, failures, refunds
- Complete audit trail via `scheduledDonationId` reference

### 3. No Data Duplication
- Payment/transaction fields only in Donation
- Template data only in ScheduledDonation
- Efficient storage and querying

### 4. Easy Reporting
```javascript
// Get all donations from a scheduled donation
Donation.find({ scheduledDonationId: id })

// Get scheduled donation stats
ScheduledDonation.findById(id)
  .then(sd => ({
    totalExecutions: sd.totalExecutions,
    totalAmount: sd.amount * sd.totalExecutions,
    nextDonation: sd.nextDonationDate
  }))
```

### 5. Idempotency & Retry Safety
- Uses idempotency keys: `scheduled_${id}_${timestamp}`
- Failed donations don't update schedule (automatic retry)
- Prevents duplicate charges
- Clear failure tracking

## API Endpoints

### User Endpoints
- `POST /scheduled-donations` - Create scheduled donation
- `GET /scheduled-donations` - List with filters/pagination
- `GET /scheduled-donations/:id` - Get single scheduled donation
- `PATCH /scheduled-donations/:id` - Update amount, frequency, message
- `POST /scheduled-donations/:id/pause` - Pause (isActive = false)
- `POST /scheduled-donations/:id/resume` - Resume (recalculate nextDonationDate)
- `DELETE /scheduled-donations/:id` - Cancel (delete)

### Internal/Cron Endpoints
- `getScheduledDonationsDueForExecution()` - Get due donations
- `executeScheduledDonation(id)` - Process single scheduled donation

## Example Usage

### Create Scheduled Donation
```javascript
POST /scheduled-donations
{
  "organizationId": "org123",
  "causeId": "cause456",
  "amount": 50,
  "frequency": "monthly",
  "paymentMethodId": "pm_123456",
  "specialMessage": "Monthly donation for education"
}
```

### Cron Job (Background Process)
```javascript
// Run every hour
async function processScheduledDonations() {
  const dueDonations = await ScheduledDonationService
    .getScheduledDonationsDueForExecution();
  
  for (const sd of dueDonations) {
    try {
      await ScheduledDonationService.executeScheduledDonation(sd._id);
      console.log(`✅ Executed scheduled donation ${sd._id}`);
    } catch (error) {
      console.error(`❌ Failed to execute ${sd._id}:`, error.message);
      // Failed donation record already created, will retry next time
    }
  }
}
```

## Files Modified
- ✅ `src/app/modules/ScheduledDonation/scheduledDonation.model.ts`
- ✅ `src/app/modules/ScheduledDonation/scheduledDonation.service.ts`
- ✅ `src/app/modules/donation/donation.interface.ts`

## Files Already Correct
- ✅ `src/app/modules/ScheduledDonation/scheduledDonation.validation.ts`
- ✅ `src/app/modules/ScheduledDonation/scheduledDonation.controller.ts`
- ✅ `src/app/modules/ScheduledDonation/scheduledDonation.route.ts`

## Next Steps

1. **Implement Cron Job** - Set up scheduled task to call `getScheduledDonationsDueForExecution()` and `executeScheduledDonation()`
2. **Error Notifications** - Notify users when recurring donations fail
3. **Receipt Generation** - Generate receipts for successful recurring donations
4. **Analytics Dashboard** - Show users their recurring donation history
5. **Retry Logic** - Implement smart retry with exponential backoff for failed payments

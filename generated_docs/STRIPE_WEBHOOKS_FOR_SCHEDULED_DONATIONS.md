# Using Stripe Webhooks for Scheduled Donations - Complete Guide

## Answer: YES! You SHOULD Use Stripe Webhooks

**Current System:** You already have Stripe webhooks set up! You just need to extend them to handle scheduled donation statuses.

**Location:** `src/app/modules/donation/webhook.handler.ts`

---

## Why Webhooks Are BETTER Than Cron-Only Approach

### Current Problem with Cron-Only
```typescript
// ❌ CURRENT: Cron creates payment, then waits
const paymentIntent = await stripe.paymentIntents.create({
  confirm: true,
  off_session: true,
  // ...
});

// ⚠️ PROBLEM: We assume success immediately
const donation = await Donation.create({
  status: 'completed', // Might not be true yet!
  // ...
});
```

**Issues:**
1. Payment may still be processing but we mark as "completed"
2. Asynchronous card authentication isn't handled
3. Network failures cause data inconsistency
4. No visibility into actual payment lifecycle

### With Webhooks (BETTER ✅)
```typescript
// ✅ STEP 1: Cron creates payment intent
const paymentIntent = await stripe.paymentIntents.create({
  confirm: true,
  off_session: true,
  metadata: {
    scheduledDonationId: '...',
    donationType: 'recurring',
  }
});

// ✅ STEP 2: Create donation as 'processing'
const donation = await Donation.create({
  status: 'processing', // Honest status
  stripePaymentIntentId: paymentIntent.id,
  // ...
});

// ✅ STEP 3: Webhook handles actual result
// payment_intent.succeeded → Update to 'completed'
// payment_intent.payment_failed → Update to 'failed'
// payment_intent.canceled → Update to 'canceled'
```

**Benefits:**
1. ✅ **Real-time status updates** - Know exactly when payment succeeds/fails
2. ✅ **Handles edge cases** - 3D Secure, delayed bank debits, async processing
3. ✅ **Reliable** - Stripe retries webhooks if your server is down
4. ✅ **Decoupled** - Cron job doesn't wait for payment completion
5. ✅ **Better UX** - Can notify users in real-time when payment completes

---

## Architecture: Cron + Webhooks (Hybrid Approach)

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON JOB (Scheduler)                      │
│  Every hour: Find due scheduled donations                    │
│  ↓                                                            │
│  For each donation:                                           │
│    1. Create Stripe PaymentIntent (off_session: true)        │
│    2. Create Donation record (status: 'processing')          │
│    3. Update ScheduledDonation.lastExecutedDate              │
│    4. Continue to next donation (don't wait)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────────────┐
                    │  Stripe API   │
                    │  Processing   │
                    └───────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  WEBHOOK (Event Handler)                     │
│  Stripe sends events asynchronously:                         │
│                                                               │
│  ✅ payment_intent.succeeded                                 │
│     → Update Donation.status = 'completed'                   │
│     → Update ScheduledDonation.totalExecutions++             │
│     → Calculate next donation date                           │
│     → Send success notification to user                      │
│                                                               │
│  ❌ payment_intent.payment_failed                            │
│     → Update Donation.status = 'failed'                      │
│     → Increment paymentAttempts                              │
│     → Send failure notification to user                      │
│     → Don't update ScheduledDonation (will retry next hour)  │
│                                                               │
│  🚫 payment_intent.canceled                                  │
│     → Update Donation.status = 'canceled'                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Step 1: Update Scheduled Donation Service

Modify `executeScheduledDonation` to create donations as "processing":

```typescript
// src/app/modules/ScheduledDonation/scheduledDonation.service.ts

const executeScheduledDonation = async (
  scheduledDonationId: string
): Promise<IDonationModel> => {
  // ... existing validation code ...

  // Add metadata to identify this as a scheduled donation
  const paymentIntentParams: any = {
    amount: Math.round(scheduledDonation.amount * 100),
    currency: scheduledDonation.currency.toLowerCase(),
    customer: scheduledDonation.stripeCustomerId,
    payment_method: scheduledDonation.paymentMethodId,
    confirm: true,
    off_session: true,
    metadata: {
      scheduledDonationId: scheduledDonationId,
      donationType: 'recurring', // ✅ Important for webhook
      userId: userId,
      organizationId: organizationId,
      causeId: causeId,
      specialMessage: scheduledDonation.specialMessage || '',
    },
    // ...
  };

  const paymentIntent = await stripe.paymentIntents.create(
    paymentIntentParams,
    { idempotencyKey }
  );

  // ✅ Create donation as 'processing' instead of 'completed'
  const donation = await Donation.create({
    donor: userId,
    organization: organizationId,
    cause: causeId,
    donationType: 'recurring',
    amount: scheduledDonation.amount,
    currency: scheduledDonation.currency,
    status: 'processing', // ✅ Changed from checking paymentIntent.status
    donationDate: new Date(),
    stripePaymentIntentId: paymentIntent.id,
    stripeChargeId: paymentIntent.latest_charge as string,
    stripeCustomerId: scheduledDonation.stripeCustomerId,
    stripePaymentMethodId: scheduledDonation.paymentMethodId,
    specialMessage: scheduledDonation.specialMessage,
    pointsEarned: 0, // ✅ Don't award points yet, wait for webhook confirmation
    connectedAccountId,
    scheduledDonationId: scheduledDonationId,
    idempotencyKey,
    paymentAttempts: attempt,
    lastPaymentAttempt: new Date(),
    receiptGenerated: false,
  });

  // ✅ DON'T update scheduledDonation here
  // Wait for webhook to confirm success
  // await updateScheduledDonationAfterExecution(scheduledDonationId, true);

  console.log(`✅ Created payment intent for donation ${donation._id}: ${paymentIntent.id}`);
  return donation;
};
```

### Step 2: Extend Webhook Handler

Add handlers for recurring donations:

```typescript
// src/app/modules/donation/webhook.handler.ts

// ✅ NEW: Handle payment_intent.succeeded for recurring donations
const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  const { metadata } = paymentIntent;

  try {
    // Find and update donation
    const donation = await Donation.findOneAndUpdate(
      {
        stripePaymentIntentId: paymentIntent.id,
        status: { $in: ['pending', 'processing'] },
      },
      {
        status: 'completed',
        stripeChargeId: paymentIntent.latest_charge as string,
        pointsEarned: Math.floor((paymentIntent.amount / 100) * 100), // ✅ Award points now
      },
      { new: true }
    );

    if (!donation) {
      console.error(`Donation not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    console.log(`✅ Payment succeeded for donation: ${donation._id}`);

    // ✅ NEW: If this is a recurring donation, update scheduled donation
    if (metadata?.donationType === 'recurring' && metadata?.scheduledDonationId) {
      await updateScheduledDonationAfterSuccess(metadata.scheduledDonationId);
    }

    // ✅ Optional: Send success notification
    // await sendDonationSuccessNotification(donation);

  } catch (error) {
    console.error('Error handling payment_intent.succeeded:', error);
  }
};

// ✅ NEW: Handle payment_intent.payment_failed for recurring donations
const handlePaymentIntentFailed = async (
  paymentIntent: Stripe.PaymentIntent
) => {
  const { metadata } = paymentIntent;

  try {
    const donation = await Donation.findOneAndUpdate(
      {
        stripePaymentIntentId: paymentIntent.id,
        status: { $in: ['pending', 'processing'] },
      },
      {
        status: 'failed',
        $inc: { paymentAttempts: 1 },
        lastPaymentAttempt: new Date(),
      },
      { new: true }
    );

    if (!donation) {
      console.error(`Donation not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    console.log(`❌ Payment failed for donation: ${donation._id}`);

    // ✅ NEW: If recurring, DON'T update scheduledDonation
    // Let the cron job retry in the next run
    if (metadata?.donationType === 'recurring') {
      console.log(`Will retry in next cron run for scheduled donation: ${metadata.scheduledDonationId}`);
    }

    // ✅ Optional: Send failure notification
    // await sendDonationFailureNotification(donation, paymentIntent.last_payment_error?.message);

  } catch (error) {
    console.error('Error handling payment_intent.payment_failed:', error);
  }
};

// ✅ NEW: Helper function to update scheduled donation after success
const updateScheduledDonationAfterSuccess = async (scheduledDonationId: string) => {
  try {
    const scheduledDonation = await ScheduledDonation.findById(scheduledDonationId);
    
    if (!scheduledDonation) {
      console.error(`Scheduled donation not found: ${scheduledDonationId}`);
      return;
    }

    // Update execution tracking
    scheduledDonation.lastExecutedDate = new Date();
    scheduledDonation.totalExecutions += 1;

    // Calculate next donation date
    const nextDate = calculateNextDonationDate(
      new Date(),
      scheduledDonation.frequency,
      scheduledDonation.customInterval
    );
    scheduledDonation.nextDonationDate = nextDate;

    // Check if end date has passed
    if (scheduledDonation.endDate && nextDate > scheduledDonation.endDate) {
      scheduledDonation.isActive = false;
    }

    await scheduledDonation.save();
    
    console.log(`✅ Updated scheduled donation: ${scheduledDonationId}, next date: ${nextDate}`);
  } catch (error) {
    console.error('Error updating scheduled donation after success:', error);
  }
};
```

### Step 3: Update Donation Model Status

Ensure your donation model accepts "processing" status:

```typescript
// src/app/modules/donation/donation.model.ts

status: {
  type: String,
  enum: ['pending', 'processing', 'completed', 'failed', 'canceled', 'refunding', 'refunded'],
  default: 'pending',
  required: true,
},
```

---

## Benefits of This Hybrid Approach

| Aspect | Cron-Only | Cron + Webhooks (Hybrid) |
|--------|-----------|--------------------------|
| **Reliability** | ❌ Assumes success immediately | ✅ Confirms actual payment status |
| **3D Secure** | ❌ Can't handle async auth | ✅ Waits for customer action |
| **Bank Delays** | ❌ Marks as complete too early | ✅ Handles delayed debits |
| **Error Handling** | ❌ Must guess failure reasons | ✅ Gets detailed Stripe errors |
| **User Notifications** | ❌ Manual polling needed | ✅ Real-time event-driven |
| **Data Consistency** | ❌ Can be out of sync | ✅ Always matches Stripe |
| **Retry Logic** | ⚠️ Cron does retries | ✅ Cron + webhook double safety |
| **Audit Trail** | ⚠️ Limited | ✅ Complete payment lifecycle |

---

## Testing the Implementation

### Test 1: Successful Payment Flow

```bash
# 1. Trigger cron manually
curl -X POST http://localhost:5000/api/v1/cron-jobs/trigger/scheduled-donations \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. Check donation status (should be 'processing')
curl http://localhost:5000/api/v1/donation/{donationId}/status \
  -H "Authorization: Bearer YOUR_CLIENT_TOKEN"
# Expected: { status: 'processing', pointsEarned: 0 }

# 3. Simulate Stripe webhook
stripe trigger payment_intent.succeeded

# 4. Check donation status again (should be 'completed')
curl http://localhost:5000/api/v1/donation/{donationId}/status \
  -H "Authorization: Bearer YOUR_CLIENT_TOKEN"
# Expected: { status: 'completed', pointsEarned: 5000 }
```

### Test 2: Failed Payment Flow

```bash
# 1. Use a test card that will decline
# Set up scheduled donation with card: 4000 0000 0000 0002 (decline)

# 2. Trigger cron
curl -X POST http://localhost:5000/api/v1/cron-jobs/trigger/scheduled-donations

# 3. Wait for webhook (payment_intent.payment_failed)
# Webhook will automatically mark donation as 'failed'

# 4. Verify donation status
curl http://localhost:5000/api/v1/donation/{donationId}/status
# Expected: { status: 'failed', paymentAttempts: 1 }

# 5. Verify scheduled donation NOT updated
# It should retry in next cron run
```

### Test 3: Webhook Reliability

```bash
# Simulate webhook failure (server down)
# Stripe will retry webhooks automatically

# View webhook attempts in Stripe Dashboard:
https://dashboard.stripe.com/webhooks

# Webhooks are retried:
# - Immediately
# - 1 hour later
# - 3 hours later
# - 6 hours later
# - 12 hours later
# - 24 hours later
```

---

## Monitoring & Observability

### Add Webhook Logs

```typescript
// Enhanced logging for webhook events
const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔔 WEBHOOK: payment_intent.succeeded');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Payment Intent ID:', paymentIntent.id);
  console.log('Amount:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
  console.log('Metadata:', paymentIntent.metadata);
  console.log('Created:', new Date(paymentIntent.created * 1000).toISOString());
  
  // ... handle webhook ...
  
  console.log('✅ Webhook processed successfully');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};
```

### Dashboard Metrics

Track these metrics:
```typescript
// Cron job metrics
- Total scheduled donations processed
- Payments initiated
- Immediate failures (before webhook)

// Webhook metrics
- payment_intent.succeeded count
- payment_intent.payment_failed count
- Average time from cron to webhook completion
- Webhook retry count
```

---

## Security Best Practices

### 1. Verify Webhook Signatures (Already Done ✅)
```typescript
// Your code already does this
const event = StripeService.verifyWebhookSignature(rawBody, signature);
```

### 2. Idempotency (Already Done ✅)
```typescript
// Your code already uses idempotency keys
idempotencyKey: `scheduled_${scheduledDonationId}_${Date.now()}_${random}`
```

### 3. Add Webhook Secret Rotation
```bash
# In Stripe Dashboard, regenerate webhook secret periodically
# Update environment variable: STRIPE_WEBHOOK_SECRET
```

---

## Migration Strategy

### Phase 1: Add Webhook Handlers (No Breaking Changes)
1. Add new webhook handlers for recurring donations
2. Keep existing cron job logic unchanged
3. Test in development with Stripe CLI

### Phase 2: Update Cron to Create "Processing" Donations
1. Change donation creation to use `status: 'processing'`
2. Remove immediate `updateScheduledDonationAfterExecution` call
3. Let webhooks handle the updates

### Phase 3: Monitor & Validate
1. Run both systems in parallel for 1 week
2. Compare cron logs vs webhook logs
3. Verify all donations reach final status

### Phase 4: Cleanup
1. Remove old immediate status logic from cron
2. Add alerting for donations stuck in "processing"
3. Document the new flow

---

## Summary

### Current System
✅ You already have webhooks set up  
✅ You already have proper signature verification  
✅ You already handle payment_intent events  

### What You Need to Add
1. ✅ Extend webhook handlers to check for `donationType: 'recurring'` metadata
2. ✅ Update `executeScheduledDonation` to create donations as "processing"
3. ✅ Move `updateScheduledDonationAfterExecution` from cron to webhook
4. ✅ Add helper function to update scheduled donation from webhook

### Result
🎯 **More reliable recurring donations**  
🎯 **Real-time payment status updates**  
🎯 **Better user experience**  
🎯 **Easier debugging and monitoring**  

---

## Recommended Next Steps

1. **Implement Phase 1** - Add webhook logic (1-2 hours)
2. **Test with Stripe CLI** - Simulate webhooks locally (30 min)
3. **Deploy to staging** - Test with real test payments (1 hour)
4. **Monitor for 1 week** - Ensure stability
5. **Roll out to production** - Enable for all users

The hybrid approach (Cron + Webhooks) is the industry standard for scheduled payments and will make your system much more robust!

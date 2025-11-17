# RoundUp Testing Guide - Complete Workflow

## Problem Fixed ✅
The dummy transaction endpoint was firing webhooks on **empty sandbox accounts**, creating 0 transactions. 

**Solution**: Now uses `sandboxItemResetLogin` to populate the Plaid sandbox account with default transactions before syncing.

---

## Complete Testing Flow

### Prerequisites
- Plaid sandbox API keys configured
- User account created and JWT token obtained
- Organization and Cause IDs available

### Step 1: Connect Bank Account
```bash
POST /bank-connection/link-token
Headers: Authorization: Bearer <JWT_TOKEN>

# Use returned link_token with Plaid Link (frontend)
# Then exchange public_token:

POST /bank-connection/
Headers: Authorization: Bearer <JWT_TOKEN>
Body: {
  "public_token": "<from_plaid_link>"
}

# Save the returned bankConnectionId
```

### Step 2: Create RoundUp Configuration
```bash
POST /secure-roundup/consent/save
Headers: Authorization: Bearer <JWT_TOKEN>
Body: {
  "bankConnectionId": "<your_bank_connection_id>",
  "organizationId": "<charity_organization_id>",
  "causeId": "<cause_id>",
  "monthlyThreshold": 3,
  "specialMessage": "Testing RoundUp"
}
```

### Step 3: Create Dummy Transactions (NEW - FIXED)
```bash
POST /bank-connection/<bankConnectionId>/add-dummy-transactions
Headers: Authorization: Bearer <JWT_TOKEN>

# This endpoint now:
# 1. Resets sandbox item to populate default transactions
# 2. Fires webhook to trigger sync
# 3. Waits 2 seconds
# 4. Syncs transactions automatically
# 5. Returns transaction count

Expected Response:
{
  "success": true,
  "message": "Successfully created X dummy transactions",
  "data": {
    "webhookTriggered": "DEFAULT_UPDATE",
    "newTransactionsCount": 10,  // Should be > 0 now!
    "addedTransactions": 10,
    "syncResponse": { ... },
    "note": "Transactions ready for RoundUp processing"
  }
}
```

### Step 4: Verify Transactions Synced
```bash
# Check stored transactions
GET /bank-connection/<bankConnectionId>/transactions?startDate=2024-01-01&endDate=2025-12-31
Headers: Authorization: Bearer <JWT_TOKEN>

# Should show transactions from Plaid
```

### Step 5: Process RoundUp (Manual Testing)
```bash
# Admin endpoint to manually trigger RoundUp processing
POST /secure-roundup/test-cron-processing
Headers: Authorization: Bearer <ADMIN_JWT_TOKEN>
Body: {
  "userId": "<user_id_to_test>"  // Optional, leave empty to process all
}

# This will:
# 1. Find active RoundUp configurations
# 2. Calculate roundup amounts for unprocessed transactions
# 3. Create RoundUpTransaction records
# 4. Check if threshold reached
# 5. Create Stripe payment intent if threshold met
```

### Step 6: Check RoundUp Dashboard
```bash
GET /secure-roundup/dashboard
Headers: Authorization: Bearer <JWT_TOKEN>

Response shows:
{
  "roundUpConfig": { ... },
  "currentPeriodRoundUp": 2.50,  // Current accumulated amount
  "transactionStats": {
    "totalProcessed": 10,
    "pendingDonation": 5,
    "donated": 3
  },
  "recentTransactions": [ ... ]
}
```

### Step 7: Complete Donation (via Stripe)
When threshold is reached, Stripe payment intent is created. The webhook handler will mark donation as complete.

---

## Key Endpoints Summary

| Endpoint | Method | Purpose | Role |
|----------|--------|---------|------|
| `/bank-connection/<id>/add-dummy-transactions` | POST | Create test transactions | CLIENT |
| `/bank-connection/<id>/sync` | POST | Manual sync | CLIENT |
| `/secure-roundup/consent/save` | POST | Enable RoundUp | CLIENT |
| `/secure-roundup/test-cron-processing` | POST | Manual processing | ADMIN |
| `/secure-roundup/dashboard` | GET | View status | CLIENT |
| `/secure-roundup/transaction/<id>` | GET | Transaction details | CLIENT |

---

## What Was Fixed

### Before (Broken):
```typescript
// Just fired webhook on empty account
await plaidApi.sandboxItemFireWebhook(webhookRequest);
const syncResponse = await syncTransactions(bankConnectionId);
// Result: 0 transactions because account was empty
```

### After (Fixed):
```typescript
// 1. Reset sandbox item to populate transactions
await plaidApi.sandboxItemResetLogin({
  access_token: accessToken,
});

// 2. Fire webhook
await plaidApi.sandboxItemFireWebhook(webhookRequest);

// 3. Wait for processing
await new Promise(resolve => setTimeout(resolve, 2000));

// 4. Sync transactions
const syncResponse = await syncTransactions(bankConnectionId);
// Result: ~10 default transactions created!
```

---

## Using Postman Collection

The included Postman collection (`postman-collection/RoundUp_Donation_Postman_Collection.json`) has all endpoints configured with:
- Auto-variable storage for tokens and IDs
- Proper authentication headers
- Realistic test data
- Pre-request scripts
- Response parsing

Import it into Postman and follow the folder order for complete testing.

---

## Troubleshooting

### Still Getting 0 Transactions?
1. Verify you're using Plaid **sandbox** keys (not development/production)
2. Try calling the sync endpoint manually after add-dummy-transactions:
   ```bash
   POST /bank-connection/<id>/sync
   ```
3. Check server logs for Plaid API errors
4. Verify bankConnection.isActive = true

### Transactions Not Processing?
1. Check RoundUp configuration is active: `GET /secure-roundup/dashboard`
2. Verify organizationId and causeId exist
3. Run manual processing: `POST /secure-roundup/test-cron-processing`
4. Check server logs for processing errors

### Donation Not Completing?
1. Verify Stripe webhook is configured correctly
2. Check Stripe dashboard for payment intent status
3. Look for webhook delivery failures
4. Review donation status in database

---

## Next Steps

1. ✅ Test dummy transaction creation with fixed endpoint
2. ✅ Verify transactions appear in dashboard
3. ✅ Run RoundUp processing manually
4. ✅ Check threshold calculation
5. ✅ Test Stripe payment flow
6. ✅ Verify webhook completion

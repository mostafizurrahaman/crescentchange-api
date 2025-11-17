# Plaid Sandbox Testing Guide - How to Get Transactions

## The Root Problem

When you create a Plaid sandbox connection, **it doesn't automatically have transactions**. The account starts empty, which is why syncing returns 0 transactions.

## ✅ CORRECT Solution: Use Test Institutions with Pre-Populated Data

Plaid provides specific test institutions that come with **default transaction data**:

### Best Test Institution: "First Platypus Bank"

| Field | Value |
|-------|-------|
| **Institution Name** | First Platypus Bank |
| **Username** | `user_good` |
| **Password** | `pass_good` |
| **Has Transactions** | ✅ Yes, ~10 default transactions |
| **Best For** | Full testing workflow |

### Other Test Institutions

| Institution | Username | Password | Transactions |
|-------------|----------|----------|--------------|
| Houndstooth Bank | `user_good` | `pass_good` | ✅ Yes |
| Tattersall Federal Credit Union | `user_good` | `pass_good` | ✅ Yes |
| Tartan Bank | `user_good` | `pass_good` | ✅ Yes (limited) |

## Complete Testing Workflow

### Step 1: Delete Current Empty Connection (if exists)

```bash
POST /bank-connection/<bankConnectionId>/revoke
Headers: Authorization: Bearer <JWT_TOKEN>
```

### Step 2: Generate New Link Token

```bash
POST /bank-connection/link-token
Headers: Authorization: Bearer <JWT_TOKEN>

Response:
{
  "link_token": "link-sandbox-xxx",
  "expiration": "2025-11-17T11:00:00Z"
}
```

### Step 3: Use Plaid Link with Test Institution

**In your frontend/Postman:**

1. Open Plaid Link with the `link_token`
2. Search for **"First Platypus Bank"**
3. Enter credentials:
   - Username: `user_good`
   - Password: `pass_good`
4. Select account (usually "Plaid Checking")
5. Complete MFA if prompted (enter `1234`)
6. Get `public_token` from success callback

### Step 4: Exchange Token and Create Connection

```bash
POST /bank-connection/
Headers: Authorization: Bearer <JWT_TOKEN>
Body: {
  "public_token": "<from_plaid_link>"
}

# Save the returned bankConnectionId
```

### Step 5: Sync Transactions (Should Get ~10 Transactions)

```bash
POST /bank-connection/<bankConnectionId>/sync
Headers: Authorization: Bearer <JWT_TOKEN>
Body: {}

Expected Response:
{
  "success": true,
  "message": "Transactions synced successfully",
  "data": {
    "hasMore": false,
    "nextCursor": "xxx",
    "added": [
      { "transaction_id": "xxx", "amount": 500, "name": "McDonald's", ... },
      { "transaction_id": "yyy", "amount": 12.50, "name": "Uber", ... },
      ... ~8 more transactions
    ],
    "modified": [],
    "removed": []
  }
}
```

### Step 6: Verify Transactions Stored

```bash
GET /bank-connection/<bankConnectionId>/transactions?startDate=2024-01-01&endDate=2025-12-31
Headers: Authorization: Bearer <JWT_TOKEN>

# Should show the synced transactions
```

### Step 7: Create RoundUp Configuration

```bash
POST /secure-roundup/consent/save
Headers: Authorization: Bearer <JWT_TOKEN>
Body: {
  "bankConnectionId": "<bank_connection_id>",
  "organizationId": "<organization_id>",
  "causeId": "<cause_id>",
  "monthlyThreshold": 3
}
```

### Step 8: Process RoundUp

```bash
POST /secure-roundup/test-cron-processing
Headers: Authorization: Bearer <ADMIN_JWT_TOKEN>
Body: {
  "userId": "<user_id>"
}

# This will:
# 1. Find active RoundUp configs
# 2. Calculate roundups for unprocessed transactions
# 3. Create RoundUpTransaction records
# 4. Check threshold and create payment intent if met
```

### Step 9: Check Dashboard

```bash
GET /secure-roundup/dashboard
Headers: Authorization: Bearer <JWT_TOKEN>

Response should show:
{
  "roundUpConfig": { "isActive": true, ... },
  "currentPeriodRoundUp": 2.50,
  "transactionStats": {
    "totalProcessed": 10,
    "pendingDonation": 8,
    "donated": 0
  },
  "recentTransactions": [...]
}
```

## Why Your Current Approach Didn't Work

### ❌ Wrong Approach #1: Fire Webhook on Empty Account
```typescript
// This doesn't create transactions - just notifies about changes
await plaidApi.sandboxItemFireWebhook(webhookRequest);
// Result: 0 transactions (account is empty)
```

### ❌ Wrong Approach #2: Reset Login
```typescript
// This INVALIDATES credentials, requiring re-auth
await plaidApi.sandboxItemResetLogin({ access_token });
// Result: ITEM_LOGIN_REQUIRED error
```

### ✅ Correct Approach: Use Pre-Populated Test Institution
```
1. Use Plaid Link with "First Platypus Bank"
2. Login with user_good/pass_good
3. This institution has ~10 default transactions
4. Sync pulls them automatically
```

## Alternative: Using Plaid's Sandbox Transaction Generation (Advanced)

If you need **custom transaction amounts** for specific test cases, you can use Plaid's transaction override feature during token creation:

```typescript
const linkToken = await plaidApi.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: 'Crescent Change',
  products: [Products.Transactions],
  country_codes: [CountryCode.Us],
  language: 'en',
  webhook: process.env.PLAID_WEBHOOK_URL,
  
  // ADD THIS: Transaction overrides for custom test data
  transactions: {
    days_requested: 90,  // Generate 90 days of transactions
    override: [
      {
        date: '2025-11-01',
        description: 'Starbucks Coffee',
        amount: 4.50,
      },
      {
        date: '2025-11-02',
        description: 'Target Store',
        amount: 25.75,
      },
      {
        date: '2025-11-03',
        description: 'Gas Station',
        amount: 42.10,
      }
    ]
  }
});
```

But for most testing, **using First Platypus Bank is simpler and faster**.

## Summary

**What to do NOW:**

1. ❌ Stop trying to create transactions on existing empty connection
2. ✅ Delete current connection
3. ✅ Create NEW connection using "First Platypus Bank" (user_good/pass_good)
4. ✅ Sync transactions → Should get ~10 transactions immediately
5. ✅ Process RoundUp → Test calculations
6. ✅ Check dashboard → Verify amounts

The `add-dummy-transactions` endpoint is now updated to:
- Try syncing first (works if you used First Platypus Bank)
- Fall back to webhook if needed
- Provide helpful error messages if still no transactions

**But the real fix is**: Use the correct test institution from the start! 🎯

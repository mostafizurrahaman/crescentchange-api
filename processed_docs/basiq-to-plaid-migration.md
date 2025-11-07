# Basiq to Plaid Migration Guide

This document outlines all the changes required when switching from Basiq to Plaid for bank account connections and transaction data access.

---

## Executive Summary

**Key Differences:**

- **Basiq**: Australia/NZ focused, CDR (Consumer Data Right) compliant, consent-based API
- **Plaid**: US/Canada/Europe focused, OAuth-style Link flow, different API structure

**Major Changes Required:**

1. Model field updates (BankConnection, RoundUpTransaction)
2. API integration layer rewrite
3. Authentication/consent flow changes
4. Transaction fetching logic updates
5. Compliance and regulatory considerations

---

## 1. Model Changes

### 1.1 BankConnection Model

**Current (Basiq):**

```typescript
{
  _id: ObjectId
  user: ObjectId (ref: 'Client')
  basiqConsentId: String (required, unique) // From Basiq API
  bankName: String (required)
  accountId: String (required) // From Basiq
  accountType: String (optional)
  accountNumber: String (optional, masked)
  consentStatus: String (enum: ['active', 'expired', 'revoked'])
  consentExpiryDate: Date (required)
  connectedDate: Date
  lastSyncedDate: Date (optional)
  isActive: Boolean
  createdAt: Date
  updatedAt: Date
}
```

**Updated (Plaid):**

```typescript
{
  _id: ObjectId
  user: ObjectId (required, ref: 'Client')
  // Basiq fields → Plaid fields
  plaidItemId: String (required, unique) // Replaces basiqConsentId
  plaidAccessToken: String (required, encrypted) // Plaid access token
  institutionId: String (required) // Plaid institution ID
  institutionName: String (required) // Replaces bankName
  accountId: String (required) // Plaid account ID (different format)
  accountName: String (optional) // Account nickname
  accountType: String (enum: ['depository', 'credit', 'loan', 'investment', 'other'])
  accountSubtype: String (optional) // 'checking', 'savings', 'cd', etc.
  accountNumber: String (optional, masked) // Last 4 digits
  // Consent/Status fields
  consentStatus: String (enum: ['active', 'expired', 'revoked', 'error']) // Plaid has error state
  consentExpiryDate: Date (optional) // Plaid tokens don't expire the same way
  // Plaid-specific fields
  webhookUrl: String (optional) // For Plaid webhooks
  lastSuccessfulUpdate: Date (optional) // Last successful transaction sync
  errorCode: String (optional) // Plaid error codes (ITEM_LOGIN_REQUIRED, etc.)
  errorMessage: String (optional)
  // Metadata
  connectedDate: Date (default: Date.now)
  lastSyncedDate: Date (optional)
  isActive: Boolean (default: true)
  createdAt: Date
  updatedAt: Date
}
```

**Migration Notes:**

- `basiqConsentId` → `plaidItemId` (Plaid's item identifier)
- Add `plaidAccessToken` (must be encrypted, sensitive)
- `consentExpiryDate` becomes optional (Plaid tokens don't expire like CDR consent)
- Add error handling fields (`errorCode`, `errorMessage`)
- Account types use Plaid's enum values

### 1.2 RoundUpTransaction Model

**Current (Basiq):**

```typescript
{
  _id: ObjectId
  roundUp: ObjectId (ref: 'RoundUp')
  user: ObjectId (ref: 'Client')
  basiqTransactionId: String (required, unique) // From Basiq API
  originalAmount: Number (required)
  roundUpValue: Number (required, min: 0.01, max: 0.99)
  transactionDate: Date (required)
  transactionDescription: String (optional)
  processed: Boolean (default: false)
  donationId: ObjectId (optional, ref: 'Donation')
  createdAt: Date
  updatedAt: Date
}
```

**Updated (Plaid):**

```typescript
{
  _id: ObjectId
  roundUp: ObjectId (required, ref: 'RoundUp')
  user: ObjectId (required, ref: 'Client')
  // Basiq → Plaid field changes
  plaidTransactionId: String (required, unique) // Replaces basiqTransactionId
  plaidAccountId: String (required) // Plaid account ID
  // Transaction details
  originalAmount: Number (required) // Absolute value, always positive
  roundUpValue: Number (required, min: 0.01, max: 0.99)
  transactionDate: Date (required)
  transactionDescription: String (optional) // Plaid's 'name' or 'merchant_name'
  // Plaid-specific fields
  transactionType: String (enum: ['debit', 'credit']) // Plaid provides direction
  category: [String] (optional) // Plaid category array
  merchantName: String (optional) // Extracted from Plaid
  location: {
    address: String (optional)
    city: String (optional)
    region: String (optional)
    postalCode: String (optional)
    country: String (optional)
    lat: Number (optional)
    lon: Number (optional)
  } (optional) // Plaid location data
  // Status
  processed: Boolean (default: false)
  donationId: ObjectId (optional, ref: 'Donation')
  createdAt: Date
  updatedAt: Date
}
```

**Migration Notes:**

- `basiqTransactionId` → `plaidTransactionId`
- Add `plaidAccountId` for account reference
- Add `transactionType` (debit/credit) - Plaid provides this
- Add optional `category` array (Plaid provides categorization)
- Add `merchantName` and `location` (Plaid enriches transaction data)
- `originalAmount` should always be positive (use absolute value)

---

## 2. API Integration Changes

### 2.1 Authentication & Configuration

**Basiq (Current):**

```typescript
// Basiq uses API key authentication
const basiqApiKey = process.env.BASIQ_API_KEY;
const basiqBaseUrl = 'https://api.basiq.io/v2';
```

**Plaid (New):**

```typescript
// Plaid uses client_id, secret, and environment
const plaidConfig = {
  clientId: process.env.PLAID_CLIENT_ID,
  secret: process.env.PLAID_SECRET,
  environment: process.env.PLAID_ENV || 'sandbox', // 'sandbox', 'development', 'production'
  // Plaid client library
  client: new plaid.Client({
    clientID: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
    env: plaid.environments[process.env.PLAID_ENV],
  }),
};
```

### 2.2 Bank Connection Flow

**Basiq Flow (Current):**

1. Create consent via Basiq API
2. Redirect user to Basiq-hosted consent page
3. User approves CDR consent
4. Basiq redirects back with consent ID
5. Store `basiqConsentId` and fetch accounts

**Plaid Flow (New):**

1. Create Link token via Plaid API
2. Initialize Plaid Link (frontend component)
3. User selects institution and authenticates
4. Plaid returns `public_token`
5. Exchange `public_token` for `access_token`
6. Store `plaidItemId` and `plaidAccessToken`

**Code Changes:**

```typescript
// OLD: Basiq consent creation
async createBasiqConsent(userId: string) {
  const response = await fetch(`${basiqBaseUrl}/consents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${basiqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: userId,
      scope: ['accounts', 'transactions']
    })
  });
  return response.json();
}

// NEW: Plaid Link token creation
async createPlaidLinkToken(userId: string) {
  const request = {
    user: {
      client_user_id: userId,
    },
    client_name: 'Crescent Change',
    products: ['transactions'],
    country_codes: ['US', 'CA'], // Adjust based on target market
    language: 'en',
    webhook: process.env.PLAID_WEBHOOK_URL,
  };

  const response = await plaidClient.linkTokenCreate(request);
  return response.data.link_token;
}

// NEW: Exchange public token for access token
async exchangePlaidToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  return {
    access_token: response.data.access_token,
    item_id: response.data.item_id,
  };
}
```

### 2.3 Account Fetching

**Basiq:**

```typescript
async getBasiqAccounts(consentId: string) {
  const response = await fetch(`${basiqBaseUrl}/users/${userId}/accounts`, {
    headers: {
      'Authorization': `Bearer ${basiqApiKey}`,
      'Basiq-Version': '2.1'
    }
  });
  return response.json();
}
```

**Plaid:**

```typescript
async getPlaidAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  return response.data.accounts.map(account => ({
    accountId: account.account_id,
    name: account.name,
    type: account.type,
    subtype: account.subtype,
    mask: account.mask, // Last 4 digits
    balances: account.balances,
  }));
}
```

### 2.4 Transaction Fetching

**Basiq:**

```typescript
async getBasiqTransactions(consentId: string, accountId: string, startDate: Date, endDate: Date) {
  const response = await fetch(
    `${basiqBaseUrl}/users/${userId}/accounts/${accountId}/transactions?from=${startDate}&to=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${basiqApiKey}`,
        'Basiq-Version': '2.1'
      }
    }
  );
  return response.json();
}
```

**Plaid:**

```typescript
async getPlaidTransactions(accessToken: string, startDate: string, endDate: string) {
  const response = await plaidClient.transactionsGet({
    access_token: accessToken,
    start_date: startDate, // Format: 'YYYY-MM-DD'
    end_date: endDate,
    options: {
      count: 500, // Max per request
      offset: 0,
    },
  });

  // Plaid uses pagination - may need multiple calls
  let allTransactions = response.data.transactions;
  let totalTransactions = response.data.total_transactions;

  while (allTransactions.length < totalTransactions) {
    const paginatedResponse = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        count: 500,
        offset: allTransactions.length,
      },
    });
    allTransactions = allTransactions.concat(paginatedResponse.data.transactions);
  }

  return allTransactions.map(txn => ({
    transactionId: txn.transaction_id,
    accountId: txn.account_id,
    amount: Math.abs(txn.amount), // Always positive
    date: txn.date,
    name: txn.name,
    merchantName: txn.merchant_name,
    category: txn.category,
    location: txn.location,
    type: txn.amount > 0 ? 'credit' : 'debit',
  }));
}
```

### 2.5 Webhook Handling

**Basiq:** Uses polling or webhooks (if configured)

**Plaid:** Uses webhooks for real-time updates

```typescript
// NEW: Plaid webhook handler
async handlePlaidWebhook(webhookData: any) {
  const { webhook_type, item_id, error } = webhookData;

  switch (webhook_type) {
    case 'TRANSACTIONS':
      // New transactions available
      await syncTransactionsForItem(item_id);
      break;

    case 'ITEM':
      if (error) {
        // Handle errors (ITEM_LOGIN_REQUIRED, etc.)
        await updateBankConnectionStatus(item_id, 'error', error);
      }
      break;

    case 'AUTH':
      // Account verification updates
      break;
  }
}
```

---

## 3. Service Layer Changes

### 3.1 Bank Connection Service

**File:** `src/app/modules/BankConnection/bankConnection.service.ts` (new file)

```typescript
import { plaidClient } from '@/app/config/plaid';
import BankConnection from './bankConnection.model';

class BankConnectionService {
  // Create Link token for frontend
  async createLinkToken(userId: string) {
    const linkToken = await this.createPlaidLinkToken(userId);
    return { linkToken };
  }

  // Exchange public token and save connection
  async connectBank(userId: string, publicToken: string) {
    const { access_token, item_id } = await this.exchangePlaidToken(
      publicToken
    );
    const accounts = await this.getPlaidAccounts(access_token);

    // Save each account as a BankConnection
    const connections = await Promise.all(
      accounts.map((account) =>
        BankConnection.create({
          user: userId,
          plaidItemId: item_id,
          plaidAccessToken: access_token, // Encrypt before storing
          institutionId: account.institutionId,
          institutionName: account.institutionName,
          accountId: account.accountId,
          accountName: account.name,
          accountType: account.type,
          accountSubtype: account.subtype,
          accountNumber: account.mask,
          consentStatus: 'active',
          connectedDate: new Date(),
          isActive: true,
        })
      )
    );

    return connections;
  }

  // Sync transactions for a connection
  async syncTransactions(connectionId: string) {
    const connection = await BankConnection.findById(connectionId);
    if (!connection || connection.consentStatus !== 'active') {
      throw new Error('Connection not active');
    }

    const startDate =
      connection.lastSyncedDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const endDate = new Date();

    const transactions = await this.getPlaidTransactions(
      connection.plaidAccessToken,
      this.formatDate(startDate),
      this.formatDate(endDate)
    );

    // Process transactions and create RoundUpTransaction records
    // ... (see transaction processing section)

    connection.lastSyncedDate = endDate;
    await connection.save();

    return transactions;
  }

  // Handle webhook updates
  async handleWebhook(webhookData: any) {
    // Implementation from webhook section above
  }
}
```

### 3.2 Transaction Processing Service

**Changes to Round-Up Transaction Processing:**

```typescript
// OLD: Basiq transaction processing
function processBasiqTransaction(txn: BasiqTransaction) {
  return {
    basiqTransactionId: txn.id,
    originalAmount: Math.abs(txn.amount),
    transactionDate: new Date(txn.postDate),
    transactionDescription: txn.description,
  };
}

// NEW: Plaid transaction processing
function processPlaidTransaction(txn: PlaidTransaction, accountId: string) {
  // Only process debit transactions (purchases)
  if (txn.type !== 'debit' || txn.amount <= 0) {
    return null; // Skip credits and zero amounts
  }

  // Exclude non-roundable transaction types
  const excludedCategories = ['transfer', 'atm', 'bank charge'];
  if (
    txn.category?.some((cat) => excludedCategories.includes(cat.toLowerCase()))
  ) {
    return null;
  }

  const originalAmount = Math.abs(txn.amount);
  const roundUpValue = this.calculateRoundUp(originalAmount);

  return {
    plaidTransactionId: txn.transaction_id,
    plaidAccountId: accountId,
    originalAmount: originalAmount,
    roundUpValue: roundUpValue,
    transactionDate: new Date(txn.date),
    transactionDescription: txn.name || txn.merchant_name,
    transactionType: 'debit',
    category: txn.category,
    merchantName: txn.merchant_name,
    location: txn.location,
  };
}

function calculateRoundUp(amount: number): number {
  const rounded = Math.ceil(amount);
  return parseFloat((rounded - amount).toFixed(2));
}
```

---

## 4. Frontend/Client Changes

### 4.1 Plaid Link Integration

**Replace Basiq consent flow with Plaid Link:**

```typescript
// OLD: Basiq redirect flow
const handleBasiqConnect = () => {
  window.location.href = basiqConsentUrl;
};

// NEW: Plaid Link integration
import { usePlaidLink } from 'react-plaid-link';

const PlaidConnectButton = ({ linkToken, onSuccess }) => {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      onSuccess(publicToken, metadata);
    },
    onExit: (err, metadata) => {
      // Handle exit
    },
  });

  return (
    <button onClick={() => open()} disabled={!ready}>
      Connect Bank Account
    </button>
  );
};
```

---

## 5. Environment Variables

**Remove:**

```env
BASIQ_API_KEY=
BASIQ_BASE_URL=
```

**Add:**

```env
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox  # or 'development' or 'production'
PLAID_WEBHOOK_URL=https://your-api.com/webhooks/plaid
```

---

## 6. Dependencies

**Remove:**

```json
// Remove Basiq SDK if using one
```

**Add:**

```json
{
  "dependencies": {
    "plaid": "^21.0.0" // Plaid Node.js SDK
  },
  "devDependencies": {
    "@types/plaid": "^1.0.0" // If using TypeScript
  }
}
```

**For Frontend:**

```json
{
  "dependencies": {
    "react-plaid-link": "^3.0.0" // React Plaid Link component
  }
}
```

---

## 7. Compliance & Regulatory Changes

### 7.1 CDR vs Plaid Compliance

**Basiq (CDR - Australia):**

- Consumer Data Right (CDR) compliance
- 90-day consent expiry
- Australian Privacy Principles
- CDR-specific consent management

**Plaid (US/International):**

- No CDR requirements (not applicable outside AU/NZ)
- OAuth-style authentication
- Plaid's own privacy and security standards
- Different consent model (no expiry like CDR)
- May need PCI compliance considerations for stored tokens

### 7.2 Privacy Policy Updates

**Remove:**

- References to CDR (Consumer Data Right)
- Basiq-specific disclosures
- 90-day consent expiry language

**Add:**

- Plaid privacy disclosures
- Plaid's data usage policies
- Token storage and encryption details
- Webhook security measures

### 7.3 Terms of Service Updates

- Update bank connection terms
- Remove CDR-specific language
- Add Plaid-specific terms
- Update data retention policies

---

## 8. Migration Strategy

### 8.1 Data Migration

**For Existing Basiq Connections:**

1. **Option A**: Force reconnection (users reconnect via Plaid)
2. **Option B**: Dual support period (support both during transition)
3. **Option C**: One-time migration script (if possible to map data)

**Migration Script Example:**

```typescript
async function migrateBasiqToPlaid() {
  const basiqConnections = await BankConnection.find({
    basiqConsentId: { $exists: true },
  });

  for (const connection of basiqConnections) {
    // Mark as requiring reconnection
    connection.consentStatus = 'expired';
    connection.migrationNote = 'Please reconnect via Plaid';
    await connection.save();

    // Notify user to reconnect
    await sendNotification(connection.user, {
      type: 'BANK_RECONNECTION_REQUIRED',
      message:
        'Please reconnect your bank account using our new secure connection method.',
    });
  }
}
```

### 8.2 Transaction History

**RoundUpTransaction Records:**

- Keep existing `basiqTransactionId` values for historical records
- New transactions use `plaidTransactionId`
- Update queries to handle both ID types

```typescript
// Query that handles both
const transactions = await RoundUpTransaction.find({
  $or: [
    { basiqTransactionId: { $exists: true } },
    { plaidTransactionId: { $exists: true } },
  ],
  user: userId,
  processed: false,
});
```

---

## 9. Testing Checklist

### 9.1 Integration Testing

- [ ] Create Plaid Link token
- [ ] Exchange public token for access token
- [ ] Fetch accounts successfully
- [ ] Fetch transactions successfully
- [ ] Handle pagination for large transaction sets
- [ ] Process webhook events
- [ ] Handle error states (ITEM_LOGIN_REQUIRED, etc.)

### 9.2 Round-Up Logic Testing

- [ ] Calculate round-up values correctly
- [ ] Filter eligible transactions (debit only)
- [ ] Exclude non-roundable categories
- [ ] Prevent duplicate processing
- [ ] Handle transaction updates (Plaid may update transactions)

### 9.3 Error Handling

- [ ] Handle expired/invalid access tokens
- [ ] Handle ITEM_LOGIN_REQUIRED errors
- [ ] Handle rate limiting
- [ ] Handle webhook verification failures
- [ ] Handle network failures gracefully

### 9.4 Security Testing

- [ ] Encrypt `plaidAccessToken` in database
- [ ] Verify webhook signatures
- [ ] Secure API endpoints
- [ ] Validate user ownership before operations
- [ ] Audit log access token usage

---

## 10. API Endpoint Changes

### 10.1 Bank Connection Endpoints

**Update existing endpoints:**

```typescript
// OLD: POST /bank-connection/basiq-consent
// NEW: POST /bank-connection/link-token
router.post('/link-token', auth, async (req, res) => {
  const linkToken = await bankConnectionService.createLinkToken(req.user.id);
  res.json({ linkToken });
});

// OLD: POST /bank-connection/callback (Basiq redirect)
// NEW: POST /bank-connection/connect
router.post('/connect', auth, async (req, res) => {
  const { publicToken } = req.body;
  const connections = await bankConnectionService.connectBank(
    req.user.id,
    publicToken
  );
  res.json({ connections });
});

// NEW: POST /bank-connection/webhook (Plaid webhooks)
router.post('/webhook', plaidWebhookVerification, async (req, res) => {
  await bankConnectionService.handleWebhook(req.body);
  res.json({ received: true });
});
```

---

## 11. Documentation Updates

### 11.1 API Documentation

- Update all Basiq references to Plaid
- Update authentication methods
- Update webhook documentation
- Update error codes and responses

### 11.2 Developer Documentation

- Update setup instructions
- Update environment variable documentation
- Update testing guide
- Update deployment guide

### 11.3 User Documentation

- Update bank connection flow screenshots
- Update FAQ
- Update privacy policy references

---

## 12. Rollout Plan

### Phase 1: Preparation (Week 1-2)

1. Set up Plaid sandbox account
2. Install Plaid SDK
3. Create new service files
4. Update models

### Phase 2: Development (Week 3-4)

1. Implement Plaid integration
2. Update transaction processing
3. Add webhook handling
4. Write tests

### Phase 3: Testing (Week 5)

1. Integration testing
2. Security review
3. Performance testing
4. User acceptance testing

### Phase 4: Migration (Week 6)

1. Deploy to staging
2. Notify existing users
3. Gradual rollout
4. Monitor errors

### Phase 5: Cleanup (Week 7)

1. Remove Basiq code
2. Update documentation
3. Archive old data
4. Final testing

---

## 13. Risk Considerations

### 13.1 Geographic Limitations

- **Risk**: Plaid doesn't support Australia/NZ (Basiq's primary market)
- **Mitigation**:
  - If targeting AU/NZ, consider keeping Basiq or finding alternative
  - If targeting US/CA/EU, Plaid is appropriate
  - May need region-specific providers

### 13.2 Data Format Differences

- **Risk**: Transaction data structure differs
- **Mitigation**: Create abstraction layer for transaction processing

### 13.3 User Experience Changes

- **Risk**: Different connection flow may confuse users
- **Mitigation**: Clear communication, updated UI/UX, help documentation

### 13.4 Cost Implications

- **Risk**: Plaid pricing may differ from Basiq
- **Mitigation**: Review pricing model, update budget projections

---

## 14. Support & Maintenance

### 14.1 Monitoring

- Monitor Plaid API health
- Track webhook delivery rates
- Monitor error rates
- Track connection success rates

### 14.2 Error Handling

- Implement retry logic for API failures
- Handle Plaid-specific error codes
- User-friendly error messages
- Support escalation process

### 14.3 Updates

- Stay current with Plaid API versions
- Monitor deprecation notices
- Update SDK regularly
- Test updates in sandbox first

---

## Summary

Switching from Basiq to Plaid requires:

1. **Model Updates**: Field name changes, new fields, removed fields
2. **API Integration**: Complete rewrite of bank connection and transaction fetching
3. **Authentication Flow**: OAuth-style Link flow instead of CDR consent
4. **Webhook Handling**: New webhook system for real-time updates
5. **Compliance**: Different regulatory requirements (no CDR)
6. **Testing**: Comprehensive testing of new integration
7. **Migration**: Strategy for existing users and data

**Estimated Effort**: 4-6 weeks for full migration including testing and rollout.

**Critical Consideration**: Ensure Plaid supports your target geographic markets (US, Canada, Europe) as it does not support Australia/NZ where Basiq operates.

---

_Last Updated: [Current Date]_  
_Document Version: 1.0_

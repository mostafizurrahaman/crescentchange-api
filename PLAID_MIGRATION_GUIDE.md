# Plaid Integration Migration Guide

## Overview

This document explains the migration from Basq to Plaid for bank account connections and transaction data access in the Crescent Change platform.

## Key Changes

### 1. Configuration Updates

**Environment Variables**
- ✅ Add Plaid configuration to `.env` file
- ✅ Remove Basq environment variables
- ✅ Add encryption key for sensitive data

**New Environment Variables:**
```env
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
PLAID_WEBHOOK_URL=https://your-api.com/api/v1/bank-connection/webhook
PLAID_WEBHOOK_KEY=your_plaid_webhook_header_key
ENCRYPTION_KEY=your_32_character_long_encryption_key
```

### 2. Data Model Updates

**BankConnection Model**
- Replaced `basiqConsentId` with `plaidItemId`
- Added `plaidAccessToken` (encrypted)
- Added `institutionId` and `institutionName`
- Updated account type fields
- Added error handling fields

**RoundUpTransaction Model** 
- Added `plaidTransactionId` field
- Added transaction categorization from Plaid
- Enhanced with location data and merchant information
- Improved searchability and analytics

### 3. API Changes

**New Endpoints:**
- `POST /api/v1/bank-connection/link-token` - Create Plaid Link token
- `POST /api/v1/bank-connection/connect` - Exchange public token
- `POST /api/v1/bank-connection/webhook` - Handle Plaid webhooks
- `POST /api/v1/roundup-transaction/create-from-sync` - Create transactions from sync

**Updated Flow:**
1. Frontend requests link token
2. User connects bank via Plaid Link component
3. Exchange public token for access token
4. Store encrypted access token
5. Sync transactions and create round-up records

### 4. Integration Steps

1. **Install Dependencies**
   ```bash
   npm install plaid @types/plaid
   ```

2. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Fill in Plaid credentials
   - Add encryption key

3. **Database Migration**
   - Existing Basq connections will need to be reconnected
   - Migration handles this with error states
   - Users will be prompted to reconnect

4. **Frontend Integration**
   - Replace Basq redirect with Plaid Link component
   - Example React component:
   ```typescript
   import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';
   
   const BankConnectButton = () => {
     const { open, ready } = usePlaidLink({
       token: linkToken,
       onSuccess: (publicToken) => {
         // Send to backend
       }
     });
     
     return <button onClick={() => open()} disabled={!ready}>Connect Bank</button>;
   };
   ```

### 5. Webhook Configuration

**Plaid Webhook Events:**
- `TRANSACTIONS` - New transactions available
- `ITEM` - Connection status changes
- `AUTH` - Account verification updates

**Security:**
- Webhook signatures are validated
- Encrypted access tokens stored securely
- Sensitive data never logged

### 6. Transaction Processing

**Eligible Transactions:**
- Debit transactions only
- PENDING transactions excluded
- Categories: 'Transfer', 'ATM', 'Bank Service' excluded
- Minimum transaction amount: $0.01

**Round-Up Calculation:**
```typescript
const roundUpValue = Math.ceil(amount) - Math.abs(amount);
// Example: $4.60 → $4.60 round-up (already at dollar)
// Example: $4.35 → $4.65 round-up (0.65 to next dollar)
```

### 7. Error Handling

**Common Scenarios:**
- `ITEM_LOGIN_REQUIRED` - User needs to re-authenticate
- `INVALID_CREDENTIALS` - Bank login failed
- `TEMPORARY_ISSUE` - Bank temporarily unavailable

## Testing Checklist

### Setup Tests
- [ ] Plaid sandbox account created
- [ ] Test bank connection flow
- [ ] Webhook endpoint configured
- [ ] Access token encryption verified

### Transaction Tests
- [ ] Transaction fetching works
- [ ] Round-up calculations correct
- [ ] Eligible transaction filtering
- [ ] Duplicate prevention works

### Integration Tests
- [ ] End-to-end bank connection
- [ ] Round-up creation from transactions
- [ ] Threshold-based donation processing
- [ ] Webhook handling for reconnection

## Geographic Considerations

⚠️ **Important**: Plaid supports US, Canada, and Europe but **does not support Australia/NZ** where Basq operated.

- If targeting AU/NZ users, consider:
  - Keeping Basq for AU/NZ and supporting multiple providers
  - Finding Plaid alternatives for those markets
  - Geographic routing to appropriate provider

## Support Resources

- [Plaid API Documentation](https://plaid.com/docs/)
- [Plaid Node.js SDK](https://github.com/plaid/plaid-node)
- [Migration Guide for existing codebases](./processed_docs/basiq-to-plaid-migration.md)

## Rollback Plan

If issues arise:

1. Restore previous Basq integration
2. Keep both systems running in parallel during transition
3. Migrate users gradually
4. Monitor error rates and user feedback

## Next Steps

1. [ ] Test with Plaid sandbox environment
2. [ ] Update frontend Plaid Link integration
3. [ ] Configure production Plaid account
4. [ ] Schedule deployment with rollback plan
5. [ ] Communicate changes to users

---

**Note**: This migration replaces the Basq-dependent round-up system with Plaid's transaction API. The fundamental round-up logic remains the same, but the data source and connection method are significantly different.

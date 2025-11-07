# Basiq to Plaid - Quick Reference

## 🚨 Critical Differences

| Aspect                  | Basiq                          | Plaid                              |
| ----------------------- | ------------------------------ | ---------------------------------- |
| **Geographic Coverage** | Australia/NZ only              | US, Canada, Europe                 |
| **Compliance**          | CDR (Consumer Data Right)      | OAuth-style, no CDR                |
| **Consent Model**       | 90-day expiry, CDR consent     | No expiry, OAuth tokens            |
| **API Style**           | REST with API key              | REST with client_id/secret         |
| **Connection Flow**     | Redirect to Basiq consent page | Plaid Link component (embedded)    |
| **Transaction IDs**     | `basiqTransactionId`           | `plaidTransactionId`               |
| **Account IDs**         | `basiqConsentId`               | `plaidItemId` + `plaidAccessToken` |

---

## 📋 Model Field Changes

### BankConnection Model

| Old Field (Basiq)   | New Field (Plaid)   | Notes                                    |
| ------------------- | ------------------- | ---------------------------------------- |
| `basiqConsentId`    | `plaidItemId`       | Required, unique                         |
| -                   | `plaidAccessToken`  | **NEW** - Must encrypt                   |
| `bankName`          | `institutionName`   | Same concept                             |
| `accountId`         | `accountId`         | Different format                         |
| `consentExpiryDate` | `consentExpiryDate` | **Optional** (Plaid tokens don't expire) |
| -                   | `errorCode`         | **NEW** - Plaid error handling           |
| -                   | `errorMessage`      | **NEW** - Plaid error handling           |

### RoundUpTransaction Model

| Old Field (Basiq)    | New Field (Plaid)    | Notes                               |
| -------------------- | -------------------- | ----------------------------------- |
| `basiqTransactionId` | `plaidTransactionId` | Required, unique                    |
| -                    | `plaidAccountId`     | **NEW** - Account reference         |
| -                    | `transactionType`    | **NEW** - 'debit' or 'credit'       |
| -                    | `category`           | **NEW** - Array of categories       |
| -                    | `merchantName`       | **NEW** - Extracted merchant        |
| -                    | `location`           | **NEW** - Transaction location data |

---

## 🔄 Code Changes Summary

### 1. Authentication

```typescript
// OLD: Basiq
const basiqApiKey = process.env.BASIQ_API_KEY;

// NEW: Plaid
const plaidClient = new plaid.Client({
  clientID: process.env.PLAID_CLIENT_ID,
  secret: process.env.PLAID_SECRET,
  env: plaid.environments[process.env.PLAID_ENV],
});
```

### 2. Connection Flow

```typescript
// OLD: Basiq - Redirect to consent URL
window.location.href = basiqConsentUrl;

// NEW: Plaid - Embedded Link component
import { usePlaidLink } from 'react-plaid-link';
const { open } = usePlaidLink({ token: linkToken, onSuccess });
```

### 3. Transaction Fetching

```typescript
// OLD: Basiq
GET / users / { userId } / accounts / { accountId } / transactions;

// NEW: Plaid
plaidClient.transactionsGet({
  access_token: accessToken,
  start_date: '2024-01-01',
  end_date: '2024-01-31',
});
```

---

## 📦 Dependencies

**Remove:**

- Basiq SDK (if used)

**Add:**

```json
{
  "plaid": "^21.0.0",
  "react-plaid-link": "^3.0.0" // Frontend only
}
```

---

## 🔐 Environment Variables

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
PLAID_WEBHOOK_URL=
```

---

## ⚠️ Important Considerations

1. **Geographic Limitation**: Plaid does NOT support Australia/NZ. If your users are in AU/NZ, you cannot use Plaid.

2. **Consent Expiry**: Plaid tokens don't expire like Basiq's 90-day CDR consent. Handle errors differently (ITEM_LOGIN_REQUIRED).

3. **Transaction Processing**: Plaid provides transaction direction (debit/credit) and categories. Update filtering logic.

4. **Webhooks**: Plaid uses webhooks for real-time updates. Implement webhook handler.

5. **Error Handling**: Plaid has different error codes. Handle ITEM_LOGIN_REQUIRED, RATE_LIMIT, etc.

6. **Data Migration**: Existing Basiq connections will need to be reconnected via Plaid.

---

## 🎯 Migration Checklist

- [ ] Update BankConnection model fields
- [ ] Update RoundUpTransaction model fields
- [ ] Install Plaid SDK
- [ ] Create Plaid service layer
- [ ] Update connection flow (frontend + backend)
- [ ] Update transaction fetching logic
- [ ] Implement webhook handler
- [ ] Update environment variables
- [ ] Update error handling
- [ ] Update documentation
- [ ] Test in Plaid sandbox
- [ ] Plan user migration strategy
- [ ] Update privacy policy
- [ ] Update terms of service

---

## 📚 Key Files to Create/Update

### New Files:

- `src/app/config/plaid.ts` - Plaid client configuration
- `src/app/modules/BankConnection/bankConnection.service.ts` - Service layer
- `src/app/modules/BankConnection/bankConnection.model.ts` - Updated model
- `src/app/modules/BankConnection/bankConnection.routes.ts` - Routes with webhook

### Files to Update:

- `src/app/modules/RoundUpTransaction/roundUpTransaction.model.ts` - Field changes
- Frontend bank connection components - Replace Basiq flow with Plaid Link
- Environment configuration files
- Documentation files

---

## 🔗 Resources

- [Plaid API Documentation](https://plaid.com/docs/)
- [Plaid Node.js SDK](https://github.com/plaid/plaid-node)
- [Plaid Link React Component](https://github.com/plaid/react-plaid-link)
- [Plaid Webhooks Guide](https://plaid.com/docs/api/webhooks/)

---

_For detailed migration steps, see: `basiq-to-plaid-migration.md`_

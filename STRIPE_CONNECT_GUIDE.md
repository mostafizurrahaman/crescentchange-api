# Stripe Connect Implementation Guide

## Overview
This guide explains how organizations onboard with Stripe Connect to receive donations, and how the payment flow works end-to-end.

---

## Architecture: How Money Flows

```
Donor's Card
    ↓
[Platform Stripe Account] ← Charges happen here
    ↓
    ↓ (Automatic Transfer via Stripe Connect)
    ↓
[Organization's Stripe Connect Account] ← Money lands here
```

### Key Concepts:

1. **Platform Account**: Your main Stripe account (receives all payments initially)
2. **Connected Accounts**: Each organization has their own Stripe Connect account
3. **`stripeConnectAccountId`**: Stored in `Organization.stripeConnectAccountId` field
4. **Transfer on Charge**: Money automatically transfers to organization using `transfer_data.destination`

---

## Organization Onboarding Flow

### Step 1: Organization Starts Onboarding

**Endpoint:** `POST /api/v1/organization/stripe-connect/onboard`

**Headers:**
```
Authorization: Bearer <organization_access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stripe Connect onboarding initiated successfully",
  "data": {
    "accountId": "acct_1234567890",
    "onboardingUrl": "https://connect.stripe.com/setup/e/acct_xxx/..."
  }
}
```

**What Happens:**
1. Creates Stripe Express Connect account
2. Saves `accountId` to `Organization.stripeConnectAccountId`
3. Returns onboarding URL for organization to complete setup

### Step 2: Organization Completes Onboarding

1. Frontend redirects organization to `onboardingUrl`
2. Organization fills out Stripe Connect form (bank details, tax info, etc.)
3. Stripe redirects back to your `return_url` on success
4. Organization is now ready to receive payments!

### Step 3: Check Onboarding Status

**Endpoint:** `GET /api/v1/organization/stripe-connect/status`

**Headers:**
```
Authorization: Bearer <organization_access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stripe Connect status retrieved successfully",
  "data": {
    "hasAccount": true,
    "accountId": "acct_1234567890",
    "isActive": true,
    "chargesEnabled": true,
    "payoutsEnabled": true,
    "detailsSubmitted": true
  }
}
```

### Step 4: Refresh Onboarding Link (If Needed)

If organization didn't complete onboarding or needs to update info:

**Endpoint:** `POST /api/v1/organization/stripe-connect/refresh`

**Headers:**
```
Authorization: Bearer <organization_access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Onboarding link refreshed successfully",
  "data": {
    "onboardingUrl": "https://connect.stripe.com/setup/e/acct_xxx/..."
  }
}
```

---

## Donation Flow (After Organization is Onboarded)

### End-to-End Donation Process

#### 1. Donor Adds Payment Method (One-time setup)

```javascript
// Step 1: Create setup intent
const setupResponse = await fetch('/api/v1/payment-method/setup-intent', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${donorToken}` }
});
const { client_secret } = await setupResponse.json();

// Step 2: Confirm with Stripe.js
const { setupIntent } = await stripe.confirmCardSetup(client_secret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'John Doe' }
  }
});

// Step 3: Save payment method
await fetch('/api/v1/payment-method', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${donorToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    stripePaymentMethodId: setupIntent.payment_method,
    cardHolderName: 'John Doe',
    isDefault: true
  })
});
```

#### 2. Donor Makes Donation

**Endpoint:** `POST /api/v1/donation/one-time`

**Headers:**
```
Authorization: Bearer <donor_access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "amount": 100,
  "currency": "usd",
  "organizationId": "64abc123",
  "causeId": "64def456",
  "paymentMethodId": "pm_1234567890",
  "specialMessage": "Keep up the great work!"
}
```

**Note:** NO `connectedAccountId` in request! Backend fetches it automatically.

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Donation created and payment initiated successfully",
  "data": {
    "donation": {
      "_id": "64xyz789",
      "amount": 100,
      "status": "processing",
      "organization": "64abc123",
      "cause": "64def456",
      "stripePaymentIntentId": "pi_1234567890"
    },
    "payment": {
      "clientSecret": "pi_xxx_secret_xxx",
      "paymentIntentId": "pi_1234567890",
      "status": "processing"
    }
  }
}
```

#### 3. Backend Processing (Automatic)

```typescript
// What happens in donation.service.ts:

1. Fetch organization by organizationId
2. Get organization.stripeConnectAccountId
3. Validate organization has Connect account (throw error if not)
4. Charge donor's payment method
5. Stripe automatically transfers funds to organization's Connect account
6. Webhook updates donation status to 'completed'
```

---

## Security Improvements

### ✅ What Was Fixed:

1. **Removed client control of `connectedAccountId`**
   - Before: Client could send any `connectedAccountId` (security risk!)
   - After: Backend fetches from Organization model (secure)

2. **Validation added**
   - Donation fails if organization hasn't onboarded
   - Clear error message: "Organization has not set up payment receiving"

3. **Single source of truth**
   - `Organization.stripeConnectAccountId` is the only source
   - No manual entry or client manipulation possible

---

## API Endpoints Summary

### For Organizations:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/organization/stripe-connect/onboard` | Start Stripe Connect onboarding |
| GET | `/api/v1/organization/stripe-connect/status` | Check onboarding status |
| POST | `/api/v1/organization/stripe-connect/refresh` | Refresh onboarding link |

### For Donors:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payment-method/setup-intent` | Create setup intent for adding card |
| POST | `/api/v1/payment-method` | Save payment method |
| GET | `/api/v1/payment-method` | Get saved payment methods |
| POST | `/api/v1/donation/one-time` | Make donation with saved card |

---

## Database Schema

### Organization Model
```typescript
{
  _id: ObjectId,
  auth: ObjectId, // Reference to Auth
  name: String,
  email: String,
  // ... other fields
  stripeConnectAccountId: String, // ← Added for payment receiving
  // ... other fields
}
```

### Donation Model
```typescript
{
  _id: ObjectId,
  donor: ObjectId,
  organization: ObjectId,
  cause: ObjectId,
  amount: Number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  stripePaymentIntentId: String,
  stripeCustomerId: String,
  connectedAccountId: String, // ← Stored for reference, but NOT from client
  // ... other fields
}
```

---

## Testing Flow

### 1. Test Organization Onboarding
```bash
# As organization user
curl -X POST http://localhost:5000/api/v1/organization/stripe-connect/onboard \
  -H "Authorization: Bearer <org_token>"

# Visit the returned onboardingUrl in browser
# Complete Stripe Connect form

# Check status
curl -X GET http://localhost:5000/api/v1/organization/stripe-connect/status \
  -H "Authorization: Bearer <org_token>"
```

### 2. Test Donation
```bash
# As donor, add payment method first (see Payment Flow Guide)

# Make donation
curl -X POST http://localhost:5000/api/v1/donation/one-time \
  -H "Authorization: Bearer <donor_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "organizationId": "64abc123",
    "causeId": "64def456",
    "paymentMethodId": "pm_1234567890"
  }'
```

---

## Error Handling

### Common Errors:

1. **"Organization has not set up payment receiving"**
   - Cause: Organization hasn't completed Stripe Connect onboarding
   - Solution: Organization must call `/onboard` endpoint and complete setup

2. **"Payment method not found"**
   - Cause: Invalid or deleted payment method ID
   - Solution: Donor must add payment method first

3. **"Organization not found"**
   - Cause: Invalid organization ID
   - Solution: Verify organization exists and ID is correct

---

## Stripe Dashboard

### View Connected Accounts:
1. Go to: https://dashboard.stripe.com/connect/accounts
2. See all onboarded organizations
3. View their payment receiving status

### View Donations:
1. Go to: https://dashboard.stripe.com/payments
2. Filter by metadata: `organizationId`, `causeId`
3. See transfer details to connected accounts

---

## Important Notes

1. **Stripe Connect Account Types:**
   - Using `express` accounts (easiest for nonprofits)
   - Stripe handles most compliance/verification
   - Organizations get direct payouts to their bank

2. **Platform Fees (Optional):**
   - Currently not implemented
   - Can add `application_fee_amount` to take platform fee
   - Example: Take 2% from each donation

3. **Testing:**
   - Use Stripe test mode keys
   - Test accounts: Any email works
   - Test bank: Use Stripe test bank numbers

4. **Production:**
   - Switch to live Stripe keys
   - Organizations need real business info
   - Real bank accounts required

---

## Next Steps

- [ ] Test onboarding flow with real organization
- [ ] Test donation flow end-to-end
- [ ] Add webhook handling for account updates
- [ ] Add platform fees (if needed)
- [ ] Add organization payout reporting

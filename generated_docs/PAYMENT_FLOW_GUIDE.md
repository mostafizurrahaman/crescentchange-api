# Payment Flow Implementation Guide

## Overview
This guide explains the new payment flow using Stripe Payment Intents API with saved payment methods for direct in-app donations.

## Key Changes

### 1. Payment Method Management
Users can now save and manage their payment methods (cards, bank accounts, Apple Pay, Google Pay).

### 2. Direct Charges
Donations are processed directly using saved payment methods without redirecting to Stripe's hosted checkout page.

### 3. Custom Amount Validation
All donation amounts are now validated with:
- Minimum: $1
- Maximum: $10,000

## API Endpoints

### Payment Method Management

#### 1. Create Setup Intent (Collect Payment Method)
**POST** `/api/v1/payment-method/setup-intent`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "paymentMethodType": "card"  // Options: card, ideal, sepa_debit
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Setup intent created successfully!",
  "data": {
    "client_secret": "seti_xxx_secret_xxx",
    "setup_intent_id": "seti_xxx"
  }
}
```

**Frontend Flow:**
1. Call this endpoint to get `client_secret`
2. Use Stripe.js to collect payment method:
```javascript
const stripe = Stripe('pk_test_xxx');
const { setupIntent, error } = await stripe.confirmCardSetup(client_secret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'Cardholder Name' }
  }
});
```
3. After successful confirmation, call the "Add Payment Method" endpoint

#### 2. Add Payment Method
**POST** `/api/v1/payment-method`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "stripePaymentMethodId": "pm_xxx",  // From setupIntent.payment_method
  "cardHolderName": "John Doe",
  "isDefault": true
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Payment method added successfully!",
  "data": {
    "_id": "64xxx",
    "user": "64yyy",
    "stripePaymentMethodId": "pm_xxx",
    "stripeCustomerId": "cus_xxx",
    "type": "card",
    "cardBrand": "visa",
    "cardLast4": "4242",
    "cardExpMonth": 12,
    "cardExpYear": 2025,
    "isDefault": true,
    "isActive": true
  }
}
```

#### 3. Get User's Payment Methods
**GET** `/api/v1/payment-method?includeInactive=false`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment methods retrieved successfully!",
  "data": [
    {
      "_id": "64xxx",
      "type": "card",
      "cardBrand": "visa",
      "cardLast4": "4242",
      "cardExpMonth": 12,
      "cardExpYear": 2025,
      "isDefault": true,
      "isActive": true
    }
  ]
}
```

#### 4. Get Default Payment Method
**GET** `/api/v1/payment-method/default`

#### 5. Set Default Payment Method
**PATCH** `/api/v1/payment-method/:id/default`

#### 6. Delete Payment Method
**DELETE** `/api/v1/payment-method/:id`

### Donation Flow

#### Create One-Time Donation (NEW)
**POST** `/api/v1/donation/one-time`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "amount": 127,
  "currency": "usd",
  "organizationId": "64xxx",
  "causeId": "64yyy",
  "paymentMethodId": "pm_xxx",  // REQUIRED - Stripe payment method ID
  "specialMessage": "Keep up the great work!",
  "connectedAccountId": "acct_xxx"  // Optional - for Stripe Connect
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Donation created and payment initiated successfully",
  "data": {
    "donation": {
      "_id": "64zzz",
      "donor": "64aaa",
      "organization": "64xxx",
      "cause": "64yyy",
      "amount": 127,
      "currency": "USD",
      "status": "processing",
      "pointsEarned": 12700,
      "donationType": "one-time",
      "stripePaymentIntentId": "pi_xxx"
    },
    "payment": {
      "clientSecret": "pi_xxx_secret_xxx",
      "paymentIntentId": "pi_xxx",
      "status": "processing"
    }
  }
}
```

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIRST TIME: ADD PAYMENT METHOD                │
└─────────────────────────────────────────────────────────────────┘

1. Frontend: POST /payment-method/setup-intent
   ↓
2. Backend: Create Stripe SetupIntent
   ↓
3. Frontend: Use Stripe.js to confirm card setup
   ↓
4. Frontend: POST /payment-method with pm_xxx
   ↓
5. Backend: Save payment method to database


┌─────────────────────────────────────────────────────────────────┐
│                    MAKE DONATION WITH SAVED CARD                 │
└─────────────────────────────────────────────────────────────────┘

1. Frontend: Select donation amount and cause
   ↓
2. Frontend: Select saved payment method (or default)
   ↓
3. Frontend: POST /donation/one-time with paymentMethodId
   ↓
4. Backend: Create donation record (status: pending)
   ↓
5. Backend: Create Stripe PaymentIntent with payment_method
   ↓
6. Backend: Confirm payment automatically
   ↓
7. Backend: Update donation (status: processing)
   ↓
8. Webhook: payment_intent.succeeded
   ↓
9. Backend: Update donation (status: completed)
   ↓
10. Frontend: Show success message
```

## Payment Status Flow

1. **pending** - Donation record created, waiting for payment
2. **processing** - Payment Intent created and being processed by Stripe
3. **completed** - Payment succeeded (via webhook)
4. **failed** - Payment failed (via webhook)
5. **refunded** - Payment refunded (manual action)

## Webhook Events

Your webhook handler should handle these events:

```javascript
// stripe.route.ts or webhook handler
switch (event.type) {
  case 'payment_intent.succeeded':
    // Update donation status to 'completed'
    await DonationService.updateDonationStatusByPaymentIntent(
      paymentIntent.id,
      'completed'
    );
    break;
    
  case 'payment_intent.payment_failed':
    // Update donation status to 'failed'
    await DonationService.updateDonationStatusByPaymentIntent(
      paymentIntent.id,
      'failed'
    );
    break;
}
```

## Frontend Integration Example

### 1. Add Payment Method (React/TypeScript)

```typescript
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_xxx');

function AddPaymentMethodForm() {
  const stripe = useStripe();
  const elements = useElements();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 1. Create setup intent
    const setupIntentRes = await fetch('/api/v1/payment-method/setup-intent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentMethodType: 'card' })
    });
    
    const { data } = await setupIntentRes.json();
    const { client_secret } = data;
    
    // 2. Confirm card setup
    const cardElement = elements.getElement(CardElement);
    const { setupIntent, error } = await stripe.confirmCardSetup(client_secret, {
      payment_method: {
        card: cardElement,
        billing_details: { name: cardholderName }
      }
    });
    
    if (error) {
      console.error(error);
      return;
    }
    
    // 3. Save payment method
    const addPmRes = await fetch('/api/v1/payment-method', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stripePaymentMethodId: setupIntent.payment_method,
        cardHolderName: cardholderName,
        isDefault: true
      })
    });
    
    const result = await addPmRes.json();
    console.log('Payment method added:', result);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <input type="text" value={cardholderName} onChange={...} />
      <button type="submit">Add Card</button>
    </form>
  );
}
```

### 2. Make Donation

```typescript
async function makeDonation(amount: number, causeId: string, paymentMethodId: string) {
  const response = await fetch('/api/v1/donation/one-time', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount,
      currency: 'usd',
      organizationId: selectedOrganization.id,
      causeId,
      paymentMethodId,
      specialMessage: 'Thank you!'
    })
  });
  
  const result = await response.json();
  
  if (result.data.payment.status === 'processing') {
    // Payment is being processed
    // You can poll the donation status or listen to webhooks
    console.log('Payment processing...', result.data.donation._id);
  }
}
```

## Migration from Checkout Session to Payment Intent

### Old Flow (Checkout Session)
```typescript
// ❌ OLD: Redirect to Stripe hosted page
const response = await fetch('/donation/one-time', {
  method: 'POST',
  body: JSON.stringify({ amount, causeId, organizationId })
});

const { sessionUrl } = await response.json();
window.location.href = sessionUrl; // Redirect user
```

### New Flow (Payment Intent)
```typescript
// ✅ NEW: Direct charge with saved payment method
const response = await fetch('/donation/one-time', {
  method: 'POST',
  body: JSON.stringify({ 
    amount, 
    causeId, 
    organizationId,
    paymentMethodId  // Saved payment method
  })
});

const result = await response.json();
// Stay on the same page, show success message
showSuccess('Donation completed!');
```

## Database Schema

### PaymentMethod Collection
```typescript
{
  _id: ObjectId,
  user: ObjectId,  // Reference to Auth
  stripePaymentMethodId: String,  // pm_xxx
  stripeCustomerId: String,  // cus_xxx
  type: 'card' | 'bank_account' | 'apple_pay' | 'google_pay',
  cardBrand: String,  // 'visa', 'mastercard', etc.
  cardLast4: String,  // '4242'
  cardExpMonth: Number,  // 12
  cardExpYear: Number,  // 2025
  cardHolderName: String,
  isDefault: Boolean,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Donation Collection (Updated)
```typescript
{
  // ... existing fields
  stripePaymentIntentId: String,  // pi_xxx (now created immediately)
  stripeCustomerId: String,  // cus_xxx (from payment method)
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
}
```

## Security Considerations

1. **Payment Method Ownership**: Service layer validates payment method belongs to the user
2. **Amount Validation**: Min $1, Max $10,000 enforced in validation and Stripe service
3. **Idempotency**: Each donation gets unique idempotency key to prevent duplicates
4. **Transaction Safety**: Mongoose transactions ensure atomic operations
5. **Webhook Verification**: Stripe webhook signature verification enabled

## Testing

### Test Cards (Stripe Test Mode)
- **Success**: 4242 4242 4242 4242
- **Requires Authentication**: 4000 0025 0000 3155
- **Declined**: 4000 0000 0000 9995

### Test Flow
1. Add test card using setup intent
2. Create donation with saved payment method
3. Verify donation status changes to 'processing'
4. Trigger webhook manually or wait for Stripe
5. Verify donation status changes to 'completed'

## Error Handling

Common errors and solutions:

1. **"Payment method not found"** - User hasn't added payment method yet
2. **"Payment method is not active"** - Payment method was deleted
3. **"Amount must be between $1 and $10,000"** - Validation error
4. **"Organization not found"** - Invalid organization ID
5. **"Cause ID is required"** - Missing required field

## Next Steps

1. ✅ Payment Method Management - DONE
2. ✅ Direct Charge with Payment Intent - DONE
3. ✅ Custom Amount Validation - DONE
4. ⏳ Test the complete flow with frontend
5. ⏳ Handle 3D Secure authentication for certain cards
6. ⏳ Implement recurring donations with saved payment methods
7. ⏳ Implement round-up donations

# Models Fields - Complete Specification

This document provides detailed field specifications for all models in the Crescent Change platform.

---

## 1. Existing Models

### 1.1 Auth Model

```typescript
{
  _id: ObjectId (auto-generated)
  email: String (required, unique, trimmed)
  password: String (required, hashed, select: false)
  passwordChangedAt: Date (optional)
  isProfile: Boolean (default: false)
  otp: String (required)
  otpExpiry: Date (required)
  isVerifiedByOTP: Boolean (default: false)
  role: String (enum: ['CLIENT', 'BUSINESS', 'ORGANIZATION', 'ADMIN'], default: 'CLIENT')
  isActive: Boolean (default: true)
  isDeleted: Boolean (default: false)
  deactivationReason: String (optional)
  deactivatedAt: Date (optional)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 1.2 Business Model

```typescript
{
  _id: ObjectId (auto-generated)
  auth: ObjectId (required, ref: 'Auth')
  category: String (optional)
  name: String (optional)
  tagLine: String (optional)
  description: String (optional)
  coverImage: String (optional)
  businessPhoneNumber: String (optional)
  businessEmail: String (optional)
  businessWebsite: String (optional)
  locations: [String] (array of strings)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 1.3 Client Model

```typescript
{
  _id: ObjectId (auto-generated)
  auth: ObjectId (required, unique, ref: 'Auth')
  name: String (required)
  address: String (required)
  state: String (required)
  postalCode: String (required)
  image: String (default: defaultUserImage)
  nameInCard: String (optional, encrypted)
  cardNumber: String (optional, encrypted)
  cardExpiryDate: Date (optional)
  cardCVC: String (optional, encrypted)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 1.4 Organization Model

```typescript
{
  _id: ObjectId (auto-generated)
  auth: ObjectId (required, unique, ref: 'Auth')
  name: String (optional)
  serviceType: String (optional)
  address: String (optional)
  state: String (optional)
  postalCode: String (optional)
  website: String (optional)
  phoneNumber: String (optional)
  coverImage: String (optional)
  boardMemberName: String (optional)
  boardMemberEmail: String (optional)
  boardMemberPhoneNumber: String (optional)
  nameInCard: String (optional, encrypted)
  cardNumber: String (optional, encrypted)
  cardExpiryDate: Date (optional)
  cardCVC: String (optional, encrypted)
  tfnOrAbnNumber: String (optional)
  zakatLicenseHolderNumber: String (optional, default: null)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 1.5 Notification Model

```typescript
{
  _id: ObjectId (auto-generated)
  title: String (required)
  message: String (required)
  isSeen: Boolean (default: false)
  receiver: ObjectId (required, ref: 'Auth')
  type: String (enum: NOTIFICATION_TYPE values, required)
  redirectId: String (optional, default: null)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

---

## 2. New Models - Detailed Field Specifications

### 2.1 Badge Model

```typescript
{
  _id: ObjectId (auto-generated)
  name: String (required, unique)
  description: String (required)
  icon: String (required) // URL or icon identifier
  category: String (optional) // Cause category (Education, Health, etc.)
  causeId: ObjectId (optional, ref: 'Organization') // Specific organization
  tiers: {
    colour: {
      threshold: Number (required) // e.g., 1 donation
      description: String (optional)
    },
    bronze: {
      threshold: Number (required) // e.g., 3 donations
      description: String (optional)
    },
    silver: {
      threshold: Number (required) // e.g., 5 donations/month
      description: String (optional)
    },
    gold: {
      threshold: Number (required) // e.g., 10 donations
      description: String (optional)
    }
  }
  unlockConditions: {
    type: String (enum: ['donation_count', 'donation_frequency', 'cause_specific', 'organization_specific', 'roundup_streak'], required)
    value: Number (optional) // For count-based conditions
    period: String (optional) // 'month', 'week', 'year' for frequency
    causeCategory: String (optional) // For cause-specific badges
    organizationId: ObjectId (optional, ref: 'Organization') // For org-specific badges
    consecutiveDays: Number (optional) // For streak-based badges
  }
  isActive: Boolean (default: true)
  isVisible: Boolean (default: true)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.2 UserBadge Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  badge: ObjectId (required, ref: 'Badge')
  currentTier: String (enum: ['colour', 'bronze', 'silver', 'gold'], default: null)
  progressCount: Number (default: 0) // Progress toward next tier
  lastUpdated: Date (auto-updated)
  tierUnlockedDates: {
    colour: Date (optional)
    bronze: Date (optional)
    silver: Date (optional)
    gold: Date (optional)
  }
  isManuallyAssigned: Boolean (default: false) // For admin-assigned badges
  assignedBy: ObjectId (optional, ref: 'Auth') // Admin who assigned
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.3 Donation Model

```typescript
{
  _id: ObjectId (auto-generated)
  donor: ObjectId (required, ref: 'Client')
  organization: ObjectId (required, ref: 'Organization')
  donationType: String (enum: ['one-time', 'recurring', 'round-up'], required)
  amount: Number (required, min: 0.01)
  currency: String (default: 'AUD')
  stripePaymentIntentId: String (optional, unique)
  stripeChargeId: String (optional)
  status: String (enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending')
  donationDate: Date (default: Date.now)
  causeCategory: String (optional) // Education, Health, Emergency Relief, etc.
  specialMessage: String (optional) // Message from donor to organization
  scheduledDonationId: ObjectId (optional, ref: 'ScheduledDonation') // If from recurring
  roundUpId: ObjectId (optional, ref: 'RoundUp') // If from round-up
  roundUpTransactionIds: [ObjectId] (optional, ref: 'RoundUpTransaction') // If from round-up
  receiptGenerated: Boolean (default: false)
  receiptId: ObjectId (optional, ref: 'DonationReceipt')
  pointsEarned: Number (default: 0) // Calculated: amount * 100
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.4 RoundUp Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  organization: ObjectId (required, ref: 'Organization')
  bankConnection: ObjectId (required, ref: 'BankConnection')
  thresholdAmount: Number (optional) // e.g., $50
  monthlyLimit: Number (optional) // Maximum monthly round-up amount
  autoDonateTrigger: {
    type: String (enum: ['amount', 'days', 'both'], required)
    amount: Number (optional) // Trigger when accumulated amount reaches this
    days: Number (optional, default: 30) // Trigger after X days
  }
  specialMessage: String (optional)
  isActive: Boolean (default: true)
  currentAccumulatedAmount: Number (default: 0)
  lastDonationDate: Date (optional)
  nextAutoDonationDate: Date (optional) // Calculated based on trigger
  cycleStartDate: Date (default: Date.now) // Start of current 30-day cycle
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.5 RoundUpTransaction Model

```typescript
{
  _id: ObjectId (auto-generated)
  roundUp: ObjectId (required, ref: 'RoundUp')
  user: ObjectId (required, ref: 'Client')
  basiqTransactionId: String (required, unique) // From Basiq API
  originalAmount: Number (required) // Original transaction amount
  roundUpValue: Number (required, min: 0.01, max: 0.99)
  transactionDate: Date (required)
  transactionDescription: String (optional) // From bank transaction
  processed: Boolean (default: false) // Whether included in a donation
  donationId: ObjectId (optional, ref: 'Donation') // If processed into donation
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.6 Reward Model

```typescript
{
  _id: ObjectId (auto-generated)
  business: ObjectId (required, ref: 'Business')
  title: String (required)
  description: String (required)
  rewardType: String (enum: ['in-store', 'online'], required)
  pointCost: Number (required, min: 1)
  category: String (optional) // Food, Clothing, Health, etc.
  tags: [String] (optional) // Array of tags for filtering
  imageUrl: String (optional)
  redemptionLimit: Number (optional) // Total number of redemptions allowed
  redeemedCount: Number (default: 0)
  expiryDate: Date (optional)
  status: String (enum: ['active', 'expired', 'archived', 'upcoming'], default: 'active')
  termsAndConditions: String (optional)
  isVisible: Boolean (default: true)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.7 RewardRedemption Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  reward: ObjectId (required, ref: 'Reward')
  business: ObjectId (required, ref: 'Business')
  redemptionMethod: String (enum: ['qr', 'nfc', 'static'], required)
  uniqueCode: String (required, unique) // QR code data, NFC token, or static code
  status: String (enum: ['active', 'claimed', 'redeemed', 'expired'], default: 'active')
  pointsSpent: Number (required)
  expiresAt: Date (optional) // For time-limited redemptions
  redeemedAt: Date (optional)
  validatedBy: ObjectId (optional, ref: 'Business') // Business that validated
  validatedAt: Date (optional)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.8 Points Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, unique, ref: 'Client')
  totalPointsEarned: Number (default: 0)
  totalPointsSpent: Number (default: 0)
  currentBalance: Number (default: 0) // Calculated: earned - spent
  lastUpdated: Date (auto-updated)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.9 PointsTransaction Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  transactionType: String (enum: ['earned', 'spent'], required)
  pointsAmount: Number (required, min: 1)
  sourceType: String (enum: ['donation', 'reward_redemption', 'manual_adjustment'], required)
  sourceId: ObjectId (optional) // Donation ID or RewardRedemption ID
  description: String (optional)
  transactionDate: Date (default: Date.now)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.10 DonationReceipt Model

```typescript
{
  _id: ObjectId (auto-generated)
  donation: ObjectId (required, ref: 'Donation')
  user: ObjectId (required, ref: 'Client')
  organization: ObjectId (required, ref: 'Organization')
  receiptNumber: String (required, unique) // Format: CC-YYYYMMDD-XXXXX
  pdfUrl: String (required) // URL to stored PDF
  emailSent: Boolean (default: false)
  emailSentAt: Date (optional)
  taxDeductible: Boolean (default: false) // Based on organization status
  zakatEligible: Boolean (default: false) // Based on organization status
  generatedAt: Date (default: Date.now)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.11 ScheduledDonation Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  organization: ObjectId (required, ref: 'Organization')
  amount: Number (required, min: 0.01)
  currency: String (default: 'AUD')
  frequency: String (enum: ['daily', 'weekly', 'monthly', 'yearly'], required)
  startDate: Date (required)
  nextDonationDate: Date (required)
  endDate: Date (optional) // Null for indefinite
  isActive: Boolean (default: true)
  lastExecutedDate: Date (optional)
  totalExecutions: Number (default: 0)
  causeCategory: String (optional)
  specialMessage: String (optional)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.12 BankConnection Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  basiqConsentId: String (required, unique) // From Basiq API
  bankName: String (required)
  accountId: String (required) // From Basiq
  accountType: String (optional) // 'savings', 'checking', etc.
  accountNumber: String (optional, masked) // Last 4 digits only
  consentStatus: String (enum: ['active', 'expired', 'revoked'], default: 'active')
  consentExpiryDate: Date (required)
  connectedDate: Date (default: Date.now)
  lastSyncedDate: Date (optional)
  isActive: Boolean (default: true)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### 2.13 BusinessFollower Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  business: ObjectId (required, ref: 'Business')
  notificationPreferences: {
    newRewards: Boolean (default: true)
    rewardUpdates: Boolean (default: true)
    specialOffers: Boolean (default: true)
  }
  followedDate: Date (default: Date.now)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)

  // Compound unique index on (user, business)
}
```

### 2.14 OrganizationFollower Model

```typescript
{
  _id: ObjectId (auto-generated)
  user: ObjectId (required, ref: 'Client')
  organization: ObjectId (required, ref: 'Organization')
  notificationPreferences: {
    newCampaigns: Boolean (default: true)
    impactUpdates: Boolean (default: true)
    donationReminders: Boolean (default: false)
  }
  followedDate: Date (default: Date.now)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)

  // Compound unique index on (user, organization)
}
```

---

## 3. Index Recommendations

### Critical Indexes

```javascript
// Auth
{ email: 1 } // Unique index
{ role: 1, isActive: 1 }

// Client
{ auth: 1 } // Unique index

// Donation
{ donor: 1, donationDate: -1 }
{ organization: 1, donationDate: -1 }
{ status: 1, donationDate: -1 }
{ stripePaymentIntentId: 1 } // Unique index

// RoundUp
{ user: 1, isActive: 1 }
{ organization: 1 }

// RoundUpTransaction
{ basiqTransactionId: 1 } // Unique index
{ roundUp: 1, processed: 1 }
{ user: 1, transactionDate: -1 }

// Reward
{ business: 1, status: 1 }
{ status: 1, expiryDate: 1 }
{ category: 1, status: 1 }

// RewardRedemption
{ uniqueCode: 1 } // Unique index
{ user: 1, status: 1 }
{ business: 1, status: 1 }

// Points
{ user: 1 } // Unique index

// PointsTransaction
{ user: 1, transactionDate: -1 }
{ sourceType: 1, sourceId: 1 }

// UserBadge
{ user: 1, badge: 1 } // Compound unique index

// BusinessFollower
{ user: 1, business: 1 } // Compound unique index

// OrganizationFollower
{ user: 1, organization: 1 } // Compound unique index
```

---

## 4. Field Validation Rules

### Amount Fields

- All monetary amounts: `Number`, `min: 0.01`, precision: 2 decimal places
- Currency: Default 'AUD', stored as String

### Date Fields

- All dates stored as `Date` objects
- Timestamps use `Date.now` or `new Date()`
- Expiry dates must be validated against current date

### Enum Fields

- Use strict enum validation
- Store as String type
- Define enum values in constants file

### Reference Fields

- All ObjectId references must validate existence
- Use Mongoose `ref` for population
- Cascade delete considerations (soft delete preferred)

### Unique Fields

- Email addresses
- Stripe payment intent IDs
- Basiq transaction IDs
- Receipt numbers
- Reward redemption codes

---

## 5. Data Types Summary

| Field Type | Usage                       | Examples                    |
| ---------- | --------------------------- | --------------------------- |
| ObjectId   | References to other models  | `ref: 'Client'`             |
| String     | Text data, enums, IDs       | Names, descriptions, status |
| Number     | Amounts, counts, thresholds | Amounts, points, thresholds |
| Boolean    | Flags, status               | `isActive`, `isVisible`     |
| Date       | Timestamps, dates           | `createdAt`, `expiryDate`   |
| Array      | Lists, tags                 | `locations: [String]`       |
| Object     | Nested structures           | `tiers`, `unlockConditions` |

---

_Last Updated: [Current Date]_
_Document Version: 1.0_

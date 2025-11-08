# MongoDB ER Diagram for Crescent Change APIs

## Overview
This document outlines the Entity-Relationship diagram for the Crescent Change donation platform MongoDB database. The system manages donations between clients (donors) and organizations (charities), with support for various donation types including one-time, recurring, and round-up donations.

## Core Entities and Relationships

```
┌─────────────────┐       ┌──────────────────┐
│      Auth       │◄─────┤      Client      │
│                 │ 1:1  │                  │
│ - email        │      │ - name           │
│ - password     │      │ - address        │
│ - role          │      │ - postalCode     │
│ - isActive     │      │ - image          │
│ - isDeleted    │      └──────────────────┘
└─────────────────┘                │
         │                         │
         │ 1:1                      │
         ▼                         ▼
┌─────────────────┐       ┌──────────────────┐
│   Organization  │◄─────┤     Business      │
│                 │ 1:1  │                  │
│ - name         │      │ - category       │
│ - serviceType  │      │ - tagLine        │
│ - address      │      │ - description    │
│ - tfnOrAbnNumber│     │ - locations      │
│ - stripeConnect│      └──────────────────┘
│   AccountId    │
└─────────────────┘                │
         │                         │
         │                         │
         ▼                         │
┌─────────────────┐                │
│     Donation    │                │
│                 │                │
│ - donor         │◄───────────────┘
│ - organization  │ 1:many
│ - cause         │
│ - amount        │
│ - donationType  │
│ - status        │
│ - stripePayment │
│   IntentId      │
└─────────────────┘
         │
         │ 1:many
         ▼
┌─────────────────┐
│      Cause      │
│                 │
│ - name          │
│ - notes         │
│ - organization  │
└─────────────────┘

┌─────────────────┐       ┌──────────────────┐
│ BankConnection  │◄─────┤RoundUpTransaction│
│                 │ 1:many│                  │
│ - user          │      │ - roundUp        │
│ - plaidItemId   │      │ - user           │
│ - plaidAccessToken│    │ - plaidTransaction│
│ - institutionId │      │   Id            │
│ - consentStatus│      │ - originalAmount │
│ - isActive      │      │ - roundUpValue   │
└─────────────────┘       └──────────────────┘
         │                         │
         │                         │
         ▼                         │
┌─────────────────┐                │
│     RoundUp     │◄───────────────┘
│                 │ 1:many
│ - userId        │
│ - bankConnection│
│ - monthlyLimit  │
│ - charity       │
└─────────────────┘

┌─────────────────┐
│  Notification   │
│                 │
│ - title         │
│ - message       │
│ - receiver      │◄─ Auth (1:many)
│ - isSeen        │
│ - type          │
└─────────────────┘
```

## Detailed Entity Descriptions

### 1. Auth Collection
**Purpose**: Central authentication and authorization system

**Schema**:
```typescript
{
  email: string (unique, required)
  password: string (hashed, required)
  role: enum [CLIENT, BUSINESS, ORGANIZATION, ADMIN]
  isActive: boolean
  isDeleted: boolean
  otp: string
  otpExpiry: Date
  isVerifiedByOTP: boolean
  isProfile: boolean
  passwordChangedAt: Date
  deactivationReason: string
  deactivatedAt: Date
}
```

**Relationships**:
- 1:1 with Client
- 1:1 with Business  
- 1:1 with Organization
- 1:many with Notification (as receiver)

### 2. Client Collection
**Purpose**: Donor/user profile information

**Schema**:
```typescript
{
  auth: ObjectId (ref: 'Auth', unique)
  name: string
  address: string
  state: string
  postalCode: string
  image: string
  nameInCard: string
  cardNumber: string
  cardExpiryDate: Date
  cardCVC: string
}
```

**Relationships**:
- Belongs to Auth (1:1)
- Referenced by Donation (as donor)
- Referenced by BankConnection (as user)
- Referenced by RoundUpTransaction (as user)

### 3. Organization Collection
**Purpose**: Charity/organization profiles

**Schema**:
```typescript
{
  auth: ObjectId (ref: 'Auth', unique)
  name: string
  serviceType: string
  address: string
  state: string
  postalCode: string
  website: string
  phoneNumber: string
  coverImage: string
  tfnOrAbnNumber: string
  zakatLicenseHolderNumber: string
  stripeConnectAccountId: string
  boardMemberName: string
  boardMemberEmail: string
  boardMemberPhoneNumber: string
  drivingLicenseURL: string
  nameInCard: string
  cardNumber: string
  cardExpiryDate: Date
  cardCVC: string
}
```

**Relationships**:
- Belongs to Auth (1:1)
- Referenced by Donation (as organization)
- Referenced by Cause

### 4. Business Collection
**Purpose**: Business profiles for participating businesses

**Schema**:
```typescript
{
  auth: ObjectId (ref: 'Auth')
  category: string
  name: string
  tagLine: string
  description: string
  coverImage: string
  businessPhoneNumber: string
  businessEmail: string
  businessWebsite: string
  locations: [string]
}
```

**Relationships**:
- Belongs to Auth (1:1)

### 5. Donation Collection
**Purpose**: Central donation tracking system

**Schema**:
```typescript
{
  donor: ObjectId (ref: 'Client')
  organization: ObjectId (ref: 'Organization')
  cause: ObjectId (ref: 'Cause', optional)
  donationType: enum [one-time, recurring, round-up]
  amount: number (in cents)
  currency: string (default: USD)
  stripePaymentIntentId: string (unique)
  stripeChargeId: string (unique)
  stripeConnectAccountId: string
  status: enum [pending, completed, failed, refunded]
  donationDate: Date
  specialMessage: string
  scheduledDonationId: ObjectId
  roundUpId: ObjectId (ref: 'RoundUp')
  roundUpTransactionIds: [ObjectId] (ref: 'RoundUpTransaction')
  receiptGenerated: boolean
  receiptId: ObjectId (ref: 'DonationReceipt')
  pointsEarned: number
  refundAmount: number
  refundDate: Date
  refundReason: string
}
```

**Relationships**:
- References Client (donor)
- References Organization
- References Cause (optional)
- References RoundUp (for round-up donations)
- References many RoundUpTransaction

### 6. Cause Collection
**Purpose**: Categories/causes for donations

**Schema**:
```typescript
{
  name: string (enum values)
  notes: string
  organization: ObjectId (ref: 'Organization')
}
```

**Relationships**:
- Belongs to Organization
- Referenced by Donation

### 7. BankConnection Collection
**Purpose**: User's bank account connections via Plaid

**Schema**:
```typescript
{
  user: ObjectId (ref: 'Client')
  plaidItemId: string (unique)
  plaidAccessToken: string (secure)
  institutionId: string
  institutionName: string
  accountId: string
  accountName: string
  accountType: enum [depository, credit, loan, investment, other]
  accountSubtype: string
  accountNumber: string
  consentStatus: enum [active, expired, revoked, error]
  consentExpiryDate: Date
  webhookUrl: string
  lastSuccessfulUpdate: Date
  errorCode: string
  errorMessage: string
  connectedDate: Date
  lastSyncedDate: Date
  isActive: boolean
}
```

**Relationships**:
- Belongs to Client
- Referenced by RoundUpTransaction
- Referenced by RoundUp

### 8. RoundUpTransaction Collection
**Purpose**: Individual transactions that generate round-up amounts

**Schema**:
```typescript
{
  roundUp: ObjectId (ref: 'RoundUp')
  user: ObjectId (ref: 'Client')
  bankConnection: ObjectId (ref: 'BankConnection')
  plaidTransactionId: string (unique)
  plaidAccountId: string
  originalAmount: number
  roundUpValue: number
  transactionDate: Date
  transactionDescription: string
  transactionType: enum [debit, credit]
  category: [string]
  merchantName: string
  location: {
    address: string
    city: string
    region: string
    postalCode: string
    country: string
    lat: number
    lon: number
  }
  processed: boolean
  donationId: ObjectId (ref: 'Donation')
}
```

**Relationships**:
- Belongs to Client
- Belongs to BankConnection
- Belongs to RoundUp
- References Donation (when processed)

### 9. Notification Collection
**Purpose**: System notifications for users

**Schema**:
```typescript
{
  title: string
  message: string
  isSeen: boolean
  receiver: ObjectId (ref: 'Auth')
  type: enum [various notification types]
  redirectId: string
}
```

**Relationships**:
- Belongs to Auth (receiver)

### 10. RoundUp Collection (referenced but not directly provided)

**Schema** (inferred from references):
```typescript
{
  userId: ObjectId (ref: 'Client')
  bankConnection: ObjectId (ref: 'BankConnection')
  monthlyLimit: number
  charity: ObjectId (ref: 'Organization')
  // Additional fields for timing, thresholds, etc.
}
```

**Relationships**:
- Belongs to Client
- Belongs to BankConnection
- References Organization (charity)
- Referenced by Donation
- Referenced by RoundUpTransaction

## Key Relationships Summary

1. **Auth to Profile Models**: One-to-one relationships with Client, Business, and Organization
2. **Donation Flow**: Client (donor) → Donation → Organization (recipient) → Cause
3. **Round-Up Flow**: Client → BankConnection → RoundUp → RoundUpTransaction → Donation
4. **Notification System**: Auth ↔ Notifications (one-to-many)

## Indexes and Performance Considerations

### Critical Indexes:
- `Auth.email` (unique)
- `Donation.donor`, `Donation.organization` (compound indexes)
- `Donation.donationDate`, `Donation.status`
- `RoundUpTransaction.user`, `RoundUpTransaction.processed`
- `RoundUpTransaction.plaidTransactionId` (unique)
- `BankConnection.user`, `BankConnection.consentStatus`

### Data Integrity:
- Foreign key relationships maintained via ObjectIds
- Referential integrity handled at application level
- Soft deletes implemented in Auth model

## Security Notes:
- Sensitive data (passwords, access tokens) properly secured
- Bank access tokens excluded from default queries
- Audit trails implemented through timestamps
- User consent status tracked for bank connections

This ER diagram provides a complete view of the data relationships in the Crescent Change donation platform, supporting both traditional donations and innovative round-up donation mechanisms.

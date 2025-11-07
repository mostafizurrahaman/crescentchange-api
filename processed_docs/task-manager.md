# Task Manager - Comprehensive Model Analysis

## Executive Summary

This document provides a comprehensive analysis of all models required for the Crescent Change platform based on the requirements documentation. The analysis includes existing models, new models needed, and their relationships.

---

## 1. Existing Models Analysis

### 1.1 Auth Model

- **Purpose**: Handles user authentication, OTP verification, and role management
- **Status**: ✅ Implemented
- **Key Features**:
  - Email-based authentication
  - OTP verification system
  - Role-based access (CLIENT, BUSINESS, ORGANIZATION, ADMIN)
  - Password management with bcrypt
  - Account activation/deactivation

### 1.2 Business Model

- **Purpose**: Stores business profile information
- **Status**: ✅ Implemented
- **Key Features**:
  - Business details (name, category, description)
  - Contact information
  - Location data
  - Links to Auth model

### 1.3 Client Model

- **Purpose**: Stores client/donor profile information
- **Status**: ✅ Implemented
- **Key Features**:
  - Personal information (name, address, state, postal code)
  - Profile image
  - Payment card information (encrypted)
  - Links to Auth model

### 1.4 Organization Model

- **Purpose**: Stores charity/organization profile information
- **Status**: ✅ Implemented
- **Key Features**:
  - Organization details (name, service type)
  - Contact and location information
  - Board member information
  - Payment card information
  - ABN/TFN and Zakat license numbers
  - Links to Auth model

### 1.5 Notification Model

- **Purpose**: Manages user notifications
- **Status**: ✅ Implemented
- **Key Features**:
  - Notification types (various notification categories)
  - Seen/unseen status
  - Receiver tracking
  - Redirect functionality

---

## 2. New Models Required

### 2.1 Badge Model

- **Purpose**: Defines badge templates with tier structures
- **Priority**: High
- **Requirements Source**: `badge-management.md`
- **Key Fields**:
  - Badge name, description, icon
  - Category/cause association
  - Tier definitions (Colour, Bronze, Silver, Gold)
  - Unlock conditions per tier
  - Active/inactive status
  - Visibility controls

### 2.2 UserBadge Model

- **Purpose**: Tracks user progress toward badge tiers
- **Priority**: High
- **Requirements Source**: `badge-management.md`
- **Key Fields**:
  - User reference (Client)
  - Badge reference
  - Current tier achieved
  - Progress count toward next tier
  - Last updated timestamp
  - Unlocked date per tier

### 2.3 Donation Model

- **Purpose**: Records all donation transactions (one-time, recurring, round-up)
- **Priority**: Critical
- **Requirements Source**: Multiple docs (donation_dashboard.md, roundup-donation-engine.md, automated_donation_receipt_generation.md)
- **Key Fields**:
  - Donor (Client reference)
  - Organization reference
  - Donation type (one-time, recurring, round-up)
  - Amount
  - Stripe payment intent ID
  - Status (pending, completed, failed)
  - Donation date
  - Cause/category
  - Special message (optional)

### 2.4 RoundUp Model

- **Purpose**: Manages round-up donation settings per user
- **Priority**: High
- **Requirements Source**: `round-up-dashboard.md`, `roundup-donation-engine.md`
- **Key Fields**:
  - User reference (Client)
  - Organization reference (selected charity)
  - Bank connection reference
  - Threshold amount
  - Monthly limit
  - Auto-donate trigger (amount or days)
  - Special message
  - Is active flag
  - Current accumulated amount
  - Last donation date
  - Next auto-donation date

### 2.5 RoundUpTransaction Model

- **Purpose**: Tracks individual round-up transactions from bank transactions
- **Priority**: High
- **Requirements Source**: `roundup-donation-engine.md`
- **Key Fields**:
  - RoundUp reference
  - User reference
  - Original transaction ID (from Basiq)
  - Original amount
  - Round-up value
  - Transaction date
  - Processed status
  - Assigned organization

### 2.6 Reward Model

- **Purpose**: Stores rewards offered by businesses
- **Priority**: High
- **Requirements Source**: `reward-page.md`, `reward_management_page.md`
- **Key Fields**:
  - Business reference
  - Title, description
  - Reward type (in-store, online)
  - Point cost
  - Category/tags
  - Image URL
  - Redemption limit
  - Redeemed count
  - Expiry date
  - Status (active, expired, archived)
  - Terms and conditions

### 2.7 RewardRedemption Model

- **Purpose**: Tracks reward redemptions and validation
- **Priority**: High
- **Requirements Source**: `reward_redemtion.md`, `redeem_rewards_validation_&_tracking.md`
- **Key Fields**:
  - User reference (Client)
  - Reward reference
  - Business reference
  - Redemption method (QR, NFC, static code)
  - Unique code/token
  - Status (active, claimed, redeemed, expired)
  - Points spent
  - Created at, redeemed at, expires at
  - Validated by business (timestamp)

### 2.8 Points Model

- **Purpose**: Manages user points balance
- **Priority**: High
- **Requirements Source**: `reward-page.md`, `donation_dashboard.md`
- **Key Fields**:
  - User reference (Client)
  - Total points earned
  - Total points spent
  - Current balance
  - Last updated

### 2.9 PointsTransaction Model

- **Purpose**: Transaction history for points (earned/spent)
- **Priority**: High
- **Requirements Source**: `reward-page.md`, `donation_dashboard.md`
- **Key Fields**:
  - User reference (Client)
  - Transaction type (earned, spent)
  - Points amount
  - Source reference (Donation ID or RewardRedemption ID)
  - Description
  - Transaction date

### 2.10 DonationReceipt Model

- **Purpose**: Stores generated donation receipts
- **Priority**: Medium
- **Requirements Source**: `automated_donation_receipt_generation.md`
- **Key Fields**:
  - Donation reference
  - User reference (Client)
  - Organization reference
  - Receipt number (unique)
  - PDF URL
  - Generated date
  - Email sent status
  - Tax deductible status
  - Zakat eligible status

### 2.11 ScheduledDonation Model

- **Purpose**: Manages recurring/scheduled donations
- **Priority**: High
- **Requirements Source**: `donation_dashboard.md`
- **Key Fields**:
  - User reference (Client)
  - Organization reference
  - Amount
  - Frequency (daily, weekly, monthly, yearly)
  - Start date
  - Next donation date
  - End date (optional)
  - Is active flag
  - Last executed date
  - Total executions count

### 2.12 BankConnection Model

- **Purpose**: Stores Basiq CDR consent and bank connection data
- **Priority**: High
- **Requirements Source**: `roundup-donation-engine.md`, `sign_up_sign_in.md`
- **Key Fields**:
  - User reference (Client)
  - Basiq consent ID
  - Bank name
  - Account ID (from Basiq)
  - Consent status (active, expired, revoked)
  - Consent expiry date
  - Connected date
  - Last synced date

### 2.13 BusinessFollower Model

- **Purpose**: Tracks users following businesses
- **Priority**: Medium
- **Requirements Source**: `business_profile_page.md`, `analyst_page.md`
- **Key Fields**:
  - User reference (Client)
  - Business reference
  - Followed date
  - Notification preferences

### 2.14 OrganizationFollower Model

- **Purpose**: Tracks users following organizations
- **Priority**: Medium
- **Requirements Source**: `explore_page.md`
- **Key Fields**:
  - User reference (Client)
  - Organization reference
  - Followed date
  - Notification preferences

---

## 3. Model Count Summary

### Existing Models: 5

1. Auth
2. Business
3. Client
4. Organization
5. Notification

### New Models Required: 14

1. Badge
2. UserBadge
3. Donation
4. RoundUp
5. RoundUpTransaction
6. Reward
7. RewardRedemption
8. Points
9. PointsTransaction
10. DonationReceipt
11. ScheduledDonation
12. BankConnection
13. BusinessFollower
14. OrganizationFollower

### Total Models: 19

---

## 4. Priority Classification

### Critical Priority (Must implement first)

- Donation
- Points
- PointsTransaction
- Reward
- RewardRedemption

### High Priority (Core features)

- Badge
- UserBadge
- RoundUp
- RoundUpTransaction
- ScheduledDonation
- BankConnection

### Medium Priority (Enhancement features)

- DonationReceipt
- BusinessFollower
- OrganizationFollower

---

## 5. Implementation Dependencies

### Phase 1: Foundation

1. Donation Model (core functionality)
2. Points & PointsTransaction (reward system foundation)
3. Reward Model (business rewards)

### Phase 2: Round-Up System

1. BankConnection (Basiq integration)
2. RoundUp (settings)
3. RoundUpTransaction (tracking)

### Phase 3: Gamification

1. Badge Model
2. UserBadge Model

### Phase 4: Additional Features

1. RewardRedemption
2. ScheduledDonation
3. DonationReceipt
4. BusinessFollower
5. OrganizationFollower

---

## 6. Key Relationships Overview

### User-Centric Relationships

- Client → Donations (one-to-many)
- Client → Points (one-to-one)
- Client → UserBadges (one-to-many)
- Client → RoundUp (one-to-many, one per bank account)
- Client → BankConnection (one-to-many)
- Client → RewardRedemptions (one-to-many)
- Client → ScheduledDonations (one-to-many)

### Business Relationships

- Business → Rewards (one-to-many)
- Business → RewardRedemptions (one-to-many)
- Business → BusinessFollowers (one-to-many)

### Organization Relationships

- Organization → Donations (one-to-many)
- Organization → RoundUp (one-to-many)
- Organization → ScheduledDonations (one-to-many)
- Organization → OrganizationFollowers (one-to-many)

### Cross-Model Relationships

- Donation → PointsTransaction (triggers point earning)
- RewardRedemption → PointsTransaction (triggers point spending)
- RoundUpTransaction → Donation (creates donation when threshold met)

---

## 7. Data Flow Patterns

### Donation Flow

1. User makes donation → Donation record created
2. PointsTransaction created (earn points)
3. UserBadge progress updated (if applicable)
4. DonationReceipt generated (if applicable)
5. Notification sent to user

### Round-Up Flow

1. BankConnection established (Basiq consent)
2. RoundUp settings configured
3. RoundUpTransaction records created from bank feed
4. When threshold met → Donation created
5. PointsTransaction created
6. UserBadge progress updated

### Reward Redemption Flow

1. User redeems reward → RewardRedemption created
2. PointsTransaction created (spend points)
3. Unique code/token generated
4. Business validates → Status updated to "redeemed"
5. Notification sent to user

---

## 8. Notes and Considerations

### Security

- Payment card information should be encrypted
- Basiq consent data must be securely stored
- Reward codes must be unique and non-guessable

### Performance

- Index on frequently queried fields (user_id, organization_id, business_id)
- Consider caching for badge progress calculations
- Aggregate points balance to avoid recalculating from transactions

### Compliance

- CDR consent management (Basiq)
- Tax receipt generation requirements
- Zakat eligibility tracking

### Scalability

- Consider archiving old transactions
- Implement soft deletes for important records
- Plan for high-volume round-up transaction processing

---

## 9. Next Steps

1. Review and approve model structure
2. Create database schema/migrations
3. Implement models in order of priority
4. Set up relationships and indexes
5. Implement validation and business logic
6. Create API endpoints for each model
7. Implement background jobs for automated processes (round-up, scheduled donations)

---

_Last Updated: [Current Date]_
_Document Version: 1.0_

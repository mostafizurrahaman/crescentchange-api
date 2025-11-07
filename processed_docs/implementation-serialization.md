# Module Implementation Serialization Plan

## Overview

This document provides a serialized (ordered) implementation plan for all modules in the Crescent Change platform. Modules are ordered based on dependencies, priority, and logical flow.

---

## Implementation Order

### ✅ Phase 0: Existing Modules (Already Implemented)

These modules are complete and functional:

1. **Auth Module** ✅

   - Authentication, OTP, role management
   - Status: Complete

2. **Client Module** ✅

   - Donor profile management
   - Status: Complete

3. **Business Module** ✅

   - Business profile management
   - Status: Complete

4. **Organization Module** ✅

   - Charity/organization profiles
   - Status: Complete

5. **Notification Module** ✅

   - User notifications system
   - Status: Complete

6. **Admin Module** ✅
   - Admin management
   - Status: Complete

---

### 🔴 Phase 1: Foundation (Critical - Implement First)

**Priority: CRITICAL**  
**Estimated Order: 1-3**

#### 1.1 Cause Module

- **Why First**: Establishes the cause catalog used across donor, organization, and admin experiences
- **Dependencies**: None (standalone)
- **Key Features**:
  - Cause definitions (name, slug, description, icon, default visibility)
  - Cause categorisation (parent/child or thematic grouping)
  - Cause activation/deactivation controls
  - Assign causes to organizations with featured priority
  - Expose public cause list for donor discovery
- **Files to Create**:
  - `src/app/modules/Cause/cause.model.ts`
  - `src/app/modules/Cause/cause.interface.ts`
  - `src/app/modules/Cause/cause.service.ts`
  - `src/app/modules/Cause/cause.controller.ts`
  - `src/app/modules/Cause/cause.route.ts`
  - `src/app/modules/Cause/cause.validation.ts`

#### 1.2 Donation Module

- **Why Second**: Core functionality - all other features depend on donations
- **Dependencies**: Client, Organization, Cause (from 1.1)
- **Key Features**:
  - One-time donations
  - Recurring donations (basic structure)
  - Round-up donations (basic structure)
  - Cause selection and validation per organization
  - Stripe payment integration (USD as base currency, $1 = 100 points)
  - Donation status tracking & receipt flags
- **Files to Create**:
  - `src/app/modules/Donation/donation.model.ts`
  - `src/app/modules/Donation/donation.interface.ts`
  - `src/app/modules/Donation/donation.service.ts`
  - `src/app/modules/Donation/donation.controller.ts`
  - `src/app/modules/Donation/donation.route.ts`
  - `src/app/modules/Donation/donation.validation.ts`

#### 1.3 Points Module

- **Why Third**: Reward system foundation - needed for rewards
- **Dependencies**: Client (exists ✅), Donation (from 1.2)
- **Key Features**:
  - Points balance management
  - Points calculation ($1 USD = 100 points)
  - Balance tracking
- **Files to Create**:
  - `src/app/modules/Points/points.model.ts`
  - `src/app/modules/Points/points.interface.ts`
  - `src/app/modules/Points/points.service.ts`
  - `src/app/modules/Points/points.controller.ts`
  - `src/app/modules/Points/points.route.ts`
  - `src/app/modules/Points/points.validation.ts`

#### 1.4 PointsTransaction Module

- **Why Fourth**: Transaction history for points - needed with Points
- **Dependencies**: Client (exists ✅), Points (from 1.3), Donation (from 1.2)
- **Key Features**:
  - Track points earned from donations
  - Track points spent on rewards
  - Transaction history
- **Files to Create**:
  - `src/app/modules/PointsTransaction/pointsTransaction.model.ts`
  - `src/app/modules/PointsTransaction/pointsTransaction.interface.ts`
  - `src/app/modules/PointsTransaction/pointsTransaction.service.ts`
  - `src/app/modules/PointsTransaction/pointsTransaction.controller.ts`
  - `src/app/modules/PointsTransaction/pointsTransaction.route.ts`
  - `src/app/modules/PointsTransaction/pointsTransaction.validation.ts`

#### 1.5 Reward Module

- **Why Fifth**: Business rewards - needed before redemption
- **Dependencies**: Business (exists ✅), Points (from 1.3)
- **Key Features**:
  - Reward creation by businesses
  - In-store and online rewards
  - Point cost management
  - Redemption limits
- **Files to Create**:
  - `src/app/modules/Reward/reward.model.ts`
  - `src/app/modules/Reward/reward.interface.ts`
  - `src/app/modules/Reward/reward.service.ts`
  - `src/app/modules/Reward/reward.controller.ts`
  - `src/app/modules/Reward/reward.route.ts`
  - `src/app/modules/Reward/reward.validation.ts`

---

### 🟠 Phase 2: Reward System Completion

**Priority: HIGH**  
**Estimated Order: 4**

#### 2.1 RewardRedemption Module

- **Why Fifth**: Complete reward system - depends on Reward and Points
- **Dependencies**: Client (exists ✅), Reward (from 1.5), Points (from 1.3), Business (exists ✅)
- **Key Features**:
  - QR code generation
  - NFC support
  - Static code generation
  - Redemption validation
  - Status tracking (active, claimed, redeemed, expired)
- **Files to Create**:
  - `src/app/modules/RewardRedemption/rewardRedemption.model.ts`
  - `src/app/modules/RewardRedemption/rewardRedemption.interface.ts`
  - `src/app/modules/RewardRedemption/rewardRedemption.service.ts`
  - `src/app/modules/RewardRedemption/rewardRedemption.controller.ts`
  - `src/app/modules/RewardRedemption/rewardRedemption.route.ts`
  - `src/app/modules/RewardRedemption/rewardRedemption.validation.ts`

---

### 🟡 Phase 3: Round-Up System

**Priority: HIGH**  
**Estimated Order: 5-7**

#### 3.1 BankConnection Module

- **Why Sixth**: Foundation for round-up - Plaid consent integration needed first
- **Dependencies**: Client (exists ✅)
- **Key Features**:
  - Plaid Link consent management
  - Bank account connection
  - Item status & relink monitoring
  - Connection health & webhook tracking
- **Files to Create**:
  - `src/app/modules/BankConnection/bankConnection.model.ts`
  - `src/app/modules/BankConnection/bankConnection.interface.ts`
  - `src/app/modules/BankConnection/bankConnection.service.ts`
  - `src/app/modules/BankConnection/bankConnection.controller.ts`
  - `src/app/modules/BankConnection/bankConnection.route.ts`
  - `src/app/modules/BankConnection/bankConnection.validation.ts`

#### 3.2 RoundUp Module

- **Why Seventh**: Round-up settings - depends on BankConnection
- **Dependencies**: Client (exists ✅), Organization (exists ✅), BankConnection (from 3.1)
- **Key Features**:
  - Round-up configuration per user
  - Threshold settings
  - Monthly limits
  - Auto-donation triggers
  - Organization assignment
- **Files to Create**:
  - `src/app/modules/RoundUp/roundUp.model.ts`
  - `src/app/modules/RoundUp/roundUp.interface.ts`
  - `src/app/modules/RoundUp/roundUp.service.ts`
  - `src/app/modules/RoundUp/roundUp.controller.ts`
  - `src/app/modules/RoundUp/roundUp.route.ts`
  - `src/app/modules/RoundUp/roundUp.validation.ts`

#### 3.3 RoundUpTransaction Module

- **Why Eighth**: Track individual round-up transactions
- **Dependencies**: Client (exists ✅), RoundUp (from 3.2), Organization (exists ✅)
- **Key Features**:
  - Individual transaction tracking
  - Round-up calculation
  - Plaid transaction sync
  - Processed status
- **Files to Create**:
  - `src/app/modules/RoundUpTransaction/roundUpTransaction.model.ts`
  - `src/app/modules/RoundUpTransaction/roundUpTransaction.interface.ts`
  - `src/app/modules/RoundUpTransaction/roundUpTransaction.service.ts`
  - `src/app/modules/RoundUpTransaction/roundUpTransaction.controller.ts`
  - `src/app/modules/RoundUpTransaction/roundUpTransaction.route.ts`
  - `src/app/modules/RoundUpTransaction/roundUpTransaction.validation.ts`

---

### 🟢 Phase 4: Gamification System

**Priority: HIGH**  
**Estimated Order: 8-9**

#### 4.1 Badge Module

- **Why Ninth**: Badge templates - needed before user badges
- **Dependencies**: None (standalone)
- **Key Features**:
  - Badge definitions
  - Tier structures (Colour, Bronze, Silver, Gold)
  - Unlock conditions
  - Category/cause association
  - Admin management
- **Files to Create**:
  - `src/app/modules/Badge/badge.model.ts`
  - `src/app/modules/Badge/badge.interface.ts`
  - `src/app/modules/Badge/badge.service.ts`
  - `src/app/modules/Badge/badge.controller.ts`
  - `src/app/modules/Badge/badge.route.ts`
  - `src/app/modules/Badge/badge.validation.ts`

#### 4.2 UserBadge Module

- **Why Tenth**: User badge progress - depends on Badge and Donation
- **Dependencies**: Client (exists ✅), Badge (from 4.1), Donation (from 1.2)
- **Key Features**:
  - User badge progress tracking
  - Tier progression
  - Unlock date tracking
  - Progress calculation
- **Files to Create**:
  - `src/app/modules/UserBadge/userBadge.model.ts`
  - `src/app/modules/UserBadge/userBadge.interface.ts`
  - `src/app/modules/UserBadge/userBadge.service.ts`
  - `src/app/modules/UserBadge/userBadge.controller.ts`
  - `src/app/modules/UserBadge/userBadge.route.ts`
  - `src/app/modules/UserBadge/userBadge.validation.ts`

---

### 🔵 Phase 5: Additional Features

**Priority: MEDIUM**  
**Estimated Order: 10-14**

#### 5.1 ScheduledDonation Module

- **Why Eleventh**: Recurring donations - depends on Donation
- **Dependencies**: Client (exists ✅), Organization (exists ✅), Donation (from 1.2)
- **Key Features**:
  - Recurring donation scheduling
  - Frequency management (daily, weekly, monthly, yearly)
  - Next execution date
  - Active/inactive status
- **Files to Create**:
  - `src/app/modules/ScheduledDonation/scheduledDonation.model.ts`
  - `src/app/modules/ScheduledDonation/scheduledDonation.interface.ts`
  - `src/app/modules/ScheduledDonation/scheduledDonation.service.ts`
  - `src/app/modules/ScheduledDonation/scheduledDonation.controller.ts`
  - `src/app/modules/ScheduledDonation/scheduledDonation.route.ts`
  - `src/app/modules/ScheduledDonation/scheduledDonation.validation.ts`

#### 5.2 DonationReceipt Module

- **Why Twelfth**: Receipt generation - depends on Donation
- **Dependencies**: Client (exists ✅), Organization (exists ✅), Donation (from 1.2)
- **Key Features**:
  - Receipt generation
  - PDF storage
  - Receipt number management
  - Email delivery tracking
  - Tax/Zakat status
- **Files to Create**:
  - `src/app/modules/DonationReceipt/donationReceipt.model.ts`
  - `src/app/modules/DonationReceipt/donationReceipt.interface.ts`
  - `src/app/modules/DonationReceipt/donationReceipt.service.ts`
  - `src/app/modules/DonationReceipt/donationReceipt.controller.ts`
  - `src/app/modules/DonationReceipt/donationReceipt.route.ts`
  - `src/app/modules/DonationReceipt/donationReceipt.validation.ts`

#### 5.3 BusinessFollower Module

- **Why Thirteenth**: Social features - depends on Business and Client
- **Dependencies**: Client (exists ✅), Business (exists ✅)
- **Key Features**:
  - Follow/unfollow businesses
  - Notification preferences
  - Follow date tracking
- **Files to Create**:
  - `src/app/modules/BusinessFollower/businessFollower.model.ts`
  - `src/app/modules/BusinessFollower/businessFollower.interface.ts`
  - `src/app/modules/BusinessFollower/businessFollower.service.ts`
  - `src/app/modules/BusinessFollower/businessFollower.controller.ts`
  - `src/app/modules/BusinessFollower/businessFollower.route.ts`
  - `src/app/modules/BusinessFollower/businessFollower.validation.ts`

#### 5.4 OrganizationFollower Module

- **Why Fourteenth**: Social features - depends on Organization and Client
- **Dependencies**: Client (exists ✅), Organization (exists ✅)
- **Key Features**:
  - Follow/unfollow organizations
  - Notification preferences
  - Follow date tracking
- **Files to Create**:
  - `src/app/modules/OrganizationFollower/organizationFollower.model.ts`
  - `src/app/modules/OrganizationFollower/organizationFollower.interface.ts`
  - `src/app/modules/OrganizationFollower/organizationFollower.service.ts`
  - `src/app/modules/OrganizationFollower/organizationFollower.controller.ts`
  - `src/app/modules/OrganizationFollower/organizationFollower.route.ts`
  - `src/app/modules/OrganizationFollower/organizationFollower.validation.ts`

---

## Quick Reference: Implementation Checklist

### Phase 1: Foundation (CRITICAL)

- [ ] 1. Cause Module
- [ ] 2. Donation Module
- [ ] 3. Points Module
- [ ] 4. PointsTransaction Module
- [ ] 5. Reward Module

### Phase 2: Reward System

- [ ] 6. RewardRedemption Module

### Phase 3: Round-Up System

- [ ] 7. BankConnection Module
- [ ] 8. RoundUp Module
- [ ] 9. RoundUpTransaction Module

### Phase 4: Gamification

- [ ] 10. Badge Module
- [ ] 11. UserBadge Module

### Phase 5: Additional Features

- [ ] 12. ScheduledDonation Module
- [ ] 13. DonationReceipt Module
- [ ] 14. BusinessFollower Module
- [ ] 15. OrganizationFollower Module

---

## Dependency Graph Summary

```
Auth (✅) → Client (✅) → Donation (2) → PointsTransaction (4)
                                    ↓
                              Points (3) → RewardRedemption (6)
                                    ↓
                              Reward (5)

Client (✅) → BankConnection (7) → RoundUp (8) → RoundUpTransaction (9)
                                                          ↓
                                                    Donation (2)

Badge (10) → UserBadge (11) ← Donation (2)
                              ↑
                         Client (✅)

Donation (2) → ScheduledDonation (12)
            → DonationReceipt (13)

Client (✅) + Business (✅) → BusinessFollower (14)
Client (✅) + Organization (✅) → OrganizationFollower (15)
```

---

## Notes

1. **Start with Phase 1**: These modules are critical and form the foundation for everything else.

2. **Test Each Phase**: Complete and test each phase before moving to the next.

3. **Use Module Generator**: Use the existing `create-module` script to scaffold modules:

   ```bash
   npm run create-module Donation
   ```

4. **Update Routes**: After creating each module, add it to `src/app/routes/index.ts`.

5. **Integration Points**:

   - Donation → PointsTransaction (auto-create on donation)
   - Donation → UserBadge (update progress)
   - RoundUpTransaction → Donation (create donation when threshold met)
   - RewardRedemption → PointsTransaction (deduct points)

6. **External Integrations**:
   - Stripe (for payments)
   - Basiq (for bank connections)
   - Email service (for receipts)

---

_Last Updated: [Current Date]_  
_Document Version: 1.0_

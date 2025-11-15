# Round-Up Setup Implementation Summary

## Overview
Updated the RoundUp module to support the complete setup flow with bank connection, organization, cause, monthly threshold, and special message handling.

## Key Requirements Implemented

### 1. Setup Required Fields
- ✅ **Bank Connection** (bankConnectionId)
- ✅ **Organization ID** (organizationId/charityId)
- ✅ **User ID** (userId/Donor ID) - Accessed from auth middleware
- ✅ **Cause ID** (causeId) - **NEW: Required field**
- ✅ **Monthly Threshold** - Updated validation (min $3 or null for "No-limit")
- ✅ **Special Message** - Optional field (max 250 chars, stored with donation)

### 2. Monthly Threshold Logic

#### Scenario 1: Threshold Reached Within Month
- When accumulated roundup amount reaches/exceeds threshold → Immediate donation trigger
- Creates donation record with `donation_type: "round_up"`
- Round-up is **automatically paused** after donation

#### Scenario 2: Threshold Not Reached by Month-End
- If threshold not met → Donation triggered at month-end
- Creates donation record same as Scenario 1
- Round-up is **automatically paused** after donation

#### Scenario 3: No-Limit Option
- When user selects "No-limit" → `monthlyThreshold` is `null/undefined`
- Donation triggered at end of every month
- Round-up is **automatically paused** after donation

#### Post-Donation Behavior
- After any donation trigger, round-up feature is **paused** (`enabled: false`)
- User must **manually resume** to continue round-ups

### 3. Validation Rules

#### Monthly Threshold
- **Minimum**: $3 (if provided)
- **Maximum**: $1000
- **No-limit**: `null` or `undefined`
- Backend enforces only min/max, frontend handles predefined options ($10, $20, $30, custom)

#### Special Message
- **Maximum characters**: 250
- **Storage**: Stored with each donation, not in RoundUp configuration
- **Optional field**

#### Cause Validation
- Must exist in database
- Must belong to the specified organization
- Validated on setup

## Files Modified

### 1. Model & Interface Updates

#### `src/app/modules/RoundUp/roundUp.interface.ts`
- ✅ Added `cause: string` (required)
- ✅ Updated `monthlyThreshold` comment to reflect min $3 or null/undefined

#### `src/app/modules/RoundUp/roundUp.model.ts`
- ✅ Added `cause` field (required, ref to 'Cause')
- ✅ Updated `monthlyThreshold` min validation to 3
- ✅ Set `monthlyThreshold` default to `undefined` for "No-limit"

### 2. Validation Schema Updates

#### `src/app/modules/RoundUp/roundUp.validation.ts`
- ✅ Updated `savePlaidConsentValidation`:
  - Changed `charityId` to `organizationId`
  - Added `causeId` (required)
  - Updated `monthlyThreshold` validation (min 3, nullable)
- ✅ Updated `processMonthlyDonationValidation`:
  - Added `specialMessage` (optional, max 250 chars)
- ✅ Added `resumeRoundUpValidation` for resume endpoint

### 3. Controller Updates

#### `src/app/modules/RoundUp/secureRoundUp.controller.ts`

**savePlaidConsent (Setup endpoint)**:
- ✅ Changed parameter from `charityId` to `organizationId`
- ✅ Added `causeId` parameter
- ✅ Added validation: cause exists and belongs to organization
- ✅ Added validation: monthlyThreshold min $3 if provided
- ✅ Fixed field mapping in RoundUpModel creation

**processMonthlyDonation**:
- ✅ Added `specialMessage` parameter
- ✅ Added check: roundUp must be enabled (not paused)
- ✅ Pass `causeId` to stripe service
- ✅ Pass `specialMessage` to stripe service
- ✅ **Pause round-up after successful donation** (`enabled: false`)
- ✅ Updated response to indicate round-up is paused

**resumeRoundUp (NEW endpoint)**:
- ✅ Validates round-up exists and belongs to user
- ✅ Checks if already enabled
- ✅ Sets `enabled: true` to resume round-up
- ✅ Returns updated configuration

### 4. Service Updates

#### `src/app/modules/RoundUpTransaction/roundUpTransaction.service.ts`

**triggerDonation (Auto-trigger when threshold met)**:
- ✅ Pass `causeId` to stripe service
- ✅ **Pause round-up after donation** (`enabled: false`)
- ✅ Reset monthly total after donation

### 5. Stripe Service Updates

#### `src/app/modules/Stripe/stripe.service.ts`

**processRoundUpDonation**:
- ✅ Added `causeId?: string` to payload interface
- ✅ Added `specialMessage?: string` to payload interface
- ✅ Store `causeId` in donation record (instead of undefined)
- ✅ Store `specialMessage` in donation record (or default message)

### 6. Route Updates

#### `src/app/modules/RoundUp/secureRoundUp.route.ts`
- ✅ Added resume endpoint: `POST /resume` with validation
- ✅ Imported `resumeRoundUpValidation`

## API Endpoints

### Setup RoundUp
```
POST /api/roundup/consent/save
Body: {
  bankConnectionId: string (required)
  organizationId: string (required)
  causeId: string (required)
  monthlyThreshold: number | null (min: 3, optional)
}
```

### Process Monthly Donation
```
POST /api/roundup/process-monthly-donation
Body: {
  roundUpId: string (required)
  specialMessage: string (optional, max 250 chars)
}
```

### Resume Round-Up
```
POST /api/roundup/resume
Body: {
  roundUpId: string (required)
}
```

## Testing Checklist

- [ ] Test setup with valid causeId belonging to organization
- [ ] Test setup with causeId not belonging to organization (should fail)
- [ ] Test setup with monthlyThreshold = $3 (min valid)
- [ ] Test setup with monthlyThreshold = $2 (should fail)
- [ ] Test setup with monthlyThreshold = null (No-limit)
- [ ] Test donation trigger when threshold reached mid-month
- [ ] Test donation trigger at month-end when threshold not reached
- [ ] Test donation trigger at month-end with No-limit option
- [ ] Verify round-up is paused after donation in all scenarios
- [ ] Test resume endpoint after pause
- [ ] Test processMonthlyDonation with specialMessage
- [ ] Test processMonthlyDonation without specialMessage (uses default)
- [ ] Verify specialMessage max 250 chars validation

## Migration Notes

- **No existing data**: No migration needed (confirmed no existing RoundUp records)
- New `cause` field is required for all future RoundUp configurations
- Existing donation model already has `specialMessage` field

## Breaking Changes

### API Contract Changes
1. **Setup endpoint** now requires `causeId` parameter
2. **Setup endpoint** parameter renamed: `charityId` → `organizationId`
3. Round-up automatically pauses after donation (requires manual resume)

## Database Schema Changes

### RoundUp Collection
- **Added**: `cause` field (ObjectId, required, ref: 'Cause')
- **Updated**: `monthlyThreshold` min validation changed from 1 to 3

### Donation Collection
- **No changes** (specialMessage field already exists)

## Notes
- Frontend must implement predefined threshold options: $10, $20, $30, custom, No-limit
- Backend only validates min $3 and max $1000
- Special message stored with donation, not with RoundUp config
- User must manually resume round-up after each donation cycle

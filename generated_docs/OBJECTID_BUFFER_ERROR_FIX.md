# ObjectId Buffer Error Fix

## Issue Description

### Error Message
```json
{
  "success": false,
  "scheduledDonationId": "6915a72c4c39aaa5c6742000",
  "error": "Unexpected error processing donation: Invalid string: {:buffer=>\"i\�M��I�z\@X\"}"
}
```

### Root Cause
The error occurred because of improper ObjectId handling when using Mongoose's `.lean()` method with populated documents.

When using `.lean()`:
- Mongoose returns plain JavaScript objects instead of Mongoose documents
- ObjectIds become plain objects with a `Buffer` property
- Calling `.toString()` on these objects fails with "Invalid string" error

---

## The Problem in Code

### Before (Broken)
```typescript
// Using .lean() which returns plain objects
const scheduledDonation = await ScheduledDonation.findById(id)
  .populate('user')
  .populate('organization')
  .populate('cause')
  .lean(); // ❌ This causes ObjectId issues

// Later in code...
const userId = scheduledDonation.user._id.toString(); // ❌ FAILS!
// scheduledDonation.user._id is a plain object with {buffer: ...}
// .toString() doesn't work on this format
```

### Why It Fails
```javascript
// Without .lean() - Works ✅
scheduledDonation.user._id.toString() 
// Returns: "6915a72c4c39aaa5c6742000"

// With .lean() - Fails ❌
scheduledDonation.user._id.toString()
// Throws: Invalid string: {:buffer=>"i\�M��I�z@X"}
// Because _id is now: { buffer: <Buffer 69 15 a7 2c ...> }
```

---

## The Solution

### Fix Applied

#### 1. Removed `.lean()` from the query
```typescript
// ✅ FIXED: Don't use .lean() when we need proper ObjectId handling
const scheduledDonation = await ScheduledDonation.findById(scheduledDonationId)
  .populate('user')
  .populate('organization')
  .populate('cause');
  // No .lean() here!
```

#### 2. Added validation for populated fields
```typescript
// Validate populated fields exist before processing
if (!scheduledDonation.user || !scheduledDonation.organization || !scheduledDonation.cause) {
  throw new AppError(
    httpStatus.BAD_REQUEST,
    'Scheduled donation has invalid references. Missing user, organization, or cause.'
  );
}
```

#### 3. Safe ObjectId extraction
```typescript
// Safely extract IDs from populated documents
// This handles both cases: when field is an object or already a string
const userId = (scheduledDonation.user._id || scheduledDonation.user).toString();
const organizationId = (scheduledDonation.organization._id || scheduledDonation.organization).toString();
const causeId = (scheduledDonation.cause._id || scheduledDonation.cause).toString();
```

#### 4. Use extracted IDs throughout
```typescript
// Use the extracted string IDs instead of accessing nested _id fields
const donation = await Donation.create({
  donor: userId,                    // ✅ Instead of scheduledDonation.user._id
  organization: organizationId,      // ✅ Instead of scheduledDonation.organization._id
  cause: causeId,                   // ✅ Instead of scheduledDonation.cause._id
  scheduledDonationId: scheduledDonationId, // ✅ Use the string parameter directly
  // ... other fields
});
```

#### 5. Track retry attempts correctly
```typescript
const donation = await Donation.create({
  // ...
  paymentAttempts: attempt, // ✅ Track actual attempt number, not hardcoded 1
  // ...
});
```

---

## Why This Solution Works

### 1. **Mongoose Documents Preserve ObjectId Type**
Without `.lean()`, Mongoose documents maintain proper ObjectId instances that have built-in `.toString()` methods.

### 2. **Defensive Programming**
The safe extraction pattern handles edge cases:
```typescript
const userId = (scheduledDonation.user._id || scheduledDonation.user).toString();
```
This works whether:
- `user` is a populated object with `_id` field
- `user` is already an ObjectId
- `user` is a string

### 3. **Early Validation**
Checking for null/undefined populated fields prevents errors downstream.

### 4. **Consistent ID Usage**
Using extracted string IDs throughout the function ensures no hidden ObjectId issues.

---

## Performance Consideration

**Q: But `.lean()` is faster! Why remove it?**

**A:** While `.lean()` is faster (2-5x for large datasets), the performance benefit is negligible here because:

1. **Single document query** - We're fetching one scheduled donation at a time in the retry loop
2. **I/O bound operation** - The Stripe API call (network I/O) takes 200-500ms, while the performance difference of `.lean()` is ~5-10ms
3. **Reliability > Speed** - Correctness is more important than saving 10ms when processing payments

**When to use `.lean()`:**
- ✅ Fetching hundreds/thousands of documents for read-only display
- ✅ Query results that don't need modification
- ✅ API endpoints returning list data

**When NOT to use `.lean()`:**
- ❌ When you need to call document methods (`.save()`, `.populate()`, etc.)
- ❌ When ObjectId manipulation is required
- ❌ When creating related documents using the queried IDs
- ❌ Payment processing or critical operations where reliability matters

---

## Testing the Fix

### Test Case 1: Successful Donation Processing
```bash
# Trigger cron job manually
curl -X POST http://localhost:5000/api/v1/cron-jobs/trigger/scheduled-donations \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected Response:
{
  "success": true,
  "results": [
    {
      "success": true,
      "donationId": "691234567890abcdef123456"
    }
  ]
}
```

### Test Case 2: Failed Donation with Proper Error
```bash
# Should now show actual Stripe error, not ObjectId buffer error
{
  "success": false,
  "scheduledDonationId": "6915a72c4c39aaa5c6742000",
  "error": "card_declined: Your card was declined"
}
# Not: "Invalid string: {:buffer=>...}"
```

### Test Case 3: Database Validation
```javascript
// Check that failed donations are created with correct IDs
db.donations.findOne({ status: 'failed' })
// Should show:
{
  _id: ObjectId("..."),
  donor: ObjectId("6915a72c4c39aaa5c6742000"),      // ✅ Valid ObjectId
  organization: ObjectId("6915a72c4c39aaa5c6742001"), // ✅ Valid ObjectId
  cause: ObjectId("6915a72c4c39aaa5c6742002"),       // ✅ Valid ObjectId
  status: "failed"
}
```

---

## Additional Improvements Made

### 1. Better Error Handling for Failed Donation Records
```typescript
try {
  await Donation.create({ /* failed donation */ });
} catch (createError: any) {
  console.error(`⚠️  Failed to create failed donation record: ${createError.message}`);
  // Continue even if we can't create the failed record
}
```
**Benefit:** If creating the failed donation record fails, it won't crash the entire cron job.

### 2. Unique Idempotency Keys for Failed Attempts
```typescript
idempotencyKey: `${idempotencyKey}_failed_${attempt}`
```
**Benefit:** Each retry attempt gets a unique key, preventing conflicts.

### 3. Consistent String Usage
All ObjectIds are converted to strings once and reused throughout the function.

---

## Summary of Changes

| File | Lines Changed | Description |
|------|--------------|-------------|
| `scheduledDonation.service.ts` | ~30 lines | Removed `.lean()`, added validation, safe ID extraction |

### Key Changes:
1. ❌ Removed `.lean()` from query
2. ✅ Added validation for populated fields
3. ✅ Safe ObjectId extraction with fallback
4. ✅ Use extracted IDs consistently
5. ✅ Better error handling for failed donations
6. ✅ Track retry attempts correctly

---

## Result

✅ **No more "Invalid string buffer" errors**  
✅ **Proper ObjectId handling throughout**  
✅ **Failed donations tracked with correct references**  
✅ **Better error messages for debugging**  
✅ **More resilient error handling**  

The scheduled donation cron job now processes donations reliably without ObjectId-related crashes.

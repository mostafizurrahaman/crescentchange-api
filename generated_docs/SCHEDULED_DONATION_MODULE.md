# ScheduledDonation Module Implementation

**Status:** ✅ Complete  
**Date:** November 13, 2025  
**Module:** Recurring Donations (ScheduledDonation)

---

## Overview

The ScheduledDonation module enables users to set up recurring donations that automatically execute at specified intervals. This supports various frequencies including daily, weekly, monthly, quarterly, yearly, and custom intervals.

---

## Module Structure

```
src/app/modules/ScheduledDonation/
├── scheduledDonation.model.ts       ✅ Complete
├── scheduledDonation.interface.ts   ✅ Complete (in donation.interface.ts)
├── scheduledDonation.service.ts     ✅ Complete
├── scheduledDonation.controller.ts  ✅ Complete
├── scheduledDonation.route.ts       ✅ Complete
└── scheduledDonation.validation.ts  ✅ Complete
```

---

## Features Implemented

### 1. Core Functionality

- ✅ Create recurring donation schedules
- ✅ View user's scheduled donations with filters
- ✅ Get specific scheduled donation details
- ✅ Update scheduled donation settings
- ✅ Pause scheduled donations
- ✅ Resume scheduled donations
- ✅ Cancel (delete) scheduled donations

### 2. Frequency Options

- ✅ Daily
- ✅ Weekly
- ✅ Monthly
- ✅ Quarterly
- ✅ Yearly
- ✅ Custom (with configurable intervals)

### 3. Custom Interval Support

Users can specify custom intervals with:
- **Value:** Number (e.g., 2, 3, 10)
- **Unit:** Days, Weeks, or Months

**Examples:**
- Every 10 days
- Every 2 weeks
- Every 3 months
- Bi-monthly (every 2 months)

### 4. Validation Rules (Client Requirements)

- ✅ **Amount:** Decimal support, minimum $0.01
- ✅ **Cause:** Required (ObjectId reference to Cause model)
- ✅ **Custom Interval:** Required when frequency is "custom"
- ✅ **Payment Method:** Required and validated
- ✅ **Start Date:** Auto-set to current date (not user-editable)
- ✅ **End Date:** Not supported (runs indefinitely until manually stopped)

---

## Database Schema

### ScheduledDonation Model

```typescript
{
  user: ObjectId,                    // Required - Reference to Client
  organization: ObjectId,            // Required - Reference to Organization
  cause: ObjectId,                   // Required - Reference to Cause
  amount: Number,                    // Required - Min $0.01
  currency: String,                  // Default: 'USD'
  frequency: String,                 // Required - Enum: daily|weekly|monthly|quarterly|yearly|custom
  customInterval: {                  // Optional - Required when frequency='custom'
    value: Number,                   // Min: 1
    unit: String                     // Enum: days|weeks|months
  },
  startDate: Date,                   // Required - Auto-set to current date
  nextDonationDate: Date,            // Required - Calculated based on frequency
  endDate: Date,                     // Optional - Not used (for future enhancement)
  isActive: Boolean,                 // Default: true
  lastExecutedDate: Date,            // Optional - Last execution timestamp
  totalExecutions: Number,           // Default: 0
  specialMessage: String,            // Optional - Max 500 characters
  stripeCustomerId: String,          // Optional - From payment method
  paymentMethodId: String,           // Required - Payment method to charge
  createdAt: Date,                   // Auto-generated
  updatedAt: Date                    // Auto-generated
}
```

### Indexes

```typescript
{ user: 1, isActive: 1 }                // User's active donations
{ organization: 1, isActive: 1 }        // Organization's active donations
{ nextDonationDate: 1, isActive: 1 }    // Cron job efficiency
{ cause: 1 }                            // Cause-based queries
{ stripeCustomerId: 1 }                 // Payment processing
```

---

## API Endpoints

### Base URL: `/api/v1/scheduled-donation`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/create` | CLIENT | Create new scheduled donation |
| GET | `/user` | CLIENT | Get user's scheduled donations (with filters) |
| GET | `/:id` | CLIENT | Get specific scheduled donation by ID |
| PATCH | `/:id` | CLIENT | Update scheduled donation |
| POST | `/:id/pause` | CLIENT | Pause scheduled donation |
| POST | `/:id/resume` | CLIENT | Resume scheduled donation |
| DELETE | `/:id` | CLIENT | Cancel (delete) scheduled donation |

---

## API Examples

### 1. Create Scheduled Donation

**Request:**
```http
POST /api/v1/scheduled-donation/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "organizationId": "507f1f77bcf86cd799439011",
  "causeId": "507f1f77bcf86cd799439012",
  "amount": 50.00,
  "frequency": "monthly",
  "specialMessage": "Happy to support this cause!",
  "paymentMethodId": "pm_1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Recurring donation scheduled successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "user": "507f1f77bcf86cd799439010",
    "organization": "507f1f77bcf86cd799439011",
    "cause": "507f1f77bcf86cd799439012",
    "amount": 50.00,
    "currency": "USD",
    "frequency": "monthly",
    "startDate": "2025-11-13T10:00:00.000Z",
    "nextDonationDate": "2025-12-13T10:00:00.000Z",
    "isActive": true,
    "totalExecutions": 0,
    "specialMessage": "Happy to support this cause!",
    "paymentMethodId": "pm_1234567890",
    "createdAt": "2025-11-13T10:00:00.000Z",
    "updatedAt": "2025-11-13T10:00:00.000Z"
  }
}
```

### 2. Create with Custom Interval

**Request:**
```http
POST /api/v1/scheduled-donation/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "organizationId": "507f1f77bcf86cd799439011",
  "causeId": "507f1f77bcf86cd799439012",
  "amount": 25.50,
  "frequency": "custom",
  "customInterval": {
    "value": 10,
    "unit": "days"
  },
  "paymentMethodId": "pm_1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Recurring donation scheduled successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "frequency": "custom",
    "customInterval": {
      "value": 10,
      "unit": "days"
    },
    "nextDonationDate": "2025-11-23T10:00:00.000Z"
  }
}
```

### 3. Get User's Scheduled Donations (with QueryBuilder support)

**Request:**
```http
GET /api/v1/scheduled-donation/user?page=1&limit=10&isActive=true&frequency=monthly&searchTerm=monthly&sort=-amount&fields=amount,frequency,nextDonationDate
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `isActive` - Filter by status: `true`, `false`, or `all` (default: all)
- `frequency` - Filter by frequency: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, `custom`, or `all` (default: all)
- `searchTerm` - Search in special message field
- `sort` - Sort field (prefix with `-` for descending, e.g., `-amount`, `nextDonationDate`)
- `fields` - Select specific fields (comma-separated, e.g., `amount,frequency,isActive`)

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Scheduled donations retrieved successfully",
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPage": 1
  }
}
```

**Example Queries:**
```http
# Get active donations only
GET /api/v1/scheduled-donation/user?isActive=true

# Search in special messages
GET /api/v1/scheduled-donation/user?searchTerm=education

# Sort by amount descending
GET /api/v1/scheduled-donation/user?sort=-amount

# Get only specific fields
GET /api/v1/scheduled-donation/user?fields=amount,frequency,nextDonationDate

# Combine filters
GET /api/v1/scheduled-donation/user?isActive=true&frequency=monthly&sort=-amount&page=2&limit=20
```

### 4. Update Scheduled Donation

**Request:**
```http
PATCH /api/v1/scheduled-donation/507f1f77bcf86cd799439013
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 75.00,
  "frequency": "weekly"
}
```

### 5. Pause Scheduled Donation

**Request:**
```http
POST /api/v1/scheduled-donation/507f1f77bcf86cd799439013/pause
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Scheduled donation paused successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "isActive": false
  }
}
```

### 6. Resume Scheduled Donation

**Request:**
```http
POST /api/v1/scheduled-donation/507f1f77bcf86cd799439013/resume
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Scheduled donation resumed successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "isActive": true,
    "nextDonationDate": "2025-11-20T10:00:00.000Z"
  }
}
```

### 7. Cancel Scheduled Donation

**Request:**
```http
DELETE /api/v1/scheduled-donation/507f1f77bcf86cd799439013
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Scheduled donation cancelled successfully",
  "data": null
}
```

---

## Service Methods

### Public Methods (used by controllers)

1. **createScheduledDonation** - Create new scheduled donation
2. **getUserScheduledDonations** - Get user's donations with QueryBuilder support
   - Search: Text search in `specialMessage` field
   - Filter: By `isActive`, `frequency`, and other query params
   - Sort: By any field (default: `-createdAt`)
   - Paginate: Page and limit support
   - Fields: Select specific fields to return
3. **getScheduledDonationById** - Get specific donation by ID
4. **updateScheduledDonation** - Update donation settings
5. **pauseScheduledDonation** - Pause donation
6. **resumeScheduledDonation** - Resume donation with recalculated next date
7. **cancelScheduledDonation** - Delete donation

### Internal Methods (for cron jobs)

8. **getScheduledDonationsDueForExecution** - Get donations ready to execute
9. **updateScheduledDonationAfterExecution** - Update after successful execution

---

## Business Logic

### Next Donation Date Calculation

The system calculates the next donation date based on frequency:

```typescript
// Daily: +1 day
// Weekly: +7 days
// Monthly: +1 month
// Quarterly: +3 months
// Yearly: +1 year
// Custom: +{value} {unit}
```

When resuming a paused donation, the next date is recalculated from the current date.

### Automatic Execution Flow

1. **Cron Job** runs periodically (e.g., every hour)
2. Queries for donations where:
   - `isActive = true`
   - `nextDonationDate <= now`
3. For each donation:
   - Create new Donation record with `donationType='recurring'`
   - Process payment via Stripe
   - Update `lastExecutedDate`, `totalExecutions`
   - Calculate and update `nextDonationDate`
4. If `endDate` exists and passed, set `isActive = false`

---

## Validation Rules

### Create Scheduled Donation

- ✅ organizationId: Required, valid ObjectId
- ✅ causeId: Required, valid ObjectId
- ✅ amount: Required, min $0.01, decimal support
- ✅ frequency: Required, enum value
- ✅ customInterval: Required if frequency='custom'
- ✅ specialMessage: Optional, max 500 characters
- ✅ paymentMethodId: Required, valid and active

### Update Scheduled Donation

- ✅ amount: Optional, min $0.01
- ✅ frequency: Optional, enum value
- ✅ customInterval: Required if frequency='custom'
- ✅ specialMessage: Optional, max 500 characters
- ✅ isActive: Optional, boolean

### Custom Interval

- ✅ value: Integer, min 1
- ✅ unit: Enum (days, weeks, months)
- ✅ Only allowed when frequency='custom'

---

## Error Handling

### Common Errors

| Status | Message | Cause |
|--------|---------|-------|
| 401 | User not authenticated | Missing/invalid token |
| 404 | User not found | Invalid user ID |
| 404 | Organization not found | Invalid organization ID |
| 404 | Cause not found | Invalid cause ID |
| 404 | Scheduled donation not found | Invalid ID or not owned by user |
| 400 | Payment method is not active | Inactive payment method |
| 400 | Custom interval is required | frequency='custom' but no interval |
| 400 | Amount must be at least $0.01 | Invalid amount |

---

## Security

- ✅ **Authentication Required:** All endpoints require valid JWT token
- ✅ **User Isolation:** Users can only access/modify their own scheduled donations
- ✅ **Payment Method Validation:** Verifies payment method belongs to user
- ✅ **Organization Validation:** Ensures organization exists
- ✅ **Cause Validation:** Ensures cause exists

---

## Integration Points

### Required Modules

1. **Client Module** - User validation
2. **Organization Module** - Organization validation
3. **Cause Module** - Cause validation and reference
4. **PaymentMethod Module** - Payment method validation
5. **Donation Module** - Creates actual donations during execution
6. **Stripe Service** - Payment processing

### Future Integration (Cron Job)

A background job needs to be implemented to:
1. Query `getScheduledDonationsDueForExecution()`
2. Process each donation via Stripe
3. Create Donation records
4. Update execution tracking via `updateScheduledDonationAfterExecution()`

---

## Testing Checklist

- [ ] Create scheduled donation with all frequencies
- [ ] Create with custom interval
- [ ] Get user's scheduled donations with filters
- [ ] Update donation (amount, frequency)
- [ ] Pause and resume donation
- [ ] Cancel donation
- [ ] Validate custom interval requirements
- [ ] Validate payment method ownership
- [ ] Test next date calculation for all frequencies
- [ ] Test authorization (user can only access own donations)

---

## Next Steps

1. **Cron Job Implementation:** Create background job to execute scheduled donations
2. **Notification Integration:** Notify users before/after each donation
3. **Receipt Generation:** Generate receipts for recurring donations
4. **Analytics:** Track recurring donation metrics
5. **End Date Support:** If needed in the future (currently runs indefinitely)

---

## Related Documentation

- [Donation Validation Rules](./DONATION_VALIDATION_RULES.md)
- [Donation Implementation Complete](./DONATION_IMPLEMENTATION_COMPLETE.md)
- [Payment Flow Guide](./PAYMENT_FLOW_GUIDE.md)

---

**Module Status:** ✅ Ready for Testing  
**Deployment Status:** Pending  
**Last Updated:** November 13, 2025

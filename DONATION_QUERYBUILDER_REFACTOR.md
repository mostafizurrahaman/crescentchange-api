# Donation Module Refactor - QueryBuilder Implementation

## Summary
Refactored the donation module's GET endpoints to use the QueryBuilder pattern for better query flexibility, consistency, and performance. Also removed redundant payment processing endpoint.

## Changes Made

### 1. **Service Layer Refactoring**

#### `getDonationsByUser` - Now uses QueryBuilder
**Before:**
```typescript
const getDonationsByUser = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  filter: Record<string, unknown> = {}
)
```

**After:**
```typescript
const getDonationsByUser = async (
  userId: string,
  query: Record<string, unknown>
)
```

**Benefits:**
- Supports flexible search with `searchTerm` parameter
- Custom sorting with `sort` parameter
- Field selection with `fields` parameter
- Automatic pagination handling
- Filter support maintained

**Search Fields:** `specialMessage`, `status`, `donationType`

---

#### `getDonationsByOrganization` - Now uses QueryBuilder
**Before:**
```typescript
const getDonationsByOrganization = async (
  organizationId: string,
  page: number = 1,
  limit: number = 10,
  filter: Record<string, unknown> = {}
)
```

**After:**
```typescript
const getDonationsByOrganization = async (
  organizationId: string,
  query: Record<string, unknown>
)
```

**Benefits:**
- Same QueryBuilder features as user donations
- Organization validation added
- Simplified controller logic

**Search Fields:** `specialMessage`, `status`, `donationType`

---

### 2. **Controller Layer Updates**

#### `getUserDonations`
- Removed manual filter preparation
- Now passes full query object to service
- Service handles all query processing

#### `getOrganizationDonations`
- Simplified parameter handling
- Removed complex filter logic
- Cleaner code structure

---

### 3. **Validation Schema Updates**

Both `getUserDonationsSchema` and `getOrganizationDonationsSchema` now support:

```typescript
query: {
  // Pagination (existing)
  page?: number;
  limit?: number;
  
  // QueryBuilder features (NEW)
  searchTerm?: string;    // Search across multiple fields
  sort?: string;          // e.g., "-createdAt" or "amount"
  fields?: string;        // e.g., "amount,status,donationType"
  
  // Filters (improved)
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  donationType?: 'one-time' | 'recurring' | 'round-up';
}
```

**Key Changes:**
- Removed `'all'` enum value from filters (use absence instead)
- Changed `type` to `donationType` for consistency
- All QueryBuilder params are optional
- Better TypeScript type safety

---

### 4. **Removed Redundant Endpoint**

**Endpoint Removed:** `POST /:donationId/payment`

**Reason:** 
- Your current flow creates donation AND processes payment in a single step via `createOneTimeDonation`
- Uses Payment Intent (direct charge) with saved payment methods
- No use case for creating a donation record first and processing payment later
- This endpoint was for Checkout Session flow which isn't your primary pattern

---

### 5. **Updated Retry Payment Logic**

**Endpoint:** `POST /:donationId/retry`

**Status:** ✅ **KEPT** - Important for failure recovery

**Updated to work with Payment Intent flow:**
- Validates donation exists and status is 'failed'
- Checks retry attempts (max 3)
- Creates new Payment Intent with existing payment method
- Returns client secret for frontend confirmation

**Use Cases:**
- Card declined → user adds funds → retry
- Network timeout during payment
- Temporary payment processor issues

---

## API Examples

### Get User Donations with QueryBuilder

**Basic Query:**
```bash
GET /donations/user?page=1&limit=10
```

**With Search:**
```bash
GET /donations/user?searchTerm=education&page=1&limit=10
```

**With Filters:**
```bash
GET /donations/user?status=completed&donationType=one-time
```

**With Sorting:**
```bash
GET /donations/user?sort=-amount&limit=20
# Sorts by amount descending
```

**With Field Selection:**
```bash
GET /donations/user?fields=amount,status,donationType
# Returns only specified fields
```

**Combined:**
```bash
GET /donations/user?searchTerm=charity&status=completed&sort=-createdAt&fields=amount,status&page=1&limit=20
```

---

### Get Organization Donations with QueryBuilder

**All features same as user donations:**
```bash
GET /donations/organization/:organizationId?searchTerm=large&status=completed&sort=-amount
```

---

## Response Format Change

**Before:**
```json
{
  "donations": [...],
  "total": 100,
  "page": 1,
  "totalPages": 10
}
```

**After:**
```json
{
  "donations": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPage": 10
  }
}
```

---

## Benefits

### 1. **Performance**
- QueryBuilder optimizes MongoDB queries
- Field selection reduces data transfer
- Indexed search fields improve query speed

### 2. **Flexibility**
- Dynamic sorting without code changes
- Powerful search capabilities
- Easy filter combinations

### 3. **Consistency**
- Same pattern used across the application (Causes, Notifications)
- Predictable API behavior
- Standard query parameters

### 4. **Maintainability**
- Less boilerplate code
- Centralized query logic in QueryBuilder
- Easier to add new features

### 5. **Developer Experience**
- TypeScript type safety maintained
- Clear validation errors
- Self-documenting API parameters

---

## Migration Guide

### Frontend Changes Needed

**1. Update Query Parameters:**
```typescript
// OLD
const query = {
  status: status || 'all',  // ❌ Remove 'all'
  donationType: type || 'all'  // ❌ Remove 'all'
}

// NEW
const query = {
  ...(status && { status }),  // ✅ Only include if set
  ...(donationType && { donationType })  // ✅ Only include if set
}
```

**2. Update Response Handling:**
```typescript
// OLD
const { donations, total, page, totalPages } = response.data;

// NEW
const { donations, meta } = response.data;
const { total, page, totalPage, limit } = meta;
```

**3. Add New Features (Optional):**
```typescript
// Search
const query = {
  searchTerm: 'education',
  ...otherFilters
}

// Sort
const query = {
  sort: '-createdAt', // Descending
  // or
  sort: 'amount',     // Ascending
  ...otherFilters
}

// Field Selection (for performance)
const query = {
  fields: 'amount,status,createdAt',
  ...otherFilters
}
```

---

## Testing Checklist

- [ ] Test user donations with various query combinations
- [ ] Test organization donations with filters
- [ ] Test search functionality
- [ ] Test sorting (ascending and descending)
- [ ] Test field selection
- [ ] Test pagination
- [ ] Test retry payment functionality
- [ ] Verify validation errors for invalid queries
- [ ] Test authorization (users can only see their donations)
- [ ] Load test with large datasets

---

## Endpoint Summary

### Current Donation Endpoints

1. ✅ **POST /one-time/create** - Create donation with payment
2. ✅ **POST /:donationId/retry** - Retry failed payment
3. ✅ **GET /:id/status** - Get donation status with payment info
4. ✅ **GET /user** - Get user donations (QueryBuilder)
5. ✅ **GET /:id** - Get specific donation by ID
6. ✅ **GET /organization/:organizationId** - Get org donations (QueryBuilder)

### Removed Endpoints
- ❌ **POST /:donationId/payment** - Redundant with current flow

---

## Notes

- QueryBuilder class is located at `src/app/builders/QueryBuilder.ts`
- Donation model has proper indexes for search fields
- All changes are backward compatible except response format
- Consider adding more searchable fields in the future (e.g., donor name, organization name)

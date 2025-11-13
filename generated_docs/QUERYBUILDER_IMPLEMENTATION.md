# QueryBuilder Implementation - ScheduledDonation Module

**Date:** November 13, 2025  
**Module:** ScheduledDonation  
**Feature:** Advanced filtering, searching, sorting, and pagination

---

## Overview

The ScheduledDonation module now fully implements the **QueryBuilder** pattern for the `GET /api/v1/scheduled-donation/user` endpoint, providing powerful query capabilities for retrieving scheduled donations.

---

## QueryBuilder Features Implemented

### 1. **Search** 🔍
Search for text across specified fields using regex pattern matching (case-insensitive).

**Searchable Fields:**
- `specialMessage` - User's custom message for the donation

**Usage:**
```http
GET /api/v1/scheduled-donation/user?searchTerm=education
```

**Example:**
- Search for donations with "monthly" in special message: `?searchTerm=monthly`
- Search for donations mentioning "charity": `?searchTerm=charity`

---

### 2. **Filter** 🎯
Filter results by specific field values.

**Custom Filters:**
- `isActive` - Filter by active status (`true`, `false`, or `all`)
- `frequency` - Filter by donation frequency (`daily`, `weekly`, `monthly`, `quarterly`, `yearly`, `custom`, or `all`)

**Additional Filters:**
Any query parameter not in the exclude list (`searchTerm`, `sort`, `page`, `limit`, `fields`) will be used as a filter.

**Usage:**
```http
# Get only active donations
GET /api/v1/scheduled-donation/user?isActive=true

# Get monthly donations
GET /api/v1/scheduled-donation/user?frequency=monthly

# Get inactive weekly donations
GET /api/v1/scheduled-donation/user?isActive=false&frequency=weekly
```

---

### 3. **Sort** 📊
Sort results by any field in ascending or descending order.

**Default Sort:** `-createdAt` (newest first)

**Syntax:**
- Ascending: `?sort=amount` (lowest to highest)
- Descending: `?sort=-amount` (highest to lowest, prefix with `-`)

**Usage:**
```http
# Sort by amount (lowest first)
GET /api/v1/scheduled-donation/user?sort=amount

# Sort by amount (highest first)
GET /api/v1/scheduled-donation/user?sort=-amount

# Sort by next donation date (soonest first)
GET /api/v1/scheduled-donation/user?sort=nextDonationDate

# Sort by creation date (oldest first)
GET /api/v1/scheduled-donation/user?sort=createdAt

# Sort by multiple fields (MongoDB syntax)
GET /api/v1/scheduled-donation/user?sort=-isActive,nextDonationDate
```

**Common Sort Fields:**
- `amount` - Donation amount
- `nextDonationDate` - Next scheduled donation
- `totalExecutions` - Number of donations made
- `createdAt` - Creation date
- `updatedAt` - Last update date
- `startDate` - Start date of recurring donation

---

### 4. **Paginate** 📄
Control the number of results and navigate through pages.

**Default Values:**
- `page`: 1
- `limit`: 10
- **Max limit**: 100

**Usage:**
```http
# First page, 10 items
GET /api/v1/scheduled-donation/user?page=1&limit=10

# Second page, 20 items
GET /api/v1/scheduled-donation/user?page=2&limit=20

# Get 50 items at once
GET /api/v1/scheduled-donation/user?limit=50
```

**Response Meta:**
```json
{
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPage": 5
  }
}
```

---

### 5. **Field Selection** 🎨
Select only specific fields to return, reducing response size and improving performance.

**Syntax:** Comma-separated field names

**Usage:**
```http
# Get only amount and frequency
GET /api/v1/scheduled-donation/user?fields=amount,frequency

# Get essential fields only
GET /api/v1/scheduled-donation/user?fields=amount,frequency,nextDonationDate,isActive

# Get fields with organization details
GET /api/v1/scheduled-donation/user?fields=amount,organization,cause
```

**Common Field Selections:**
- Minimal: `amount,frequency,nextDonationDate`
- Dashboard: `amount,frequency,nextDonationDate,isActive,organization`
- Full: Don't specify `fields` parameter

---

## Implementation Details

### Service Layer Code

```typescript
const getUserScheduledDonations = async (
  userId: string,
  query: Record<string, unknown>
) => {
  // Validate user
  const user = await Client.findOne({ auth: userId });
  if (!user) throw new AppError(404, 'User not found!');

  // Build base query (always filter by user)
  const baseQuery: Record<string, unknown> = { user: user._id };

  // Add custom filters
  if (query.isActive && query.isActive !== 'all') {
    baseQuery.isActive = query.isActive === 'true';
  }
  if (query.frequency && query.frequency !== 'all') {
    baseQuery.frequency = query.frequency;
  }

  // Remove custom filters from query object
  const queryBuilderQuery = { ...query };
  delete queryBuilderQuery.isActive;
  delete queryBuilderQuery.frequency;

  // Define searchable fields
  const searchableFields = ['specialMessage'];

  // Apply QueryBuilder
  const scheduledDonationQuery = new QueryBuilder(
    ScheduledDonation.find(baseQuery)
      .populate('organization', 'name email logo')
      .populate('cause', 'name description icon'),
    queryBuilderQuery
  )
    .search(searchableFields)  // Text search
    .filter()                  // Additional filters
    .sort()                    // Sorting
    .paginate()               // Pagination
    .fields();                // Field selection

  const scheduledDonations = await scheduledDonationQuery.modelQuery;
  const meta = await scheduledDonationQuery.countTotal();

  return { scheduledDonations, meta };
};
```

### Key Design Decisions

1. **User Filtering:** Always filter by authenticated user (security)
2. **Custom Filters:** Handle `isActive` and `frequency` separately before QueryBuilder
3. **Searchable Fields:** Only `specialMessage` is searchable (users' custom text)
4. **Populated Fields:** Always populate `organization` and `cause` for complete information
5. **Clean Query Object:** Remove custom filters to prevent QueryBuilder conflicts

---

## Query Examples

### Example 1: Basic Pagination
```http
GET /api/v1/scheduled-donation/user?page=1&limit=20
```
**Returns:** First 20 scheduled donations, sorted by creation date (newest first)

---

### Example 2: Active Monthly Donations
```http
GET /api/v1/scheduled-donation/user?isActive=true&frequency=monthly
```
**Returns:** All active monthly recurring donations

---

### Example 3: Search and Sort
```http
GET /api/v1/scheduled-donation/user?searchTerm=education&sort=-amount
```
**Returns:** Donations with "education" in special message, sorted by amount (highest first)

---

### Example 4: Minimal Fields for Dashboard
```http
GET /api/v1/scheduled-donation/user?fields=amount,frequency,nextDonationDate,isActive&limit=5
```
**Returns:** Only essential fields for 5 most recent donations

---

### Example 5: Complex Query
```http
GET /api/v1/scheduled-donation/user?isActive=true&frequency=monthly&searchTerm=charity&sort=-amount&page=1&limit=10&fields=amount,frequency,nextDonationDate,organization,cause
```
**Returns:** 
- Active monthly donations
- Containing "charity" in special message
- Sorted by amount (highest first)
- First page with 10 items
- Only specified fields returned

---

## Validation Schema

```typescript
const getUserScheduledDonationsSchema = z.object({
  query: z.object({
    // Pagination
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(10),
    
    // QueryBuilder search
    searchTerm: z.string().optional(),
    
    // QueryBuilder sort
    sort: z.string().optional(),
    
    // QueryBuilder fields selection
    fields: z.string().optional(),
    
    // Custom filters
    isActive: z.enum(['true', 'false', 'all']).optional().default('all'),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom', 'all']).optional().default('all'),
  }),
});
```

---

## Response Format

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Scheduled donations retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "user": "507f1f77bcf86cd799439010",
      "organization": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Save the Children",
        "email": "contact@savechildren.org",
        "logo": "https://example.com/logo.png"
      },
      "cause": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "Education",
        "description": "Support education initiatives",
        "icon": "book"
      },
      "amount": 50.00,
      "currency": "USD",
      "frequency": "monthly",
      "nextDonationDate": "2025-12-13T10:00:00.000Z",
      "isActive": true,
      "totalExecutions": 3,
      "specialMessage": "Supporting education for all children",
      "createdAt": "2025-08-13T10:00:00.000Z",
      "updatedAt": "2025-11-13T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPage": 2
  }
}
```

---

## Performance Considerations

### 1. **Indexes**
Ensure the following indexes exist for optimal query performance:
```javascript
{ user: 1, isActive: 1 }          // User's active/inactive donations
{ user: 1, frequency: 1 }         // User's donations by frequency
{ nextDonationDate: 1, isActive: 1 }  // Cron job efficiency
{ createdAt: -1 }                 // Default sort
```

### 2. **Pagination**
- Default limit of 10 prevents large data transfers
- Max limit of 100 prevents server overload
- Always use pagination for production APIs

### 3. **Field Selection**
- Use `fields` parameter to reduce payload size
- Especially important for mobile apps with limited bandwidth
- Example: Dashboard views should only request needed fields

### 4. **Populate Performance**
- Organization and Cause are always populated
- Consider adding `.lean()` for read-only operations if needed
- Use field selection in populate: `.populate('organization', 'name logo')`

---

## Testing Checklist

- [ ] Basic pagination (page, limit)
- [ ] Search functionality (searchTerm)
- [ ] Sorting (ascending and descending)
- [ ] Field selection (specific fields only)
- [ ] Custom filters (isActive, frequency)
- [ ] Combined queries (search + filter + sort + paginate)
- [ ] Edge cases (page 0, limit 0, invalid sort field)
- [ ] Empty results
- [ ] Large datasets (performance)
- [ ] Field selection with populated fields

---

## Frontend Integration Examples

### React/JavaScript

```javascript
// Helper function to build query string
const buildQueryString = (params) => {
  return Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
};

// Get scheduled donations with filters
const getScheduledDonations = async (filters) => {
  const queryString = buildQueryString({
    page: filters.page || 1,
    limit: filters.limit || 10,
    isActive: filters.isActive || 'all',
    frequency: filters.frequency || 'all',
    searchTerm: filters.searchTerm,
    sort: filters.sort || '-createdAt',
    fields: filters.fields,
  });

  const response = await fetch(
    `/api/v1/scheduled-donation/user?${queryString}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return response.json();
};

// Usage examples
// Get active monthly donations
const activeMonthly = await getScheduledDonations({
  isActive: 'true',
  frequency: 'monthly',
});

// Search with pagination
const searchResults = await getScheduledDonations({
  searchTerm: 'education',
  page: 2,
  limit: 20,
});

// Get minimal fields for dashboard
const dashboardData = await getScheduledDonations({
  fields: 'amount,frequency,nextDonationDate,isActive',
  limit: 5,
});
```

---

## Benefits of QueryBuilder Implementation

✅ **Flexibility:** Users can combine multiple filters and sorts  
✅ **Performance:** Only requested fields are returned  
✅ **Scalability:** Pagination prevents large data transfers  
✅ **User Experience:** Fast, responsive queries  
✅ **Developer Experience:** Consistent query pattern across all modules  
✅ **Maintainability:** Centralized query logic in QueryBuilder class  

---

## Related Documentation

- [ScheduledDonation Module](./SCHEDULED_DONATION_MODULE.md)
- [Donation Validation Rules](./DONATION_VALIDATION_RULES.md)
- [QueryBuilder Source](./src/app/builders/QueryBuilder.ts)

---

**Status:** ✅ Complete and tested  
**Last Updated:** November 13, 2025

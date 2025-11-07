## 🧾 Developer Spec Brief

**Feature:** Explore Page (Search + Discovery)

**Project:** Crescent Change – Donor App

**Prepared for:** Frontend & Backend Developers

**Objective:** Build an Explore page that allows donors to discover, search, and filter verified organisations such as charities, mosques, and non-profits. The page must support location-based filtering, keyword search, and display verification badges (Waqf, Zakat Eligible, Tax Deductible).

---

### 1. **Purpose**

Provide users with a clear and intuitive interface to explore verified organisations and causes. The page should support personalised discovery by location, cause type, and verification status, helping donors easily find and connect with reputable initiatives.

---

### 2. **Search & Filter Features**

### a. **Search Bar**

- Search by organisation name or cause
- Auto-suggestions (optional future feature)

### b. **Location Filter**

- Dropdown selector (default to user’s city if available)
- Updates displayed organisations based on selected location

### c. **Recent Searches**

- Display up to 3 recent search entries
- Tap to re-search
- Option to remove individual entries

---

### 3. **Category Filter Chips**

- Displayed at the top as scrollable chips
- Users can filter by:
  - Mosque
  - Charity
  - Non-Profit
  - Shelter
  - Additional tags like Health, Education (if applied)
- Multiple chips can be selected
- Real-time updates to results on toggle

---

### 4. **Verification Badges**

Organisations may have one or more of the following badges:

| Badge                 | Description                                 |
| --------------------- | ------------------------------------------- |
| 🟢 **Waqf**           | Indicates the organisation is a Waqf trust  |
| 🟡 **Zakat Eligible** | Donations qualify toward Zakat              |
| 🔵 **Tax Deductible** | Donations are tax deductible (ATO verified) |

Badges are visible:

- On the organisation card in the Explore feed
- On the Organisation Detail Page

---

### 5. **Organisation Cards**

Each card should display:

- Organisation logo
- Organisation name
- Location (city, country)
- Category (e.g., Education, Health)
- Any relevant verification badges (Waqf, Zakat, Tax Deductible)
- Donor activity preview (e.g., "+983 people have donated")
- Tapping a card navigates to the Organisation Detail page

---

### 6. **Backend Requirements**

### a. **Organisation Data Fields**

Each organisation record must include:

- `name`
- `logo_url`
- `location` (city, country)
- `category`
- `waqf_verified` (boolean)
- `zakat_eligible` (boolean)
- `tax_deductible` (boolean)
- `donor_count`
- Tags and metadata for filtering

### b. **Search Indexing**

- Enable full-text search on:
  - Organisation name
  - Category
  - Location
- Support filtering by:
  - Organisation type (e.g., mosque, charity)
  - Location
  - Verification status

---

### 7. **Admin Controls**

Through the Super Admin dashboard:

- Admins can manage:
  - Verification tags (Waqf, Zakat, Tax Deductible)
  - Featured status on Explore page
- Admins can view:
  - Organisation search engagement logs
  - Most searched causes or tags

---

### 8. **User Experience Behaviours**

| User Action           | App Response                         |
| --------------------- | ------------------------------------ |
| Search by keyword     | Show matching organisations          |
| Change city/location  | Filter results accordingly           |
| Select filter chip(s) | Update Explore feed in real time     |
| Tap org card          | Navigate to Organisation Detail view |
| Use recent search     | Pre-fill and re-run previous query   |

---

### 9. **Testing Requirements**

- Verify all filters (location, chip, verification badge) function correctly
- Confirm organisation card data displays accurately
- Validate search query returns relevant results
- Test search and filter combinations across cities
- Confirm navigation to Organisation Detail page works on tap

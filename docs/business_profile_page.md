## Developer Spec Brief

**Feature:** Business Profile Page (Synced to Donor App)

**Project:** Crescent Change – Business Admin App

**Prepared for:** Backend, Frontend, and Mobile Developers

**Objective:** Build a Business Profile page that allows businesses to manage their public-facing profile and rewards. Any updates made through the Business Admin App must reflect in real time on the Donor App, ensuring consistency across both platforms.

---

### 1. **Purpose**

To give businesses full control over how they appear in the Crescent Change Donor App, including branding, contact info, and reward visibility. Any changes made must immediately sync and update the corresponding public profile and rewards shown to donors.

---

### 2. **Core Features**

### a. **Editable Business Information**

- Business Name
- Business Category (e.g., Café, Gym, Retail)
- Business Description / Bio
- Business Logo (upload)
- Cover Banner Image (upload)

### b. **Contact & Location Details**

- Business Address (Google Maps autocomplete or manual input)
- Business Email (read-only after verification)
- Contact Phone
- Website or booking link
- Instagram or social link

### c. **Public Visibility Controls**

- **Show in Donor App Directory** (toggle)
  - When ON, business appears in Explore and Search
  - When OFF, business is hidden from donors
- **Allow Donors to Follow or Save Business** (toggle)

### d. **Verification Status**

- ✅ “Verified Business” badge (based on ABN + Stripe Connect setup)
- Displayed read-only once approved by Super Admin

### e. **Profile Completion Tracker**

- Encourage full setup by showing:
  - % Complete
  - Checklist (e.g., logo uploaded, reward live, contact info added)

---

### 3. **Rewards Sync Requirement**

- All **rewards uploaded or updated** via the Business Admin App (titles, limits, expiry, image) must sync to the **Donor App reward page** for that business.
- Donors should only see:
  - Active rewards
  - Within expiry range
  - With remaining quantity

---

### 4. **Live Sync Requirement**

All updates from the Business Admin App must reflect in the Donor App in near real-time. This includes:

- Profile photo or name updates
- Description or contact changes
- Visibility toggles
- Rewards added, edited, or archived

Recommended methods:

- Use WebSockets, Pub/Sub, or webhook-triggered cache refresh
- Use shared database or unified API layer for both apps

---

### 5. **Backend & Data Model Requirements**

### a. **Business Profile Model**

- `business_id`
- `name`
- `category`
- `description`
- `logo_url`
- `banner_url`
- `address`
- `email`
- `phone_number`
- `website_url`
- `instagram_url`
- `is_verified`
- `is_visible_to_donors`
- `allow_followers`
- `profile_completion_score`

### b. **Shared Rewards Model**

- Rewards are linked to `business_id` and shared across both apps
- Business updates (name, logo, etc.) must also reflect in reward card layout on the Donor App

---

### 6. **UI/UX Behavior**

| Action on Business Admin App        | Result in Donor App                                      |
| ----------------------------------- | -------------------------------------------------------- |
| Update business name or description | Reflected immediately on business detail page            |
| Upload or change logo/banner        | Displayed in Donor App profile and reward cards          |
| Toggle “Show in Donor App” OFF      | Business hidden from explore and search                  |
| Add or update reward                | Reward shows/updates in real time under business profile |

---

### 7. **Testing Requirements**

- Confirm updates sync within a few seconds or on refresh in Donor App
- Validate reward visibility rules (active, expiry, limit)
- Test both incomplete and complete profiles
- Confirm toggling visibility removes/returns business in donor search

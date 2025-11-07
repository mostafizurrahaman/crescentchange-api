## Developer Spec Brief

**Feature:** Rewards Management Page

**Project:** Crescent Change – Business Admin App

**Prepared for:** Backend, Frontend, and Mobile Developers

**Objective:** Build a Rewards page where businesses can create, manage, and track in-store and online rewards. This feature allows businesses to incentivize donor engagement by offering products, discounts, or experiences redeemable through the Crescent Change platform.

---

### 1. **Purpose**

Provide businesses with full control over their reward offerings. Businesses can upload new rewards, set redemption limits and expiry dates, and track performance metrics such as number of redemptions and availability.

---

### 2. **Key Reward Types**

| Type            | Description                                              |
| --------------- | -------------------------------------------------------- |
| In-Store Reward | Redeemed by scanning a QR code or using NFC on-site      |
| Online Reward   | Redeemed using a one-time or reusable code, or gift card |

Each reward can be tagged as either In-Store or Online, and the system should handle redemption tracking accordingly.

---

### 3. **Core Features**

### a. **Reward Listing View**

- List all existing rewards in a card or table format
- Display for each reward:
  - Title
  - Type (In-store / Online)
  - Availability (Remaining / Total)
  - Expiry date
  - Status (Active / Expired / Upcoming)
  - Redemption count

### b. **Create New Reward Flow**

- Fields required:
  - Reward Title
  - Type: In-Store or Online
  - Description
  - Upload image (optional)
  - Redemption Limit (e.g., 100 uses)
  - Expiry Date
  - Optional: Terms and Conditions field
  - For Online Rewards: Upload codes or gift card CSV file

### c. **Edit or Archive Existing Rewards**

- Ability to:
  - Edit active rewards
  - Pause or archive a reward (soft delete)
  - Extend expiry date or update available quantity

---

### 4. **Online Reward Specifics**

- Ability to upload codes via CSV
- Preview codes list
- Mark used / remaining codes
- Auto-remove codes after redemption
- Gift card type rewards should allow uploading direct links or gift card numbers

---

### 5. **Redemption Tracking**

- Track redemptions per reward:
  - By date
  - By user (optional in analytics)
  - By method (QR, code, link)
- Display real-time availability (e.g., “23 of 100 claimed”)

---

### 6. **Backend Requirements**

### a. **Rewards Data Model**

Each reward must include:

- `title`
- `description`
- `type` (in-store / online)
- `status` (active, expired, upcoming, archived)
- `expiry_date`
- `redemption_limit`
- `redeemed_count`
- `image_url` (optional)
- For online: associated redemption codes list

### b. **Admin Controls**

- Super Admins can:
  - View all business rewards
  - Flag/remove inappropriate rewards
  - See top-performing reward campaigns

---

### 7. **UX Behavior**

| User Action          | App Response                          |
| -------------------- | ------------------------------------- |
| Create new reward    | Opens reward form with validation     |
| Tap reward in list   | Opens detail view with edit + metrics |
| Upload CSV for codes | Parses and validates codes            |
| Redeem limit reached | Reward automatically marked inactive  |
| Expiry date passes   | Status auto-updates to “Expired”      |

---

### 8. **Testing Requirements**

- Validate reward creation for both types
- Test upload and use of online codes
- Confirm redemption count updates correctly
- Test UI behavior for expired or paused rewards
- Validate file uploads (CSV) and error handling

---

Let me know if you’d like this expanded to include redemption flow integration with the Donor App, or aligned with analytics and notifications.

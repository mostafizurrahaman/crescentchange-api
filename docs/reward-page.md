## Developer Spec Brief

**Feature:** Rewards Page (Donor App)

**Project:** Crescent Change – Donor Mobile App

**Prepared for:** Frontend, Backend, and Mobile Developers

**Objective:** Build a fully integrated Rewards system that allows users to earn points based on donations, browse available rewards from verified businesses, filter rewards by categories or business, and redeem them using a points-based system. All business and reward data must sync directly from the Business Admin App.

---

### 1. **Purpose**

To incentivize donations through a gamified reward system, where users earn points as they donate and redeem them for real-world rewards provided by participating businesses. This encourages continued giving while promoting community businesses.

---

### 2. **Earning & Point System**

- **Donation-to-Points Conversion**:
  - For every **$1 donated**, the user earns **100 points**
  - Points accumulate and contribute to unlocking rewards and progress toward milestone points
- **Points Progress Tracker**:
  - Horizontal progress bar showing tiers (e.g. 100, 1000, 1500, 2000, 3000)
  - Visual marker showing how many more donations are needed to reach next milestone
  - Dynamically updated based on donation history

---

### 3. **Rewards Listing**

- Display all active rewards synced from verified businesses in the **Business Admin App**
- Each reward card must display:
  - Business logo
  - Reward title (e.g., “10% off on Groceries”)
  - Point value (e.g., 150 points)
  - Reward description
  - Expiry date
  - Category tag (e.g., Food, Clothing, Health)
  - CTA button: "Redeem" or "Claimed"
- Rewards should be **filtered by**:
  - Category tabs (e.g., All, Food, Clothing, Groceries, Health)
  - Business (brand logo like Amazon, Adidas, H&M)
  - Keyword Search (top of screen)

---

### 4. **Redemption & Status Sync**

- On redemption:
  - Points are deducted from user's total
  - Reward is marked as **Claimed** and moved to "My Rewards" tab
  - A unique **QR Code or Reward Code** is generated for in-store or online use
  - Reward status updates in both the **Donor App** and **Business Admin App**
- Redemption metadata stored:
  - `user_id`
  - `reward_id`
  - `business_id`
  - `points_spent`
  - `timestamp`
  - `status` = Claimed/Redeemed/Expired

---

### 5. **Tab Navigation**

- **Explore Tab**:
  - Full reward catalogue
  - Filterable and searchable
  - Suggested brands based on user history or popularity
- **My Rewards Tab**:
  - Displays only the rewards user has claimed
  - Shows status: Claimed, Expired, or Redeemed
  - QR Code or code visible if valid
  - Countdown if time-limited

---

### 6. **Backend & Data Sync Requirements**

### a. **Rewards & Business Sync**

- Rewards must be:
  - Created/updated via **Business Admin App**
  - Instantly reflected in the Donor App listing
  - Filterable by category, brand, or expiry
- Business info shown on reward cards pulls from verified business profiles (logo, name, category)

### b. **Points & User Tracking**

- Points system tied to donation module
- Redeemed rewards and badge progress must update in real-time
- Ensure point spending cannot exceed available balance

---

### 7. **UI/UX Behaviors**

| User Action                                | Expected App Response                         |
| ------------------------------------------ | --------------------------------------------- |
| Donate $1                                  | +100 points added to reward balance           |
| Tap “Redeem”                               | Points deducted, reward added to "My Rewards" |
| Tap on a business badge                    | Filters rewards by that business              |
| Search for a reward                        | Results update live                           |
| Switch tabs (Explore / My Rewards)         | Loads corresponding list of rewards           |
| Attempt to redeem with insufficient points | Show error: “Not enough points”               |

---

### 8. **Testing Requirements**

- Earn points through donation and validate points credited correctly
- Test reward filtering by category and business
- Test redemption logic and point deduction
- Validate QR code or reward code generation and syncing to Business Admin App
- Confirm badge progress and reward availability update in real-time

---

Let me know if you’d like this spec extended into a flow diagram or paired with the Rewards Admin Panel on the business side for end-to-end implementation.

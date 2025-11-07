## 🧾 Developer Spec Brief

**Feature:** Home Page (Dashboard Overview)

**Project:** Crescent Change – Business Admin App

**Prepared for:** Frontend, Backend, and Mobile Developers

**Objective:** Build a centralised, data-driven Home Page (Dashboard) for businesses to view high-level insights, manage their Crescent Change activity, and access quick links to essential features such as rewards, redemptions, directory presence, and performance analytics.

---

### 1. **Purpose**

The Business Admin App Home Page acts as the main landing screen for approved business accounts. It offers a summary of current performance, activity, and engagement metrics, and provides navigational entry points to manage features like rewards, redemptions, and directory listings.

---

### 2. **Key Components**

### a. **Welcome Header**

- Display a greeting with business name (e.g., “Welcome, Ali’s Cafe”)
- Include business profile picture or logo (from onboarding)
- Quick status indicator (e.g., Verified / Pending Verification)

### b. **Top Metrics Overview**

- Key data points displayed in a grid or horizontal cards:
    - 🪙 **Total Rewards Redeemed** (e.g., “126 redemptions this month”)
    - 💳 **Total QR/Code Scans** (in-store or online redemptions)
    - 🧾 **Gift Cards Sent** (if feature is enabled)
    - 👥 **Followers/Saves** (how many donors have saved or followed the business)

### c. **Activity Snapshot / Timeline**

- Chronological feed showing latest activity:
    - Reward redeemed (with item and timestamp)
    - Gift card claimed
    - Business followed
    - Reward campaign updated
- Display time-based filters (e.g., Today, This Week, This Month)

### d. **Quick Access Buttons / Shortcuts**

- Icons or CTA buttons that link to:
    - Manage Rewards
    - Upload New Gift Cards or Codes
    - Update Directory Listing
    - View Redemptions Log
    - Access Business Profile settings

### e. **Announcement Banner (Optional)**

- Use this section to:
    - Alert business of new features (e.g., “New reward templates now available”)
    - Show pending actions (e.g., “Upload your logo to complete your profile”)

---

### 3. **Backend Requirements**

### a. **Business Metrics API**

- Endpoint that returns key KPIs:
    - Total redemptions
    - Total QR scans / online redemptions
    - Total followers/saves
    - Total gift cards uploaded/sent
- Must be filterable by time period

### b. **Activity Feed API**

- Fetch latest 10–20 activities related to that business
- Support filter by type (redemption, follower, update)

### c. **Profile Completion Check**

- System to check for missing elements (logo, address, category)
- Display prompt or progress bar if profile is incomplete

---

### 4. **UI/UX Behavior**

| User Action | App Response |
| --- | --- |
| Launch Business App | Load home dashboard with greeting and data |
| Tap on a stat block | Redirect to detailed view (e.g., full redemptions log) |
| Tap “Manage Rewards” | Navigate to rewards management section |
| New activity occurs | Feed updates on refresh or via polling |
| Incomplete profile | Display warning banner or CTA to update details |

---

### 5. **Testing Requirements**

- Verify metrics match actual backend records
- Confirm shortcut buttons correctly route to destination pages
- Test data loads smoothly with pagination or load-more (if needed)
- Test states: no redemptions, no followers, no activity
- Ensure layout is responsive on various screen sizes
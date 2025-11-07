## Developer Spec Brief

**Feature:** Analytics Page

**Project:** Crescent Change – Business Admin App

**Prepared for:** Backend, Frontend, and Mobile Developers

**Objective:** Build an Analytics page that provides business users with clear, actionable insights into their engagement on Crescent Change. This includes reward activity, redemption behavior, business directory performance, and donor interactions.

---

### 1. **Purpose**

To provide businesses with real-time insights and performance data across their Crescent Change activity, enabling them to assess ROI, improve engagement, and tailor their reward offerings more effectively.

---

### 2. **Key Analytics Categories**

### a. **Redemptions & Rewards Performance**

- Total redemptions (filterable by time: Today, This Week, This Month)
- Most redeemed reward item(s)
- Redemption type breakdown:
  - In-store (QR/NFC)
  - Online (code/gift card)
- Peak redemption time (hour/day of week)

### b. **Engagement & Reach**

- Number of Crescent Change users who:
  - Viewed the business profile
  - Saved/followed the business
  - Redeemed a reward
- Impressions vs redemptions ratio
- Top referring causes or charities (where users discovered the business)

### c. **Gift Card & Code Usage (if applicable)**

- Total uploaded
- Total claimed
- Remaining available
- Most frequently used codes (if reusable)

### d. **Location-based Data (if business has multiple branches)**

- Performance by branch/location (optional, if applicable)
- Regional breakdown of users redeeming rewards

---

### 3. **Charts & Visual Elements**

Include the following types of data visualisations:

- Bar charts (e.g., redemptions by day/week)
- Line graphs (e.g., growth in redemptions over time)
- Pie charts (e.g., in-store vs online usage)
- Heatmaps (optional for redemption timing)

Charts must include:

- Time filter toggle (Today, This Week, This Month, Custom Range)
- Data labels and percentage breakdowns

---

### 4. **Backend Requirements**

### a. **Analytics API**

- Aggregate and return:
  - Reward redemptions (by reward ID, time, method)
  - Page views and profile saves
  - QR/code redemption logs
  - Gift card usage
- Support filters:
  - Date range
  - Reward type
  - Redemption method

### b. **Caching/Refresh Logic**

- Implement caching for common time ranges (e.g., "This Month") to reduce server load
- Analytics should auto-refresh daily, with option to manually refresh if needed

---

### 5. **UI/UX Behavior**

| User Action          | App Response                                       |
| -------------------- | -------------------------------------------------- |
| Select date range    | Re-render all graphs and KPIs accordingly          |
| Tap on a chart item  | Show expanded view or tooltip with breakdown       |
| No data available    | Show fallback message (e.g., “No redemptions yet”) |
| Scroll through cards | Load more insights or breakdowns                   |

---

### 6. **Testing Requirements**

- Verify all graph data matches backend reports
- Confirm filters (date, method) work as intended
- Test empty, low-volume, and high-volume scenarios
- Validate visualisation responsiveness across devices
- Confirm API call efficiency and caching logic

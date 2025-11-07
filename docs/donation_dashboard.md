## Developer Spec Brief

**Feature:** Donation Dashboard

**Project:** Crescent Change – Donor App

**Prepared for:** Frontend, Backend, and Mobile Developers

**Objective:** Build an interactive Donation Dashboard that gives users a real-time overview of their giving habits, points earned, upcoming donations, calendar integration, and badge progress. The dashboard centralizes round-up, recurring, and one-time donation insights for a comprehensive donor experience.

---

## 🧩 1. Dashboard Sections

---

### A. **Points Summary**

- **Display:** Total points earned (top left)
- **Calculation:** $1 donated = 100 points
- **Dropdown filter:**
  - View stats for: Last 7 Days, 30 Days, 90 Days, All Time
  - Affects all components: graph, round-up, recurring, one-time

---

### B. **Overview Cards**

### 1. **Round Up Summary**

- Amount rounded up so far within the selected time range
- Current connected organisation (e.g., “Auto-donating to HFL Foundation in 18 days”)
- Status bar for visual engagement
- Message: “Keep going—You're making real change.”

### 2. **Recurring Donations**

- Total donated via scheduled donations in selected period (e.g., $20)
- Data fetched from donation scheduling system

### 3. **One-Time Donations**

- Total donated as manual one-off contributions (e.g., $60)
- Includes donations made outside of round-up or recurring plans

---

### C. **Track Progress Graph**

- **Purpose:** Visualize total donation activity over time
- **Graph Type:** Line chart (Y = donation amount, X = day)
- Stats underneath:
  - Average daily donation
  - Current donation streak (number of consecutive days user donated)

---

### D. **Calendar**

- Week-view calendar for visual donation tracking
- Tapping on a day shows:
  - Donation(s) made or scheduled
  - Amount, org name, and donation type
- Highlight days with activity (e.g., green circle)

---

### E. **Upcoming Donations**

- List of upcoming scheduled donations with:
  - Date/time
  - Organisation name
  - Donation amount
  - Share icon (copy/share confirmation to encourage promotion)
- Pulled from the scheduling module

---

### F. **Badges Overview**

- Scrollable horizontal badge list
- Each badge shows:
  - Name
  - Unlock progress or status
  - Description (e.g., "Donate 5 times in a month to unlock Silver")
  - Badge type (e.g., Round-Up Rebel, Streaker, Top Giver)
- Synced with the Rewards/Badge system

---

## 🧩 2. Backend Requirements

### a. **Data Sources**

- **Donations Table** (includes round-up, recurring, one-time)
- **Points Table** (points earned, redeemed, and total)
- **Reward/Badge System** (earned badges and progress)
- **Schedule Table** (for upcoming donations)
- **Organisation Metadata** (linked charities)

### b. **APIs Required**

- GET `/dashboard/summary`
  Returns round-up, recurring, one-time totals, donation streak, and badges
- GET `/dashboard/graph`
  Returns day-by-day breakdown for graph (filtered by selected date range)
- GET `/dashboard/calendar`
  Returns donation status per day (scheduled/completed)
- GET `/dashboard/upcoming-donations`
  Upcoming donations for current week
- GET `/user/badges`
  Progress and unlock status for badge list

---

## 🧩 3. UX Behavior

| User Action                      | App Response                                       |
| -------------------------------- | -------------------------------------------------- |
| Change time filter               | All stats and graph update accordingly             |
| Tap on calendar day              | Show modal or drawer with donation details         |
| Tap on “View All” for badges     | Opens full badge tracker screen                    |
| Tap on “Upcoming Donation” share | Opens share modal with preset message + amount/org |

---

## 🧩 4. Testing Requirements

- Ensure accurate sync between all donation types and points
- Validate time filter affects all modules
- Test donation streak and graph data correctness
- Confirm correct badge unlock logic and statuses
- Test empty states (e.g., no donations, no badges)
- Validate calendar interactions and upcoming donation scheduling display

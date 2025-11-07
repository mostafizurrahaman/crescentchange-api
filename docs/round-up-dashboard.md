## Developer Spec Brief

**Feature:** Round-Up Donations

**Project:** Crescent Change – Donor App

**Prepared for:** Backend, Frontend, and Mobile Developers

**Objective:** Enable users to automatically round up their purchases and donate the spare change to a selected organisation. Users can set monthly thresholds, link a bank account, and monitor progress toward their donation trigger. The system must sync with Basiq and Stripe and update donation activity in real time.

---

## 🧩 1. Round-Up Dashboard

---

### A. **Purpose**

Allow users to view:

- Total amount rounded up
- Progress toward donation trigger (e.g., $50 or 30 days)
- Organisations donated to
- Recent round-up activity (transaction logs)

---

### B. **Key Display Elements**

| Section               | Functionality                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Total Donated         | Shows total round-up donation for selected period (e.g., $120.75)                               |
| Progress Meter        | Circular meter showing progress to next deposit trigger (e.g., 60%)                             |
| Trigger Rule          | "Deposit triggers when you hit $50 or after 30 days"                                            |
| Daily Rounds Summary  | Shows amount rounded up today                                                                   |
| Auto-Donate Countdown | Countdown showing days left before next auto-donation                                           |
| Organisation Cards    | Shows the verified charities selected by the user                                               |
| Recent Activity       | Log of latest round-up events with transaction source, value, timestamp, and donation recipient |

---

### C. **Functionality**

- Tracks daily round-ups using Basiq transaction data
- Auto-donates via Stripe when:
  - User hits their threshold OR
  - 30 days pass (whichever comes first)
- Logs each donation in the donation history
- Shows which organisation each round-up went to (real-time assignment)

---

## 🧩 2. Round-Up Settings Page

---

### A. **Purpose**

Enable users to configure how round-up donations work, including thresholds, bank accounts, recipient organisations, and personal messages.

---

### B. **Fields & Controls**

| Field                | Details                                                              |
| -------------------- | -------------------------------------------------------------------- |
| Organisation         | Displays selected charity (dropdown or modal to “Change”)            |
| Bank Account Link    | Displays connected bank (from Basiq) — allow change                  |
| Threshold Amount     | Pre-set buttons ($10, $25, $30, $40, $50), Custom field, or No Limit |
| Special Message      | Optional message that is sent to the org or shown in their dashboard |
| Cancel This Donation | Option to stop round-up and delete current setup                     |
| Save Button          | Confirms all settings and stores to backend                          |
| Cancel Button        | Discards changes and returns to dashboard                            |

---

### C. **Logic & Syncing**

- Threshold and account data sync to backend and trigger round-up logic
- Organisation selected determines where funds are sent at the end of cycle
- Special message is stored per cycle and can be sent to the org via the Business Admin dashboard
- Cancel action deactivates the round-up flag for that user in the backend

---

## 🧩 3. Backend Requirements

### A. **Round-Up Tracking**

- Linked via Basiq transaction feed
- Record each eligible transaction
- Store:
  - `user_id`
  - `transaction_id`
  - `original_amount`
  - `round_up_value`
  - `date`
  - `assigned_org_id`

### B. **Auto-Donation Trigger**

- Triggers via cron job or scheduled function when:
  - Monthly threshold is reached OR
  - 30-day period completes
- Uses Stripe to process and send total to the selected charity

### C. **APIs Required**

- GET `/round-up/summary`
- POST `/round-up/settings`
- PATCH `/round-up/cancel`
- GET `/round-up/activity`
- POST `/round-up/donate-now` (for manual donation triggers)

---

## 🧩 4. UX Behaviors

| User Action           | App Response                                                  |
| --------------------- | ------------------------------------------------------------- |
| Connect bank          | Launch Basiq consent flow                                     |
| Change org            | Show modal with verified organisations                        |
| Set threshold         | Update stored limit and recalculate auto-donate triggers      |
| Tap “Save”            | Confirmation + return to dashboard                            |
| Auto-donate triggered | Show update in dashboard + send push/email confirmation       |
| Tap activity log item | Expand for details (e.g., source of transaction, org, amount) |

---

## 🧩 5. Testing Requirements

- Round-up values calculated correctly for all transactions
- Auto-donation triggers under correct conditions
- Threshold settings persist and are respected
- Dashboard displays correct donation history and upcoming schedule
- Organisation switch reflects in all future round-up assignments
- Cancel flow removes round-up tracking without breaking history
- Basiq and Stripe sync confirmed end-to-end

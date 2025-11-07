## Developer Spec Brief

**Feature:** Redeem Rewards (Validation & Tracking)

**Project:** Crescent Change – Donor App & Business Admin App

**Prepared for:** Backend, Frontend, and Mobile Developers

**Objective:** Enable a secure reward redemption system where donors are issued unique QR codes or reward codes upon claiming a reward. These codes must sync to the Business Admin App and can only be redeemed once. All redemptions must be tracked and reflected in real-time across both platforms.

---

### 1. **Purpose**

To provide a seamless reward claiming and redemption experience across the Crescent Change ecosystem, ensuring that:

- Donors receive a unique redeemable QR or reward code
- Businesses can validate and process redemptions in real time
- Redemption is tracked, marked as used, and synced across both apps

---

### 2. **User Flow Summary**

### a. **On Donor App**

1. User selects a reward from a business profile
2. App generates a **unique QR code** or **reward code**
3. This code is stored as a **pending redemption**
4. Code is visible in the user’s “My Rewards” tab

### b. **On Business Admin App**

1. Business opens the “Redeem Reward” screen
2. User presents QR code or reward code in-store
3. Business scans (or manually enters) the code
4. System verifies the code
5. If valid: reward is marked as redeemed
6. Syncs update status on both apps instantly

---

### 3. **Code Generation & Syncing**

### a. **Code Types**

- **QR Code** (for in-store use)
- **Reward Code** (short alphanumeric for manual use)

### b. **Code Rules**

- One-time use only
- Unique per reward claim
- Expiry can be set (e.g., valid for 48 hours after claim)

### c. **Sync Requirements**

- Code and status must be:
  - Stored in shared backend (linked to user and reward)
  - Visible to both Business Admin and Donor App
- Once verified or redeemed:
  - Status changes to “Redeemed”
  - Donor App shows ✅ “Redeemed” confirmation
  - Business App logs redemption in activity history

---

### 4. **Redemption Validation (Business Admin App)**

### a. **Scan or Enter Code**

- Business can:
  - Scan QR using device camera
  - Manually enter alphanumeric reward code

### b. **Backend Validation**

- System checks:
  - Code validity
  - If already redeemed
  - Expiry (if set)
  - Matching business ID

### c. **Result Display**

- If valid: show reward name + success status
- If invalid: show clear error (e.g., “Code expired or already used”)

---

### 5. **Redemption Tracking (Both Apps)**

- All redemptions logged with:
  - `user_id`
  - `reward_id`
  - `business_id`
  - `code_used`
  - `method` (QR/manual)
  - `timestamp`
  - `status` (Pending, Redeemed)
- Logs are accessible in:
  - Donor App → “My Rewards” → Reward History
  - Business Admin App → “Redemption Log” tab

---

### 6. **Backend & Syncing Requirements**

### a. **Shared Redemption Table**

- Centralised table linking:
  - Donor reward claim
  - Generated QR/reward code
  - Redemption status

### b. **API Requirements**

- Generate code on claim (Donor App)
- Validate + update redemption (Business App)
- Fetch reward status (both apps)
- Webhook or pub/sub event to trigger UI refresh on status update

---

### 7. **UI/UX Behavior**

| Action                   | Donor App                | Business Admin App                       |
| ------------------------ | ------------------------ | ---------------------------------------- |
| Reward claimed           | Shows code + “Pending”   | Code listed as “awaiting redemption”     |
| Code scanned & validated | Updates to ✅ “Redeemed” | Displays success message + reward detail |
| Code invalid or expired  | Shows ❌ error message   | Shows error + redemption blocked         |

---

### 8. **Testing Requirements**

- Generate and redeem QR and reward codes
- Attempt double-redemption (must fail)
- Validate sync updates on both apps
- Test expired and invalid code handling
- Confirm logs display properly for both parties\

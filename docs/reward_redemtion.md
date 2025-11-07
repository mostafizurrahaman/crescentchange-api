## Developer Spec Brief

**Feature:** Reward Redemption Process

**Project:** Crescent Change – Donor App

**Prepared for:** Frontend, Backend, and Mobile Developers

**Objective:** Implement a seamless and secure redemption process for rewards claimed by users. The process must support QR code, NFC, and static code redemptions, and ensure real-time status updates across both the Donor App and the Business Admin App.

---

### 1. **Redemption Flow Overview**

Upon redeeming a reward, the user is presented with a unique identifier (QR Code, NFC, or Static Code) that is validated by the business during in-store or online redemption. Once validated, the status of the reward updates in real-time in both apps and cannot be reused.

---

### 2. **Supported Redemption Methods**

### a. **QR Code**

- A unique QR code is generated for the reward upon redemption.
- Displayed in the "My Rewards" tab under "Redemption Details".
- Scanned by the business via the Business Admin App.
- On successful scan, reward status is marked as **Redeemed**.

### b. **NFC Tap**

- Activated via the “Redemption Details” modal.
- NFC tap transmits a unique reward ID/token.
- When read by the business-side app, it marks the reward as **Redeemed**.

### c. **Static Code (Online/Manual)**

- An alphanumeric reward code (e.g. `AMAZON10FRESH`) is generated or selected from a pool.
- Visible in the app and also emailed/SMS’d to the user.
- Used by the user online or shown to the business.
- Once used, it’s marked as **Redeemed** or **Used**.

---

### 3. **Redemption Lifecycle States**

| State        | Description                           |
| ------------ | ------------------------------------- |
| **Active**   | Available for redemption              |
| **Claimed**  | User has redeemed it but not used yet |
| **Redeemed** | Reward has been scanned/used          |
| **Expired**  | Reward not used before expiry date    |

---

### 4. **Redemption Flow Steps**

1. **User taps "Redeem Reward"**
   - Points are deducted.
   - A unique redemption instance is created.
2. **User sees Redemption Details**
   - Based on reward type, user sees:
     - QR Code
     - NFC Option
     - Static Code
   - Option to “Copy Code” or present to store
3. **Business scans or inputs reward**
   - The Business Admin App validates the reward
   - On success, the system:
     - Updates status = `Redeemed`
     - Stores timestamp, user ID, business ID, and method
4. **User sees Confirmation Screen**
   - "✅ Reward Redeemed Successfully"
5. **If expired or reused**
   - System blocks the action
   - User sees: "⚠️ Reward has expired or already been used"

---

### 5. **Backend Requirements**

### a. **Redemption Object**

Each reward claim must include:

- `reward_redemption_id`
- `reward_id`
- `user_id`
- `business_id`
- `method` (qr, nfc, static)
- `code` or `token`
- `status` (active, claimed, redeemed, expired)
- `created_at`, `redeemed_at`
- `expires_at`

### b. **Redemption API Endpoints**

- **POST /redeem**: Creates a redemption instance
- **GET /my-rewards**: Fetches active/claimed/redeemed rewards
- **POST /validate-reward**: Used by Business App to confirm redemption
- **PATCH /reward-status**: Updates status across both apps

---

### 6. **Validation Rules**

- Code/QR must be:
  - Unique per user per reward
  - Not already redeemed or expired
  - Tied to the correct business
- Redemption is only valid if:
  - The user has enough points
  - The reward hasn’t expired
  - The business validates the code/token

---

### 7. **UX Behavior Summary**

| User Action                  | App Response                                   |
| ---------------------------- | ---------------------------------------------- |
| Redeem reward                | Deduct points, show QR/code/NFC option         |
| Use reward successfully      | Show success screen + update status            |
| Attempt expired/redeemed use | Show error message with CTA to explore rewards |
| View My Rewards tab          | Rewards shown with current status + filters    |

---

### 8. **Testing Requirements**

- Redeem reward with all 3 methods (QR, NFC, Static)
- Ensure single-use enforcement
- Validate expiration functionality
- Sync redemption state across both apps
- Test error handling for invalid/duplicate scans

---

Let me know if you need a flowchart, API spec draft, or matching brief for the Business Admin redemption process.

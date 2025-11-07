**🧾 Developer Spec Brief**

Feature: Round-Up Donation Engine

Project: Crescent Change

Prepared for: Backend & Full-Stack Developers

Objective: Implement a secure and automated round-up donation system that tracks eligible user transactions via Basiq (with CDR consent), calculates round-up amounts, respects user thresholds, prevents duplication, and facilitates direct transfers to connected charities using Stripe.

**1.**

**Purpose**

Allow users to round up their bank transactions to the nearest dollar and donate the spare change to a selected charity. Ensure donations are tracked, accumulated monthly, and transferred directly to the charity. Users must provide CDR consent through Basiq before any financial data is accessed.

**2.**

**CDR Consent via Basiq (Mandatory)**

**a.**

**User Consent Flow**

- Users must complete a Basiq-hosted CDR consent process before their bank transaction data can be accessed.
- The flow will prompt users to:
  - Select their bank
  - Log in securely
  - Review and approve data-sharing consent for Crescent Change (via Basiq)
-

**b.**

**Compliance Requirements**

- The consent form must be shown to users at the start of any bank connection process.
- Crescent Change must:
  - Clearly disclose Basiq’s involvement
  - Allow users to revoke access at any time
  - Store the consent ID, status, and expiry (typically 90 days)
- Consent must be re-obtained when expired

**c.**

**UX Integration**

- Display: “Connect your bank account securely to enable round-up donations”
- Launch Basiq’s consent URL (hosted or embedded)
- Show confirmation and loading state while connection is validated

**3.**

**Transaction Monitoring**

- Once consent is granted, use Basiq to access the user’s transaction feed.
- Monitor eligible debit/credit purchases.
- Exclude non-roundable transactions (e.g., transfers, ATM, BPAY).

**4.**

**Round-Up Calculation**

- For each eligible transaction, calculate the round-up amount (e.g., $4.60 → $0.40).
- Store each entry with the original transaction ID and timestamp.

**5.**

**Monthly Accumulation**

- Aggregate all round-up amounts by user and month.
- Trigger a single donation transaction at month-end (or upon reaching user-set threshold).

**6.**

**Threshold Controls**

- Users can set a monthly donation limit (e.g., $20 cap).
- Once reached, pause further round-up tracking until the next month.
- Notify users in-app when threshold is met.

**7.**

**Duplicate Prevention**

- Ensure each transaction is only processed once.
- Use transaction IDs from Basiq to verify uniqueness.
- Prevent reprocessing during charity or account switches.

**8.**

**Direct Transfer to Charity**

- Use Stripe Connect destination charges to transfer the total monthly round-up amount directly to the selected charity’s Stripe account.
- No funds should be held by Crescent Change.

**9.**

**Charity Switching Logic**

- A user can only link one bank account to one charity per 30-day period.
- To switch:
  - Users can either change the charity for the same account
  - Or link a new bank account to a new charity
-
- Charity switch does not reset the 30-day cycle but takes effect immediately

**10.**

**User Settings**

- In the app, users should be able to:
  - Enable/disable round-ups
  - View current bank account and charity connection
  - Set/change threshold
  - View round-up history
-

**11.**

**Admin Oversight**

- Super Admin and Org dashboards should display:
  - Total round-up amounts per donor and charity
  - Active round-up users and thresholds
  - Any failed transaction syncs or consent expirations
-

**12.**

**Testing & Validation**

- Test full consent flow integration with Basiq sandbox
- Confirm transaction fetch and round-up calculations
- Simulate threshold, switching, and duplication scenarios
- Validate Stripe transfer logic with test connected accounts

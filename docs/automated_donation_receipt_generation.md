# Automated Donation Receipt Generation

## 🧾 Developer Spec Brief

**Feature:** Automated Donation Receipt Generation

**Project:** Crescent Change

**Prepared for:** Backend & Full-Stack Developers

**Objective:** Automate the process of generating, storing, and delivering donation receipts after each successful payment, while ensuring the receipt is properly attributed to the correct charity and meets compliance standards.

---

### 1. **Purpose**

Enable Crescent Change to automatically generate tax-compliant donation receipts for every successful donation (one-time, recurring, or round-up), and make these receipts available to donors both in-app and via email.

---

### 2. **Core Requirements**

### a. **Trigger & Detection**

- Monitor successful donation events via Stripe.
- Capture key data: donation amount, timestamp, donor ID, organisation ID, and Stripe destination account.

### b. **Receipt Generation**

- Create a branded, professional receipt attributed to the selected charity.
- Include the following:
  - Charity name, ABN, and status (e.g. tax-deductible, zakat-eligible)
  - Donor name (or "Anonymous")
  - Date and time of donation
  - Donation amount and method (Visa, Apple Pay, etc.)
  - Unique donation ID/reference
  - Legal disclaimer that Crescent Change issues the receipt on behalf of the charity

### c. **Storage & Tracking**

- Generate the receipt as a downloadable file (PDF preferred).
- Store a secure URL to the receipt in the donor’s donation history.
- Log the receipt in the system database with all relevant metadata.

### d. **In-App Access**

- Donors can view and download receipts from the "My Donations" section of the app.
- Option to resend a receipt to their email on demand.

### e. **Email Delivery**

- Automatically email donors a copy of the receipt upon successful donation.
- Email content should be branded and include a message of thanks.

---

### 3. **Organisation Settings (Optional)**

- In the organisation web dashboard:
  - Allow toggling auto-receipt generation on or off (default: on)
  - Show a preview of the receipt template
  - Show a log of all receipts issued to their donors

---

### 4. **Super Admin Oversight**

- Admin panel includes:
  - Global receipt logs
  - Filters by date, organisation, and donor
  - Option to download or export all receipts as CSV or ZIP
  - Manual resend controls

---

### 5. **Compliance & Branding**

- Ensure every receipt includes charity legal details (ABN, name, tax-deductible status).
- Apply consistent Crescent Change branding.
- Use secure links for downloads (e.g. expiring or token-protected).

---

### 6. **Testing & Validation**

- Test all donation types: round-up, one-time, and scheduled recurring.
- Confirm receipts are only generated upon successful payments.
- Test email formatting and delivery on mobile and desktop.
- Test with both tax-deductible and non-tax-deductible organisations.

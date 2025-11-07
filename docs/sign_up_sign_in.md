🧾 Developer Spec Brief
Feature: Donor App – Sign In & Sign Up (with Conditional Basiq CDR Consent on Round-Up)
Project: Crescent Change
Prepared for: Backend & Mobile App Developers
Objective: Build a secure, mobile-first sign in and sign up system. Unlike the earlier draft, users are no longer forced to connect their bank at registration. Instead, the Basiq CDR consent flow is only triggered when a user enables the round-up feature in the donation tab. This ensures compliance while reducing onboarding friction.

---

1. Purpose
   Allow new users to register and authenticate within the Crescent Change donor app. Users can access standard features (profiles, one-time donations, rewards, etc.) immediately. However, to activate round-up donations or other CDR-dependent features, users must securely link their bank account and approve CDR data-sharing via Basiq.

---

2. Sign Up Requirements
   a. Sign Up Flow
   Step 1: User enters full name, email, mobile, password
   Step 2: User accepts terms of use and privacy policy
   Step 3: User is registered and logged in
   Step 4: (Optional) When user visits donation tab → round-up toggle, trigger Basiq CDR consent flow

b. Basiq CDR Consent (Triggered by Round-Up)
Consent is not mandatory at sign-up
Consent flow only launches when user activates round-up
Consent includes:
Bank authentication
Authorisation of data sharing (transactions, accounts)
Disclosure of purpose (e.g., donation tracking, insights)

Consent must be stored with:
Consent ID
Bank connected
Expiry date (typically 90 days)
Re-consent required on expiration

---

3. Sign In Requirements
   a. Login Methods
   Email + password

b. Security Features
Encrypted password storage
Rate-limiting and brute-force protection
Password reset flow
Token-based session management

---

4. User Profile Initialization
   After successful registration:
   User profile is created in database with:
   Unique ID
   Consent ID + status = null until round-up enabled
   Bank account metadata = null until consent given
   Default round-up = off
   Reward tier = Bronze
   Donation threshold = not set

---

5. Super Admin Visibility
   All new users must:
   Appear in Super Admin dashboard with:
   Full name
   Email
   Mobile number
   Signup date
   Bank connected (only if consent provided)
   Consent status + expiry (if applicable)
   Active flag

---

6. Compliance & CDR Notes
   Basiq is an accredited data recipient under the Consumer Data Right
   Your app must:
   Clearly explain purpose of consent when user enables round-up
   Include Basiq in the privacy policy and user terms
   Allow users to revoke consent (you will be notified via Basiq)
   Periodically check for expired consent and prompt renewal

---

7. Testing Requirements
   Validate user can sign up and access app without linking bank
   Confirm round-up flow always triggers Basiq consent before activation
   Confirm connection with a variety of banks
   Simulate expired consent and renewal flows
   Confirm new users show in Super Admin with full metadata (including consent only when given)
   Ensure round-up donations cannot proceed without valid consent

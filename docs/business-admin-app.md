## Developer Spec Brief

**Feature:** Business Admin App – Onboarding, Sign In & Sign Up

**Project:** Crescent Change – Business Admin Platform

**Prepared for:** Backend, Frontend, and Mobile Developers

**Objective:** Build a streamlined onboarding flow for businesses to register, sign in, and access the Crescent Change Business Admin App. The process must collect key business verification data and connect the business to its profile dashboard upon approval.

---

### 1. **Purpose**

Enable new businesses to securely sign up and existing partners to log in to the Business Admin App. The onboarding process collects essential business details and ensures that only verified businesses gain access to manage their rewards, directory listing, and insights.

---

### 2. **Core Features & Flow**

### a. **Welcome Screen (Onboarding Start)**

- Display Crescent Change branding and a brief message about the purpose of the Business Admin App
- CTA: **"Get Started"** → directs to Sign Up / Log In options

---

### 3. **Sign Up Process (For New Businesses)**

### a. **Required Fields**

- Business name
- ABN (Australian Business Number)
- Business category (dropdown list: e.g., Café, Retail, Gym, etc.)
- Business email (used as login ID)
- Contact number
- Business address (autocomplete or manual entry)
- Upload business logo (optional)
- Create password

### b. **Verification**

- ABN format check
- Business email verification via OTP or confirmation email
- Terms of Service + Privacy Policy checkbox (mandatory)

### c. **Post-Signup Behavior**

- Once form is submitted:
  - Show success message: “Thank you! Your application is under review.”
  - Business is flagged as `pending` in the admin system
  - Super Admin must manually approve access before login is activated

---

### 4. **Sign In Process (For Approved Businesses)**

### a. **Login Method**

- Email + password
- “Forgot Password” flow (email reset link)

### b. **Access Conditions**

- Only approved businesses (`status = approved`) can log in
- If a pending business attempts to log in, show message:
  > “Your account is still under review. We’ll notify you once access is granted.”

---

### 5. **Backend Integration**

### a. **Business Data Model**

Must include:

- `business_name`
- `abn`
- `business_category`
- `email`
- `phone`
- `address`
- `logo_url`
- `password_hash`
- `status` (`pending`, `approved`, `rejected`)
- `created_at`, `last_login`

### b. **Admin Dashboard Visibility**

- New business signups must appear in the **Super Admin dashboard** for review
- Admins can:
  - Approve or reject accounts
  - Edit business profile details
  - Trigger email notification on approval

---

### 6. **UX & UI Behavior**

| User Action                | App Response                                         |
| -------------------------- | ---------------------------------------------------- |
| Tap “Sign Up”              | Loads multi-field form with input validation         |
| Submit form                | Displays confirmation + onboarding complete message  |
| Tap “Sign In”              | Authenticates via backend and redirects to dashboard |
| Try login without approval | Show “Pending review” message                        |
| Reset password             | Sends email with reset link                          |

---

### 7. **Testing Requirements**

- Validate all fields for formatting and required data
- Test email verification and OTP confirmation
- Confirm new sign-ups appear in Super Admin
- Ensure rejected or pending accounts cannot sign in
- Confirm password reset flow
- Confirm secure password hashing and session handling

---

Let me know if you'd like this extended into the next feature spec (e.g. **Business Dashboard**, **Reward Management**, or **Directory Settings**), or if you need this brief formatted for ticketing tools like Jira or Notion.

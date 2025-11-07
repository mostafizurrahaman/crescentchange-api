## Developer Spec Brief

**Feature:** Badges System (Cause-Based Recognition)

**Project:** Crescent Change – Donor App

**Prepared for:** Frontend, Backend, and Admin Dashboard Developers

**Objective:** Implement a gamified badge system where users unlock badges based on **giving habits**, with a focus on **causes and donation frequency**. Each badge includes **4 visual tiers** (Colour, Bronze, Silver, Gold). Super Admins can add, edit, or remove badges and define the conditions to unlock them.

---

## 🧩 1. Purpose

The badges system rewards users for **how they give**, rather than how much. It encourages consistency and impact-based donation behaviours — such as supporting education, health, or environment causes — and reinforces user engagement through visible progress and tiered goals.

---

## 🧩 2. User-Facing Features

### A. **Badges Overview Page**

- Accessed through the **Donation Dashboard**
- Grid layout of badge cards
- Each badge displays:
  - Icon (tier-specific color/shading)
  - Badge title (e.g. "Badge no. 01", "Round-Up Rebel")
  - Unlock condition (e.g. "Donate 5 times in a month to unlock Silver")
  - Progress indicator (e.g. 3/5)

---

### B. **Badge Detail Modal**

- Shows:
  - Large badge icon and title
  - Current tier (Colour, Bronze, Silver, or Gold)
  - Progress tracker (visual steps showing tier progress)
  - Description (e.g. "You've turned small change into real change — literally.")
  - Unlock CTA (e.g. “Donate Now” to keep earning progress)
  - Recent donation history (organisation, amount, time)

---

### C. **Tier Structure**

Each badge progresses through **4 tiers**:

| Tier   | Description                                         |
| ------ | --------------------------------------------------- |
| Colour | Base unlock (e.g. 1 donation)                       |
| Bronze | Next level (e.g. 3 donations)                       |
| Silver | Advanced tier (e.g. 5 donations/month)              |
| Gold   | Final tier (e.g. 10 donations or cause consistency) |

- Unlock conditions are defined per badge.
- Tier icons must update visually as user progresses.

---

## 🧩 3. Badge Logic & Conditions

Each badge is linked to **one or more of the following criteria**:

- Number of donations to a specific **cause category** (Education, Health, Emergency Relief, etc.)
- Number of donations to a **specific organisation**
- Frequency (e.g. 5+ donations within a calendar month)
- Behaviour (e.g. use of Round-Up for 30 consecutive days)

Badges update dynamically based on user activity, and show real-time progress.

---

## 🧩 4. Super Admin Controls

Accessible from the **Super Admin Dashboard**:

| Control                   | Function                                                      |
| ------------------------- | ------------------------------------------------------------- |
| **Create Badge**          | Add badge name, icon, tier thresholds, category/cause tied to |
| **Edit Badge**            | Modify logic, icon, tier milestones                           |
| **Delete Badge**          | Archive or fully remove badge                                 |
| **Manually Assign Badge** | Give badge to specific users (for campaigns, partnerships)    |
| **Set Tier Requirements** | Define donation count or condition per tier                   |
| **Toggle Visibility**     | Show/hide badge in Donor App                                  |

---

## 🧩 5. Backend Requirements

### A. **Badge Model**

| Field               | Description                                  |
| ------------------- | -------------------------------------------- |
| `badge_id`          | Unique identifier                            |
| `name`              | Title shown to users                         |
| `description`       | Description / motivation                     |
| `category`          | Cause or tag the badge is tied to            |
| `tiers`             | Colour, Bronze, Silver, Gold                 |
| `unlock_conditions` | Tiered rules (e.g. 3, 5, 10 donations, etc.) |
| `is_active`         | Controls visibility in the app               |

### B. **User Badge Progress Model**

| Field            | Description                             |
| ---------------- | --------------------------------------- |
| `user_id`        | The user earning the badge              |
| `badge_id`       | The badge being tracked                 |
| `current_tier`   | Colour, Bronze, Silver, or Gold         |
| `progress_count` | Donations completed toward next tier    |
| `last_updated`   | Timestamp of last donation toward badge |

---

## 🧩 6. UX Behaviours

| User Action                  | App Response                                        |
| ---------------------------- | --------------------------------------------------- |
| View badge list              | Show progress and current tier                      |
| Tap a badge                  | Open full details modal                             |
| Donate to relevant org/cause | Progress updates instantly                          |
| Unlock tier                  | Show animation or celebration popup                 |
| Tap “Donate Now” in badge    | Navigate to donation flow pre-filled with org/cause |

---

## 🧩 7. APIs Required

- `GET /badges/user` → User's current badge list and progress
- `GET /badges/:id` → Badge details and tier progress
- `POST /admin/badges` → Create new badge (admin only)
- `PATCH /admin/badges/:id` → Update logic, icon, tiers
- `DELETE /admin/badges/:id` → Remove badge
- `POST /admin/badges/:id/assign` → Manually assign badge to user

---

## 🧩 8. Testing Requirements

- Unlock all tiers per badge via simulated donations
- Confirm tier upgrade visuals (icon changes, progress bar)
- Verify Super Admin badge creation/edit/delete flows
- Test edge cases: expired badges, rollback, manual assignment
- Validate badge filtering by cause and user behaviour

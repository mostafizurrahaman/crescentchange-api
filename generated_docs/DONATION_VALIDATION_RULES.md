# Donation Flow - Client Clarifications & Validation Rules

**Document Version:** 1.0  
**Last Updated:** November 13, 2025  
**Status:** Approved by Client

---

## Overview

This document contains the official client clarifications regarding custom input behaviors, validation rules, and UI specifications for the donation flows in the Crescent Change platform.

---

## 1. One-Time Donation - Custom Amount

### Client Confirmation

**Question:** Should the "Custom" option open a numeric input field where users can enter any amount (with decimal support)? Is there a defined minimum or maximum amount limit?

**Client Answer:** Yes and decimal support

### Implementation Specifications

| Property | Value |
|----------|-------|
| **UI Behavior** | Opens numeric input field |
| **Decimal Support** | ✅ Yes (e.g., $10.50, $25.75) |
| **Minimum Limit** | $0.01 (or project's defined minimum) |
| **Maximum Limit** | None |
| **Input Type** | Decimal number |

### Validation Rules

```typescript
// Validation Schema
customAmount: z.number()
  .min(0.01, 'Minimum amount is $0.01')
  .positive('Amount must be positive')
```

### UI Specifications

- **Input Field:** Numeric input with decimal support
- **Placeholder:** "Enter amount (e.g., 10.50)"
- **Format:** Currency format with 2 decimal places
- **Error Messages:**
  - "Please enter an amount of at least $0.01"
  - "Please enter a valid number"

---

## 2. Round-Up - Custom Threshold Amount (Per Month)

### Client Confirmation

**Question:** Should a numeric input field appear for users to set their own monthly cap? Are decimal values allowed? Is there any enforced minimum limit?

**Client Answer:** 
- Minimum $3 no max
- NO decimals are allowed
- $3 Minimum round up

### Implementation Specifications

| Property | Value |
|----------|-------|
| **UI Behavior** | Opens numeric input field |
| **Decimal Support** | ❌ No (integers only) |
| **Minimum Limit** | $3 |
| **Maximum Limit** | None |
| **Input Type** | Integer only |

### Validation Rules

```typescript
// Validation Schema
thresholdAmount: z.number()
  .int('Threshold must be a whole number')
  .min(3, 'Minimum threshold is $3')
```

### UI Specifications

- **Input Field:** Numeric input (integer only)
- **Placeholder:** "Enter amount (minimum $3)"
- **Format:** Whole numbers only (e.g., 3, 10, 25)
- **Error Messages:**
  - "Minimum threshold is $3"
  - "Please enter a whole number (no decimals)"
  - "Please enter a valid number"

### Available Threshold Options

Preset buttons: **$10**, **$20**, **$25**, **$40**, **$50**, **Custom**, **NON**

---

## 3. Recurring Donation - Custom Frequency

### Client Confirmation

**Question:** Should this launch an advanced scheduler allowing users to define custom intervals? Will users also be able to set custom start and end dates?

**Client Answer:** 
- YES (advanced scheduler)
- No custom start and end date

### Implementation Specifications

| Property | Value |
|----------|-------|
| **UI Behavior** | Advanced scheduler with custom intervals |
| **Custom Start Date** | ❌ No (uses current date) |
| **Custom End Date** | ❌ No (runs indefinitely until manually stopped) |
| **Interval Options** | Days, Weeks, Months |

### Available Frequencies

- **Preset:** Daily, Weekly, Monthly, Quarterly, Yearly
- **Custom:** User-defined intervals

### Custom Frequency Structure

```typescript
{
  frequency: 'custom',
  customInterval: {
    value: number,      // e.g., 2, 3, 10
    unit: 'days' | 'weeks' | 'months'
  }
}
```

### Examples

- Every 10 days
- Every 2 weeks
- Every 3 months
- Bi-monthly (every 2 months)

### Validation Rules

```typescript
// Validation Schema
frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'])

customInterval: z.object({
  value: z.number().int().min(1, 'Interval must be at least 1'),
  unit: z.enum(['days', 'weeks', 'months'])
}).optional()  // Required only when frequency = 'custom'
```

### UI Specifications

- **Frequency Selector:** Dropdown or button group
- **Custom Interval Input:** 
  - Number input (integer)
  - Unit dropdown (days/weeks/months)
- **Example Display:** "Every [2] [weeks]"
- **Start Date:** Auto-set to current date (not user-editable)
- **End Date:** No end date option (runs indefinitely)

---

## 4. Round-Up - "NON" (No Threshold) Option

### Client Confirmation

**Question:** Does selecting NON remove any monthly cap, meaning the full accumulated round-up amount (unlimited) will be donated each month? Will users receive a clear confirmation or warning indicating that no upper limit will be enforced?

**Client Answer:** 
- Yes (removes cap, unlimited donation)
- NO WARNING

### Implementation Specifications

| Property | Value |
|----------|-------|
| **Behavior** | Removes monthly cap entirely |
| **Effect** | Full accumulated round-up amount donated (unlimited) |
| **User Warning** | ❌ No confirmation or warning modal required |
| **Database Value** | `thresholdAmount: null` or `threshold: 'none'` |

### UI Specifications

- **Button Label:** "NON" or "No Limit"
- **Display When Selected:** "No monthly cap - full amount will be donated"
- **Style:** Same as other threshold buttons
- **No Modal:** Direct selection without confirmation

### Validation Rules

```typescript
// Validation Schema
thresholdAmount: z.number()
  .int('Threshold must be a whole number')
  .min(3, 'Minimum threshold is $3')
  .nullable()  // Allow null for "NON" option
  .optional()
```

### Database Storage

```typescript
// When "NON" is selected
{
  thresholdAmount: null,  // or undefined
  // OR
  threshold: 'none'
}

// When custom/preset amount is selected
{
  thresholdAmount: 25  // Actual amount
}
```

---

## Summary Table - Validation Rules

| Feature | Decimal Support | Minimum | Maximum | Input Type |
|---------|----------------|---------|---------|------------|
| **One-Time Donation - Custom** | ✅ Yes | $0.01 | None | Decimal |
| **Round-Up Threshold - Custom** | ❌ No | $3 | None | Integer |
| **Round-Up Threshold - NON** | N/A | N/A | N/A | Null |
| **Recurring - Custom Frequency** | N/A | 1 unit | None | Integer (interval) |

---

## Implementation Checklist

### Backend Validation

- [ ] Update one-time donation validation (decimal, min $0.01)
- [ ] Update round-up threshold validation (integer, min $3, nullable)
- [ ] Add custom frequency interval validation
- [ ] Handle `thresholdAmount: null` for "NON" option

### Frontend UI

- [ ] One-time custom amount input (decimal support)
- [ ] Round-up custom threshold input (integer only, min $3)
- [ ] Round-up "NON" button (no warning modal)
- [ ] Recurring custom frequency scheduler (no start/end dates)

### Database Schema

- [ ] Ensure `amount` field supports decimals (one-time)
- [ ] Ensure `thresholdAmount` supports integers and null (round-up)
- [ ] Add `customInterval` structure for recurring donations
- [ ] Update indexes if needed

### API Documentation

- [ ] Update API docs with new validation rules
- [ ] Add examples for custom inputs
- [ ] Document "NON" option behavior

---

## Client Communication Reference

### Original Question (from Developer)

> Dear Raiyan,
> 
> I hope you are doing well. While reviewing the donation flow, I came across a few points that would benefit from clarification to ensure the user experience and behavior align precisely with your expectations. Could you please confirm the following details?
> 
> 1. "Custom" Option Behavior
> 2. "NON" Option in Round-Up Threshold

### Client Response

> 1. 
>    A. Yes and decimal support 
>    B. Minimum $3 no max
> 2. 
>    A. Yes, 
>    B. No decimals are allowed
>    C. $3 Minimum round up
> 3. 
>    A. YES
>    B. no custom start and end date
> 4.  
>    a. yes
>    B. NO WARNING

---

## Related Documentation

- [Donation Implementation Complete](./DONATION_IMPLEMENTATION_COMPLETE.md)
- [Payment Flow Guide](./PAYMENT_FLOW_GUIDE.md)
- [ScheduledDonation Module](./src/app/modules/ScheduledDonation/)
- [Donation API Specification](./donation-api.yml)

---

**Document Status:** Approved  
**Next Steps:** Implement validation rules and update UI components  
**Questions:** Contact development team or refer back to client

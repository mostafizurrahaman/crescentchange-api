## Manual check list (from 0)

Do these **in order**. Empty DB + `npm run dev` first.

---

### A. Setup (once)

1. Drop DB / wipe all collections  
2. Start API: `npm run dev`  
3. Confirm admin seeded (login with `ADMIN_EMAIL` / `ADMIN_PASSWORD`)  
4. Confirm app boots with no crash on currency imports  

---

### B. Organization + currency

5. Register/create **Org A** with country `US` (or United States)  
6. In DB → org has `defaultCurrency: "USD"`  
7. Register/create **Org B** with country `AU` (or Australia)  
8. In DB → org has `defaultCurrency: "AUD"`  
9. Edit Org A country → `CA` → DB updates to `defaultCurrency: "CAD"`  
10. Edit country back to `US` → back to `USD`  

---

### C. Stripe Connect

11. Org A (US) start Connect onboarding → Stripe account country should be **US**  
12. Complete onboarding → `chargesEnabled: true`  
13. Org B (AU) start Connect → Stripe account country should be **AU**  
14. Complete AU onboarding  

---

### D. One-time donation (USD org)

15. Create client + payment method  
16. Donate to Org A (e.g. amount `100`, coverFees on/off once each)  
17. DB donation check:
    - `currency: "USD"`
    - `amount` = base donation  
    - `amountBase` ≈ same as `amount`  
    - `exchangeRate: 1`  
    - `baseCurrency: "USD"`  
    - `pointsEarned` ≈ `amountBase * 100`  
18. Stripe PaymentIntent currency = **usd**  
19. Receipt/email shows `$` (not wrong A$)  

---

### E. One-time donation (AUD org)

20. Donate to Org B (amount `100`)  
21. DB donation check:
    - `currency: "AUD"`
    - `amount: 100`  
    - `amountBase` ≈ USD converted (not 100 unless rate≈1)  
    - `exchangeRate` ≠ 1 (usually)  
22. Stripe PaymentIntent currency = **aud**  
23. Receipt shows `A$`  
24. Points based on `amountBase`, not raw AUD 100  

---

### F. Analytics / dashboards (base currency)

25. Admin total donated → should be sum of **`amountBase`** (USD), not raw AUD+USD mixed  
26. Org A dashboard → its donations in base  
27. Org B dashboard → its donations in base  
28. Client donation stats → totals look like USD-base totals  
29. Cause totals → same rule  
30. Sanity: `OrgA amountBase + OrgB amountBase` ≈ admin grand total  

---

### G. Recurring

31. Create scheduled donation on Org A → schedule `currency: USD`  
32. Create scheduled on Org B → schedule `currency: AUD`  
33. Trigger/execute one run (or wait for job)  
34. Created donation has correct `currency` + `amountBase` filled  

---

### H. Round-up (if you use it)

35. Connect bank for a client (Plaid US / Basiq AU as applicable)  
36. Generate round-up → accumulate  
37. Trigger round-up donation  
38. Donation `currency` matches org; `amountBase` present  
39. Month-end job (if testing) completes without session/transaction errors  

---

### I. Badges / points

40. After USD + AUD donations, badge progress increases by **USD base**, not raw foreign amount  
41. Points ledger / balance matches `amountBase * 100` logic  

---

### J. Retry / fail path

42. Force a failed payment (bad card / decline)  
43. Retry → still uses org currency + refreshes base fields  
44. No leftover `currency: USD` hardcode on an AU org  

---

### K. Currency change edge case (important)

45. Take Org A with **active** Connect (US)  
46. Change country to AU → `defaultCurrency` becomes AUD  
47. Try a new donation → note result:
    - App may charge AUD  
    - Stripe may fail or behave oddly (Connect still US)  
48. Confirm old donations still show old currency/base unchanged  

*(Expected: history OK, future risky — lock currency after Connect in production.)*

---

### L. Final smoke

49. PDF receipt download for USD + AUD donations  
50. Email receipt for both  
51. No server 500s in logs during the above  

---

## Pass criteria

- New donations always have `amountBase` + `exchangeRate`  
- Dashboards never look like `100 AUD + 100 USD = 200`  
- Stripe charge currency matches org `defaultCurrency`  
- Receipts show correct symbol  

If you want, after you finish a section I can help you interpret DB screenshots / API responses for that step.
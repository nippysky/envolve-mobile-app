# EnvolveCare Plus — mobile testing guide

The app is a native client over the existing Next.js API. There is no second
backend: every screen calls `evolve-pharma`, and role scoping is enforced
server-side.

```bash
npx expo install          # sync native modules to the SDK
npx expo start            # dev server
npx expo run:ios          # or run:android for a native build
```

`EXPO_PUBLIC_API_URL` in `.env.local` points at the API. It defaults to
production, so set it to your local Next.js server if you're testing against a
dev database.

---

## Accounts you'll need

| Role | Where to get one |
|---|---|
| Customer | Sign up in-app, then approve it from the console |
| Admin | Seeded, or promoted from an existing staff record |
| Staff | Added by an admin from **More → Team** |
| Driver | Added by an admin from **More → Team**, with a vehicle plate |

> A driver added **without** a plate has no driver record and can't be assigned
> deliveries. The Team screen flags those rows as "Not assignable" — that's a
> real state, not a bug.

---

## Flows worth testing in order

### 1. Public browsing (no account)

- Open the app without signing in → catalogue loads.
- Tap a product → full detail, price, stock.
- Tap "Sign in to order" → auth.

**Watch for:** everything should be visible. Only the *transaction* is gated.

### 2. Customer sign-up → approval

1. Sign up (4 steps, PCN certificate upload at the end).
2. The account lands as `REGISTERED` and **cannot order yet**.
3. Sign in as admin → **Customers → Awaiting review** → open → view the PCN
   certificate → Approve.
4. Back on the customer: ordering unlocks.

**Watch for:** rejecting requires a reason. That reason is emailed verbatim.

### 3. Customer order → payment → delivery

1. Add products to the basket (note the minimum-order stepper).
2. Checkout → Paystack.
3. **The order does not exist until payment verifies.** Cancel the payment
   sheet — no order should appear.
4. Complete payment → order is created and confirmed.
5. Console → **Orders** → advance status → a delivery appears.
6. **Deliveries** → assign a driver → the driver sees it under **Today**.

### 4. Driver run

1. Sign in as the assigned driver → **Today**.
2. Open the run → Directions and Call work from the card and the detail.
3. Advance: Start run → Out for delivery → Complete.
4. **On an unpaid order, completing asks whether cash was collected.**
   - "Yes" marks the *order* PAID and writes an audit entry in the driver's name.
   - "No" leaves it unpaid and the delivery still completes.

**This is the most important thing to test.** There is no default and no
shortcut — verify both branches behave differently in the console afterwards.

### 5. On-behalf ordering (the client's headline feature)

Console → **Orders → +**, or the Overview quick action.

1. Pick an **approved** pharmacy (only those appear).
2. Add products.
3. Address prefills from their account — confirm it's editable.
4. Payment: pick **"Already collected"**, choose cash/POS/transfer, enter a
   real reference.
5. Place the order.

**Watch for:**
- The order shows a "Placed for you by…" banner on the customer's side.
- The audit trail names the rep, the method and the reference.
- On an order the *customer* placed themselves, the manual "Record payment"
  action is **absent** — those settle via the Paystack webhook only.

### 6. Referrals

1. Customer A copies their code from **Account → Referrals**.
2. Customer B signs up with it.
3. A's balance increases by the signup bonus immediately, and B appears under
   "Pharmacies you referred". B sees A under "Who referred you".
4. Balance history shows the credit with a running balance.

**Redemption is off by default.** To test it:

- Console → **Settings → Referrals** → enable spending, set a minimum.
- Customer checkout now offers "Use your referral credit".
- Applying it shows as a discount line and reduces the amount charged.

**Watch for:** the balance is **naira**, not points. Every movement appears in
the ledger. Credit can never exceed the order subtotal.

---

## Things that are deliberate, not bugs

| Behaviour | Why |
|---|---|
| Filled icons only change on iOS | `expo-symbols` `type` prop is iOS-only. Android compensates with stroke weight. |
| Staff see products but can't edit | The API is ADMIN-only for product writes. |
| Staff have no Settings or Audit tab | Admin-only; hidden rather than disabled. |
| A rejected customer can still browse | Browsing is public. Only ordering is gated. |
| Draft products with no price can't be activated | Server guard — a ₦0 product can't be sold. |
| Forgot-password always says "sent" | Deliberate: stops the endpoint being used to enumerate registered emails. |

---

## Known limits

- **Bulk product upload is web-only**, by agreement. Quick-add and single-product
  creation are in the app.
- **Staff and driver profiles are read-only in-app.** There's no self-service
  endpoint for internal roles; changes go through an admin.
- The driver run screen reads from the scoped delivery list rather than a
  single-record endpoint, because `GET /api/deliveries/:id` doesn't exist. It
  pages until it finds the run.

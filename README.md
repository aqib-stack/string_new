# StringGlobe MVP

This build follows the client brief exactly: OTP-only auth, lean Firestore schema, player scan flow, stringer queue/inspection, Stripe Connect destination charges, $0.35 platform fee, Twilio SMS hooks, PWA shell, and offline-ready stringer portal.

## Included
- Next.js mobile-first PWA frontend
- Firebase Phone Auth + Firestore + Storage integration
- Player scan flow via `/scan/[tagId]`
- Stringer onboarding and queue dashboard
- Inspection workflow with required toggles + photo upload
- Stripe payment page using Payment Element for Apple Pay / Google Pay support
- Firebase Cloud Functions for SMS + payment webhook + restring counter
- Manual withdraw entry point that triggers Stripe Connect onboarding only when Withdraw is clicked

## MVP flow covered
1. Player scans a tag
2. New player logs in with OTP
3. Player adds string type + tension
4. Job created in Firestore
5. Stringer sees queue, performs inspection, uploads one photo
6. Damage can trigger alert flow and block clean finish
7. Player pays through Stripe
8. Webhook marks job PAID
9. Racquet restring counter increments
10. Shop wallet balance increases and stringer can withdraw

## Setup
1. Copy `.env.example` to `.env.local`
2. Fill Firebase, Stripe, and Twilio keys
3. Install frontend deps:
   ```bash
   npm install
   ```
4. Install functions deps:
   ```bash
   cd functions && npm install
   ```
5. Run locally:
   ```bash
   npm run dev
   ```
6. Deploy functions + hosting after configuring Firebase project

## Important implementation notes
- Firestore offline persistence is enabled for the web app.
- Auth persistence is LOCAL.
- The service worker is intentionally simple for MVP reliability.
- Stripe Connect onboarding is deferred until Withdraw.
- The current code uses a demo fallback shop `demo-shop-1` for first testing; replace with live shop selection once the first real shop is provisioned.
- To fully support Stripe webhooks on Firebase Hosting, point the Stripe webhook endpoint to the deployed `paymentWebhookHandler` function URL.

## Recommended first live test
- Create one player with real phone OTP
- Create one stringer/shop
- Connect Stripe Express on Withdraw
- Run a live $1 payment
- Confirm webhook updates job, wallet, and restring count

## Shared shop MVP note
Stringer and player flows both use the shared shop configured by `NEXT_PUBLIC_SHARED_SHOP_ID`.
Existing stringer users are migrated to that shared shop on sign-in.

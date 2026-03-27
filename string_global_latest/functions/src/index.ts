import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Stripe from 'stripe';
import twilio from 'twilio';

admin.initializeApp();
const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSMS(to: string, body: string) {
  if (!to || !process.env.TWILIO_MESSAGING_SERVICE_SID) return;
  await twilioClient.messages.create({
    to,
    body,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  });
}

export const sendSmsNotification = functions.https.onCall(async (data) => {
  await sendSMS(data.phone, data.message);
  return { ok: true };
});

export const damageAlert = functions.firestore.document('jobs/{jobId}').onUpdate(async (change) => {
  const before = change.before.data();
  const after = change.after.data();
  if (before.damage_confirmed === after.damage_confirmed) return;
  if (after.damage_confirmed !== false) return;

  const userSnap = await db.collection('users').doc(after.owner_uid).get();
  const phone = userSnap.data()?.phone;
  await sendSMS(phone, `StringGlobe: damage flagged on job ${change.after.id}. Please confirm before completion.`);
});

export const jobCompleteSMS = functions.firestore.document('jobs/{jobId}').onUpdate(async (change) => {
  const before = change.before.data();
  const after = change.after.data();
  if (before.status === after.status || after.status !== 'FINISHED') return;
  const userSnap = await db.collection('users').doc(after.owner_uid).get();
  const phone = userSnap.data()?.phone;
  await sendSMS(phone, `StringGlobe: your racquet is finished. Payment is now ready before pickup.`);
});

export const incrementRestringCounter = functions.firestore.document('jobs/{jobId}').onUpdate(async (change) => {
  const before = change.before.data();
  const after = change.after.data();
  if (before.status === after.status || after.status !== 'PAID') return;
  const racquetRef = db.collection('racquets').doc(after.racquet_id);
  await db.runTransaction(async (tx) => {
    const racquetSnap = await tx.get(racquetRef);
    const restringCount = (racquetSnap.data()?.restring_count || 0) + 1;
    tx.set(racquetRef, {
      restring_count: restringCount,
      last_string_date: new Date().toISOString(),
    }, { merge: true });
  });
});

export const paymentWebhookHandler = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig as string, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'unknown'}`);
    return;
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const jobId = intent.metadata.jobId;
    if (jobId) {
      const jobRef = db.collection('jobs').doc(jobId);
      const jobSnap = await jobRef.get();
      const job = jobSnap.data();
      await jobRef.set({ status: 'PAID', payment_intent_id: intent.id }, { merge: true });
      if (job?.shop_id) {
        const shopRef = db.collection('shops').doc(job.shop_id);
        await db.runTransaction(async (tx) => {
          const shopSnap = await tx.get(shopRef);
          const walletBalance = (shopSnap.data()?.wallet_balance || 0) + ((intent.amount_received || 0) / 100) - 0.35;
          tx.set(shopRef, { wallet_balance: walletBalance }, { merge: true });
        });
      }
    }
  }

  res.json({ received: true });
});

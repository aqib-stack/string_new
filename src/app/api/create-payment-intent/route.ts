import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  const jobSnap = await adminDb.collection('jobs').doc(jobId).get();
  if (!jobSnap.exists) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  const job = jobSnap.data()!;
  const shopSnap = await adminDb.collection('shops').doc(job.shop_id).get();
  const shop = shopSnap.data()!;

  if (!shop.stripe_account_id) {
    return NextResponse.json({ error: 'Stringer has not connected Stripe yet' }, { status: 400 });
  }

  const amount = Math.round(((job.amount_total || shop.labor_rate || 30) as number) * 100);
  const platformFee = 35;

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    application_fee_amount: platformFee,
    transfer_data: {
      destination: shop.stripe_account_id,
    },
    metadata: { jobId, shopId: job.shop_id, racquetId: job.racquet_id },
  });

  await adminDb.collection('jobs').doc(jobId).set({ payment_intent_id: intent.id }, { merge: true });
  return NextResponse.json({ clientSecret: intent.client_secret });
}

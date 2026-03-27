import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { adminDb } from '@/lib/admin';

export async function POST() {
  const stripe = getStripe();
  const demoStringerUid = 'demo-stringer';
  const userSnap = await adminDb.collection('users').doc(demoStringerUid).get();
  const user = userSnap.data();
  const shopId = user?.shop_id || 'demo-shop-1';
  const shopSnap = await adminDb.collection('shops').doc(shopId).get();
  const shop = shopSnap.data();

  let accountId = shop?.stripe_account_id as string | undefined;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
    accountId = account.id;
    await adminDb.collection('shops').doc(shopId).set({ stripe_account_id: accountId }, { merge: true });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL || `${process.env.NEXT_PUBLIC_APP_URL}/stringer`,
    return_url: process.env.STRIPE_CONNECT_RETURN_URL || `${process.env.NEXT_PUBLIC_APP_URL}/stringer`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url });
}

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/admin';
import { SHARED_SHOP_ID } from '@/lib/appConstants';

async function getRequestUid(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const requestUid = await getRequestUid(req);
    const fallbackUid = process.env.DEFAULT_STRINGER_UID || null;
    const stringerUid = requestUid || fallbackUid;

    if (!stringerUid) {
      return NextResponse.json({ error: 'Stringer authentication is required before opening payout onboarding.' }, { status: 401 });
    }

    const userSnap = await adminDb.collection('users').doc(stringerUid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Stringer profile was not found in Firestore.' }, { status: 404 });
    }

    const user = userSnap.data();
    const shopId = user?.shop_id || SHARED_SHOP_ID;
    const shopRef = adminDb.collection('shops').doc(shopId);
    const shopSnap = await shopRef.get();
    const shop = shopSnap.data() || {};

    let accountId = shop?.stripe_account_id as string | undefined;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;
      await shopRef.set({
        shop_id: shopId,
        owner_uid: stringerUid,
        name: shop?.name || `${String(user?.name || 'Stringer').split(' ')[0]} Tennis Lab`,
        labor_rate: Number(shop?.labor_rate || 30),
        wallet_balance: Number(shop?.wallet_balance || 0),
        stripe_account_id: accountId,
      }, { merge: true });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL || `${baseUrl}/stringer`,
      return_url: process.env.STRIPE_CONNECT_RETURN_URL || `${baseUrl}/stringer`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error('Withdraw onboarding failed', error);
    return NextResponse.json({ error: 'Unable to start payout onboarding right now.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth, adminDb } from '@/lib/admin';
import { SHARED_SHOP_ID, SHARED_SHOP_NAME } from '@/lib/appConstants';
import type { AppUser, UserRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function slugFromEmail(email: string) {
  return email.split('@')[0].replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'user';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    const code = String(body.code || '').trim();
    const name = String(body.name || '').trim();
    const role = (body.role || 'PLAYER') as UserRole;
    const mode = body.mode === 'signin' ? 'signin' : 'signup';

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and verification code are required.' }, { status: 400 });
    }

    const docId = Buffer.from(`${email}:${role}`).toString('base64url');
    const codeRef = adminDb.collection('email_codes').doc(docId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) {
      return NextResponse.json({ error: 'No active verification code was found. Please request a new code.' }, { status: 404 });
    }

    const record = codeSnap.data()!;
    if (Date.now() > Number(record.expires_at || 0)) {
      await codeRef.delete();
      return NextResponse.json({ error: 'That verification code has expired. Please request a new one.' }, { status: 400 });
    }

    if (hashCode(code) !== record.code_hash) {
      await codeRef.set({ attempts: Number(record.attempts || 0) + 1 }, { merge: true });
      return NextResponse.json({ error: 'The verification code is not correct.' }, { status: 400 });
    }

    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUserByEmail(email);
    } catch {
      firebaseUser = await adminAuth.createUser({ email, emailVerified: true, displayName: name || record.name || slugFromEmail(email) });
    }

    const userRef = adminDb.collection('users').doc(firebaseUser.uid);
    const userSnap = await userRef.get();

    let appUser: AppUser;
    if (!userSnap.exists) {
      appUser = {
        uid: firebaseUser.uid,
        name: name || record.name || firebaseUser.displayName || slugFromEmail(email),
        phone: '',
        user_role: role,
        shop_id: role === 'STRINGER' ? SHARED_SHOP_ID : null,
      };
      await userRef.set({
        ...appUser,
        email,
        created_at: Date.now(),
      });
    } else {
      const existing = userSnap.data() as AppUser & { email?: string };
      appUser = {
        uid: firebaseUser.uid,
        name: existing.name || firebaseUser.displayName || slugFromEmail(email),
        phone: existing.phone || '',
        user_role: existing.user_role || role,
        shop_id: existing.shop_id ?? (existing.user_role === 'STRINGER' ? SHARED_SHOP_ID : null),
      };
      if (mode === 'signup') {
        await userRef.set({
          ...existing,
          name: appUser.name,
          email,
          user_role: appUser.user_role,
          shop_id: appUser.shop_id,
        }, { merge: true });
      }
    }

    if (appUser.user_role === 'STRINGER' && appUser.shop_id) {
      const shopRef = adminDb.collection('shops').doc(appUser.shop_id);
      const shopSnap = await shopRef.get();
      if (!shopSnap.exists) {
        await shopRef.set({
          shop_id: appUser.shop_id,
          name: SHARED_SHOP_NAME,
          labor_rate: 30,
          owner_uid: appUser.uid,
          wallet_balance: 0,
        });
      }
    }

    await codeRef.delete();

    const token = await adminAuth.createCustomToken(firebaseUser.uid);
    return NextResponse.json({ ok: true, token, user: appUser });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to verify code.' }, { status: 500 });
  }
}

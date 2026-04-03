'use client';

import { auth, db } from './firebase';
import type { AppUser, UserRole } from '@/types';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { DEFAULT_LABOR_RATE } from './appConstants';

function slugifyShopName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function buildShopId(user: { uid: string; name?: string }) {
  const base = slugifyShopName(user.name || 'pro-shop') || 'pro-shop';
  return `shop-${base}-${user.uid.slice(0, 8)}`;
}

function buildShopName(user: { name?: string }) {
  const clean = (user.name || '').trim();
  return clean ? `${clean}'s Pro Shop` : 'My Pro Shop';
}

async function ensureStringerShop(user: AppUser) {
  if (user.user_role !== 'STRINGER') return user;

  const existingUserSnap = await getDoc(doc(db, 'users', user.uid));
  const existingUser = existingUserSnap.exists() ? (existingUserSnap.data() as Partial<AppUser>) : null;

  const shopId = existingUser?.shop_id || user.shop_id || buildShopId(user);
  const shopName = buildShopName(user);

  const shopPayload: Record<string, any> = {
    shop_id: shopId,
    name: shopName,
    owner_uid: user.uid,
    labor_rate: DEFAULT_LABOR_RATE,
    updated_at_server: serverTimestamp(),
  };

  if (existingUser?.shop_id !== shopId) {
    shopPayload.wallet_balance = 0;
    shopPayload.created_at_server = serverTimestamp();
  }

  await setDoc(doc(db, 'shops', shopId), shopPayload, { merge: true });

  await setDoc(
    doc(db, 'users', user.uid),
    {
      shop_id: shopId,
      name: user.name,
      updated_at_server: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ...user,
    shop_id: shopId,
  };
}

export async function signUpWithPassword(payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();

  const cred = await createUserWithEmailAndPassword(auth, email, payload.password);

  let appUser: AppUser = {
    uid: cred.user.uid,
    user_role: payload.role,
    name,
    phone: '',
    shop_id: payload.role === 'STRINGER' ? buildShopId({ uid: cred.user.uid, name }) : null,
  };

  await setDoc(
    doc(db, 'users', cred.user.uid),
    {
      ...appUser,
      email,
      created_at_server: serverTimestamp(),
      updated_at_server: serverTimestamp(),
    },
    { merge: true }
  );

  if (payload.role === 'STRINGER') {
    appUser = await ensureStringerShop(appUser);
  }

  return appUser;
}

export async function signInWithPassword(payload: {
  email: string;
  password: string;
  role: UserRole;
}) {
  const email = payload.email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, email, payload.password);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));

  if (!snap.exists()) {
    throw new Error('Your user profile is missing in Firestore.');
  }

  const raw = snap.data() as AppUser & { user_role: UserRole };

  if (raw.user_role !== payload.role) {
    throw new Error(`This account is set up as a ${raw.user_role.toLowerCase()}. Switch roles to continue.`);
  }

  let data: AppUser = {
    ...raw,
    shop_id: raw.user_role === 'STRINGER' ? raw.shop_id || buildShopId(raw) : raw.shop_id || null,
  };

  if (data.user_role === 'STRINGER') {
    data = await ensureStringerShop(data);
  }

  return data;
}

export async function logoutUser() {
  await signOut(auth);
}

export function getSessionUser(): AppUser | null {
  return null;
}
'use client';

import { auth, db } from './firebase';
import type { AppUser, UserRole } from '@/types';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { SHARED_SHOP_ID, SHARED_SHOP_NAME, DEFAULT_LABOR_RATE } from './appConstants';

async function ensureStringerShop(user: AppUser) {
  if (user.user_role !== 'STRINGER') return;

  const shopId = SHARED_SHOP_ID;
  await setDoc(doc(db, 'shops', shopId), {
    shop_id: shopId,
    name: SHARED_SHOP_NAME,
    owner_uid: user.uid,
    labor_rate: DEFAULT_LABOR_RATE,
    wallet_balance: 0,
    created_at_server: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(db, 'users', user.uid), {
    shop_id: shopId,
  }, { merge: true });
}

export async function signUpWithPassword(payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const email = payload.email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, email, payload.password);

  const appUser: AppUser = {
    uid: cred.user.uid,
    user_role: payload.role,
    name: payload.name.trim(),
    phone: '',
    shop_id: payload.role === 'STRINGER' ? SHARED_SHOP_ID : null,
  };

  await setDoc(doc(db, 'users', cred.user.uid), {
    ...appUser,
    email,
    created_at_server: serverTimestamp(),
  }, { merge: true });

  await ensureStringerShop(appUser);
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

  const data: AppUser = {
    ...raw,
    shop_id: raw.user_role === 'STRINGER' ? SHARED_SHOP_ID : raw.shop_id || null,
  };

  if (raw.user_role === 'STRINGER') {
    await setDoc(doc(db, 'users', cred.user.uid), { shop_id: SHARED_SHOP_ID }, { merge: true });
    await ensureStringerShop(data);
  }

  return data;
}

export async function logoutUser() {
  await signOut(auth);
}

export function getSessionUser(): AppUser | null {
  return null;
}

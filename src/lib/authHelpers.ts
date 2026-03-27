'use client';

import type { AppUser, UserRole } from '@/types';
import { ensureDemoShop, seedDemoUser } from './demoData';
import { hydrateSharedDemoState, resetSharedDemoState, syncSharedDemoKey } from './sharedDemoSync';
import { AUTH_SESSION_KEY, AUTH_USERS_BACKUP_KEY, AUTH_USERS_KEY, SHARED_SHOP_ID, SHARED_SHOP_NAME } from './appConstants';

type StoredAuthUser = AppUser & {
  email: string;
  password: string;
};

function canUseStorage() {
  return typeof window !== 'undefined';
}

function readUsers(): StoredAuthUser[] {
  if (!canUseStorage()) return [];
  try {
    const primary = window.localStorage.getItem(AUTH_USERS_KEY);
    const backup = window.localStorage.getItem(AUTH_USERS_BACKUP_KEY);
    const raw = primary || backup || '[]';
    return JSON.parse(raw) as StoredAuthUser[];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredAuthUser[]) {
  if (!canUseStorage()) return;
  const serialized = JSON.stringify(users);
  window.localStorage.setItem(AUTH_USERS_KEY, serialized);
  window.localStorage.setItem(AUTH_USERS_BACKUP_KEY, serialized);
  void syncSharedDemoKey(AUTH_USERS_KEY, users);
}

function setSession(user: AppUser) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

export function getSessionUser(): AppUser | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function signUpWithPassword(payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  await hydrateSharedDemoState();
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim() || email.split('@')[0] || 'StringGlobe User';
  const users = readUsers();
  const existing = users.find((user) => user.email === email);
  if (existing) {
    throw new Error('An account with that email already exists. Please sign in instead.');
  }

  const appUser: AppUser = {
    uid: uid(payload.role === 'PLAYER' ? 'player' : 'stringer'),
    user_role: payload.role,
    name,
    phone: '',
    shop_id: payload.role === 'STRINGER' ? SHARED_SHOP_ID : null,
  };

  const storedUser: StoredAuthUser = {
    ...appUser,
    email,
    password: payload.password,
  };

  writeUsers([storedUser, ...users]);
  seedDemoUser(appUser);
  if (appUser.user_role === 'STRINGER' && appUser.shop_id) {
    ensureDemoShop({
      shop_id: appUser.shop_id,
      name: SHARED_SHOP_NAME,
      labor_rate: 30,
      owner_uid: appUser.uid,
      wallet_balance: 0,
    });
  }
  setSession(appUser);
  return appUser;
}

export async function signInWithPassword(payload: {
  email: string;
  password: string;
  role: UserRole;
}) {
  await hydrateSharedDemoState();
  const email = payload.email.trim().toLowerCase();
  const user = readUsers().find((entry) => entry.email === email);
  if (!user) {
    throw new Error('No account was found for that email. Create an account first.');
  }
  if (user.password !== payload.password) {
    throw new Error('The password you entered is incorrect.');
  }
  if (user.user_role !== payload.role) {
    throw new Error(`This account is set up as a ${user.user_role.toLowerCase()}. Switch roles to continue.`);
  }

  const normalizedShopId = user.user_role === 'STRINGER' ? SHARED_SHOP_ID : user.shop_id;

  const appUser: AppUser = {
    uid: user.uid,
    user_role: user.user_role,
    name: user.name,
    phone: user.phone,
    shop_id: normalizedShopId,
  };

  if (user.user_role === 'STRINGER' && user.shop_id !== SHARED_SHOP_ID) {
    writeUsers(
      readUsers().map((entry) =>
        entry.email === email
          ? { ...entry, shop_id: SHARED_SHOP_ID }
          : entry,
      ),
    );
  }

  seedDemoUser(appUser);
  if (appUser.user_role === 'STRINGER' && appUser.shop_id) {
    ensureDemoShop({
      shop_id: appUser.shop_id,
      name: SHARED_SHOP_NAME,
      labor_rate: 30,
      owner_uid: appUser.uid,
      wallet_balance: 0,
    });
  }
  setSession(appUser);
  return appUser;
}

export async function logoutUser() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

export async function resetAuthUsers() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AUTH_USERS_KEY);
  window.localStorage.removeItem(AUTH_USERS_BACKUP_KEY);
  void resetSharedDemoState();
}

'use client';

import { useEffect, useState } from 'react';
import type { AppUser } from '@/types';

export const DEMO_USER_KEY = 'stringglobe_user';

export const DEMO_PLAYER: AppUser = {
  uid: 'demo-player',
  name: 'Demo Player',
  phone: '+10000000000',
  user_role: 'PLAYER',
  shop_id: null,
};

export const DEMO_STRINGER: AppUser = {
  uid: 'demo-stringer',
  name: 'Demo Stringer',
  phone: '+10000000001',
  user_role: 'STRINGER',
  shop_id: 'demo-shop-1',
};

export function getDemoUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DEMO_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function setDemoUser(user: AppUser) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
}

export function loginAsDemoPlayer() {
  setDemoUser(DEMO_PLAYER);
}

export function loginAsDemoStringer() {
  setDemoUser(DEMO_STRINGER);
}

export function clearDemoUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEMO_USER_KEY);
}

export function useDemoUser() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    setUser(getDemoUser());
  }, []);

  return user;
}

'use client';

import { AUTH_USERS_BACKUP_KEY, AUTH_USERS_KEY } from './appConstants';

export const SHARED_DEMO_KEYS = {
  authUsers: AUTH_USERS_KEY,
  demoShops: 'stringglobe_demo_shops',
  demoRacquets: 'stringglobe_demo_racquets',
  demoJobs: 'stringglobe_demo_jobs',
  demoAlerts: 'stringglobe_demo_alerts',
} as const;

const ALL_SHARED_KEYS = [
  SHARED_DEMO_KEYS.authUsers,
  SHARED_DEMO_KEYS.demoShops,
  SHARED_DEMO_KEYS.demoRacquets,
  SHARED_DEMO_KEYS.demoJobs,
  SHARED_DEMO_KEYS.demoAlerts,
] as const;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function hydrateSharedDemoState() {
  if (!canUseStorage()) return;
  try {
    const res = await fetch('/api/demo-state', { cache: 'no-store' });
    if (!res.ok) return;
    const payload = (await res.json()) as { state?: Record<string, unknown> };
    const state = payload.state || {};

    ALL_SHARED_KEYS.forEach((key) => {
      const value = state[key];
      if (typeof value === 'undefined') return;
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
      if (key === AUTH_USERS_KEY) {
        window.localStorage.setItem(AUTH_USERS_BACKUP_KEY, serialized);
      }
    });

    window.dispatchEvent(new CustomEvent('stringglobe:shared-sync'));
  } catch {
    // Ignore sync errors in demo mode.
  }
}

export async function syncSharedDemoKey(key: string, value: unknown) {
  if (!canUseStorage()) return;
  try {
    await fetch('/api/demo-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: clone(value) }),
      cache: 'no-store',
    });
  } catch {
    // Ignore sync errors in demo mode.
  }
}

export async function resetSharedDemoState() {
  if (!canUseStorage()) return;
  try {
    await fetch('/api/demo-state', {
      method: 'DELETE',
      cache: 'no-store',
    });
  } catch {
    // Ignore reset errors in demo mode.
  }
}

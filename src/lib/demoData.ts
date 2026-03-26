'use client';

import type { AppUser, Job, JobStatus, Racquet, Shop } from '@/types';

const KEYS = {
  users: 'stringglobe_demo_users',
  shops: 'stringglobe_demo_shops',
  racquets: 'stringglobe_demo_racquets',
  jobs: 'stringglobe_demo_jobs',
  alerts: 'stringglobe_demo_alerts',
};

function canUseStorage() {
  return typeof window !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatJobCode(jobId: string) {
  const short = jobId.replace(/^job-/, '').slice(-6).toUpperCase();
  return `#${short}`;
}

export function clearDemoData() {
  if (!canUseStorage()) return;
  Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
  window.sessionStorage.removeItem('stringglobe_pending_scan');
}

export function seedDemoUser(user: AppUser) {
  const users = readJson<AppUser[]>(KEYS.users, []);
  const next = [...users.filter((u) => u.uid !== user.uid), user];
  writeJson(KEYS.users, next);

  if (user.user_role === 'STRINGER' && user.shop_id) {
    ensureDemoShop({
      shop_id: user.shop_id,
      name: 'Demo Tennis Lab',
      labor_rate: 30,
      owner_uid: user.uid,
      wallet_balance: 0,
    });
  }
}

export function ensureDemoShop(shop: Shop) {
  const shops = readJson<Shop[]>(KEYS.shops, []);
  const current = shops.find((s) => s.shop_id === shop.shop_id);
  const next = [
    ...shops.filter((s) => s.shop_id !== shop.shop_id),
    {
      ...shop,
      wallet_balance: current?.wallet_balance ?? shop.wallet_balance,
      stripe_account_id: current?.stripe_account_id ?? shop.stripe_account_id,
    },
  ];
  writeJson(KEYS.shops, next);
}

export function getShop(shopId: string) {
  return readJson<Shop[]>(KEYS.shops, []).find((shop) => shop.shop_id === shopId) || null;
}

export function updateShop(shopId: string, patch: Partial<Shop>) {
  const shops = readJson<Shop[]>(KEYS.shops, []);
  const current = shops.find((shop) => shop.shop_id === shopId);
  if (!current) return null;
  const nextShop = { ...current, ...patch };
  writeJson(
    KEYS.shops,
    shops.map((shop) => (shop.shop_id === shopId ? nextShop : shop))
  );
  return nextShop;
}

export function getRacquetById(racquetId: string) {
  return readJson<Racquet[]>(KEYS.racquets, []).find((racquet) => racquet.racquet_id === racquetId) || null;
}

export function getRacquetByTagOwner(tagId: string, ownerUid: string) {
  return (
    readJson<Racquet[]>(KEYS.racquets, []).find(
      (racquet) => racquet.tag_id === tagId && racquet.owner_uid === ownerUid
    ) || null
  );
}

export function listRacquetsByOwner(ownerUid: string) {
  return readJson<Racquet[]>(KEYS.racquets, []).filter((racquet) => racquet.owner_uid === ownerUid);
}

export function saveRacquet(racquet: Racquet & { owner_name?: string | null }) {
  const racquets = readJson<any[]>(KEYS.racquets, []);
  const next = [...racquets.filter((item) => item.racquet_id !== racquet.racquet_id), racquet];
  writeJson(KEYS.racquets, next);
  return racquet;
}

export function updateRacquet(racquetId: string, patch: Partial<Racquet & { owner_name?: string | null }>) {
  const current = getRacquetById(racquetId) as (Racquet & { owner_name?: string | null }) | null;
  if (!current) return null;
  return saveRacquet({ ...current, ...patch });
}

export function createRacquet(input: {
  owner_uid: string;
  owner_name?: string;
  tag_id: string;
  string_type: string;
  tension: string;
}) {
  const racquet: Racquet & { owner_name?: string } = {
    racquet_id: uid('racquet'),
    owner_uid: input.owner_uid,
    owner_name: input.owner_name,
    tag_id: input.tag_id,
    restring_count: 0,
    last_string_date: '',
    string_type: input.string_type,
    tension: input.tension,
  };
  return saveRacquet(racquet);
}

export function listJobsByOwner(ownerUid: string) {
  return readJson<Job[]>(KEYS.jobs, []).filter((job) => job.owner_uid === ownerUid);
}

export function listJobsByShop(shopId: string) {
  return readJson<Job[]>(KEYS.jobs, []).filter((job) => job.shop_id === shopId);
}

export function listJobsByRacquet(racquetId: string) {
  return readJson<Job[]>(KEYS.jobs, []).filter((job) => job.racquet_id === racquetId);
}

export function getLatestJobForRacquet(racquetId: string) {
  return listJobsByRacquet(racquetId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] || null;
}

export function getOpenJobForRacquet(racquetId: string) {
  return listJobsByRacquet(racquetId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .find((job) => ['RECEIVED', 'IN_PROGRESS', 'FINISHED'].includes(job.status)) || null;
}

export function getJob(jobId: string) {
  return readJson<Job[]>(KEYS.jobs, []).find((job) => job.job_id === jobId) || null;
}

export function createJob(input: {
  racquet_id: string;
  owner_uid: string;
  owner_name: string;
  shop_id: string;
  amount_total: number;
  status?: JobStatus;
}) {
  const existingOpen = getOpenJobForRacquet(input.racquet_id);
  if (existingOpen) {
    return existingOpen;
  }

  const job: Job = {
    job_id: uid('job'),
    racquet_id: input.racquet_id,
    owner_uid: input.owner_uid,
    owner_name: input.owner_name,
    shop_id: input.shop_id,
    status: input.status || 'RECEIVED',
    created_at: new Date().toISOString(),
    amount_total: input.amount_total,
    payment_intent_id: '',
    damage_confirmed: true,
  };
  const jobs = readJson<Job[]>(KEYS.jobs, []);
  writeJson(KEYS.jobs, [job, ...jobs]);
  return job;
}

export function updateJob(jobId: string, patch: Partial<Job>) {
  const jobs = readJson<Job[]>(KEYS.jobs, []);
  let nextJob: Job | null = null;
  const next = jobs.map((job) => {
    if (job.job_id !== jobId) return job;
    nextJob = { ...job, ...patch };
    return nextJob;
  });
  writeJson(KEYS.jobs, next);
  return nextJob;
}

export function addAlert(payload: Record<string, unknown>) {
  const alerts = readJson<any[]>(KEYS.alerts, []);
  writeJson(KEYS.alerts, [{ id: uid('alert'), ...payload }, ...alerts]);
}

export function getStringerNetForJob(job: Pick<Job, 'amount_total'>) {
  return Math.max(0, Number(job.amount_total || 0) - 0.35);
}

export function markJobPaid(jobId: string) {
  const job = getJob(jobId);
  if (!job || job.status === 'PAID') return job;
  const net = getStringerNetForJob(job);
  const shop = getShop(job.shop_id);
  if (shop) {
    updateShop(job.shop_id, {
      wallet_balance: Number(shop.wallet_balance || 0) + net,
    });
  }

  const racquet = getRacquetById(job.racquet_id);
  if (racquet) {
    updateRacquet(job.racquet_id, {
      restring_count: Number(racquet.restring_count || 0) + 1,
      last_string_date: new Date().toISOString(),
    });
  }

  return updateJob(jobId, { status: 'PAID' });
}

export function getPendingPayoutTotal(shopId: string) {
  return listJobsByShop(shopId)
    .filter((job) => job.status === 'PAID')
    .reduce((sum, job) => sum + getStringerNetForJob(job), 0);
}

export function completeJobForPayment(jobId: string) {
  return updateJob(jobId, { status: 'FINISHED' });
}

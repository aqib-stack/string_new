'use client';

import { db } from './firebase';
import {
  DEFAULT_LABOR_RATE,
  SHARED_SHOP_ID,
  SHARED_SHOP_NAME,
} from './appConstants';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

type AnyRecord = Record<string, any>;

export function formatJobCode(jobId: string) {
  return String(jobId || 'job').slice(0, 10).toUpperCase();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toMillis(value: any): number {
  if (!value) return 0;

  if (typeof value === 'string') {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }

  return 0;
}

function sortByNewest<T extends AnyRecord>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = toMillis(a.created_at) || toMillis(a.created_at_server) || toMillis(a.updated_at_server);
    const bTime = toMillis(b.created_at) || toMillis(b.created_at_server) || toMillis(b.updated_at_server);
    return bTime - aTime;
  });
}

function normalizeStatus(status?: string) {
  const value = String(status || 'REQUESTED').toUpperCase();

  if (value === 'INPROGRESS') return 'IN_PROGRESS';
  if (value === 'ON_MACHINE') return 'IN_PROGRESS';
  if (value === 'INSPECTION_SAVED') return 'FINISHED';
  if (value === 'COMPLETED') return 'FINISHED';

  return value;
}

function normalizeJob(job: AnyRecord) {
  return {
    ...job,
    status: normalizeStatus(job.status),
  };
}

function normalizeAlert(alert: AnyRecord) {
  return {
    ...alert,
    read: Boolean(alert.read),
  };
}

export async function listRacquetsByOwner(ownerUid: string) {
  const snap = await getDocs(
    query(collection(db, 'racquets'), where('owner_uid', '==', ownerUid))
  );

  return sortByNewest(
    snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))
  );
}

export async function listJobsByOwner(ownerUid: string) {
  const snap = await getDocs(
    query(collection(db, 'jobs'), where('owner_uid', '==', ownerUid))
  );

  return sortByNewest(
    snap.docs.map((d) =>
      normalizeJob({
        id: d.id,
        ...d.data(),
      })
    )
  );
}

export async function listJobsByShop(shopId: string) {
  const snap = await getDocs(
    query(collection(db, 'jobs'), where('shop_id', '==', shopId))
  );

  return sortByNewest(
    snap.docs.map((d) =>
      normalizeJob({
        id: d.id,
        ...d.data(),
      })
    )
  );
}

export async function listAlerts(shopId?: string) {
  let qRef;

  if (shopId) {
    qRef = query(collection(db, 'alerts'), where('shop_id', '==', shopId));
  } else {
    qRef = query(collection(db, 'alerts'));
  }

  const snap = await getDocs(qRef);

  return sortByNewest(
    snap.docs.map((d) =>
      normalizeAlert({
        id: d.id,
        ...d.data(),
      })
    )
  );
}

export async function getJob(jobId: string) {
  const snap = await getDoc(doc(db, 'jobs', jobId));
  return snap.exists() ? normalizeJob({ id: snap.id, ...snap.data() }) : null;
}

export async function getRacquetById(racquetId: string) {
  const snap = await getDoc(doc(db, 'racquets', racquetId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getRacquetByTag(tagId: string) {
  const snap = await getDocs(
    query(collection(db, 'racquets'), where('tag_id', '==', tagId), limit(1))
  );
  return snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
}

export async function getRacquetByTagOwner(tagId: string, ownerUid: string) {
  const snap = await getDocs(
    query(
      collection(db, 'racquets'),
      where('tag_id', '==', tagId),
      where('owner_uid', '==', ownerUid),
      limit(1)
    )
  );

  return snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
}

export async function getLatestJobForRacquet(racquetId: string) {
  const snap = await getDocs(
    query(collection(db, 'jobs'), where('racquet_id', '==', racquetId))
  );

  const jobs = sortByNewest(
    snap.docs.map((d) =>
      normalizeJob({
        id: d.id,
        ...d.data(),
      })
    )
  );

  return jobs[0] || null;
}

export async function getOpenJobForRacquet(racquetId: string) {
  const latest = await getLatestJobForRacquet(racquetId);
  if (!latest) return null;

  const closedStatuses = ['PAID', 'PICKED_UP'];
  return closedStatuses.includes(normalizeStatus(latest.status)) ? null : latest;
}

export async function createRacquet(payload: AnyRecord) {
  const racquet_id = payload.racquet_id || uid('racquet');

  const docData = {
    racquet_id,
    owner_uid: payload.owner_uid,
    owner_name: payload.owner_name || 'Player',
    tag_id: payload.tag_id,
    restring_count: payload.restring_count || 0,
    last_string_date: payload.last_string_date || '',
    string_type: payload.string_type || 'Poly Tour Pro',
    tension: payload.tension || '52 lbs',
    created_at: payload.created_at || new Date().toISOString(),
    created_at_server: serverTimestamp(),
  };

  await setDoc(doc(db, 'racquets', racquet_id), docData, { merge: true });
  return docData;
}

export async function saveRacquet(payload: AnyRecord) {
  return createRacquet(payload);
}

export async function updateRacquet(racquetId: string, data: AnyRecord) {
  await setDoc(
    doc(db, 'racquets', racquetId),
    {
      ...data,
      updated_at: new Date().toISOString(),
      updated_at_server: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createJob(payload: AnyRecord) {
  const job_id = payload.job_id || uid('job');

  const docData = {
    job_id,
    racquet_id: payload.racquet_id,
    shop_id: payload.shop_id || SHARED_SHOP_ID,
    status: normalizeStatus(payload.status || 'REQUESTED'),
    owner_uid: payload.owner_uid,
    owner_name: payload.owner_name || 'Player',
    amount_total: payload.amount_total ?? DEFAULT_LABOR_RATE,
    created_at: payload.created_at || new Date().toISOString(),
    created_at_server: serverTimestamp(),
    updated_at: new Date().toISOString(),
    updated_at_server: serverTimestamp(),
    payment_intent_id: payload.payment_intent_id || '',
    damage_confirmed: payload.damage_confirmed ?? true,
    request_source: payload.request_source || 'PLAYER_PORTAL',
    payout_released: payload.payout_released || false,
    ...payload,
  };

  docData.shop_id = payload.shop_id || SHARED_SHOP_ID;
  docData.status = normalizeStatus(docData.status);

  await setDoc(doc(db, 'jobs', job_id), docData, { merge: true });
  return docData;
}

export async function updateJob(jobId: string, data: AnyRecord) {
  const patch: AnyRecord = {
    ...data,
    updated_at: new Date().toISOString(),
    updated_at_server: serverTimestamp(),
  };

  if (patch.status) {
    patch.status = normalizeStatus(patch.status);
  }

  await setDoc(doc(db, 'jobs', jobId), patch, { merge: true });
}

export async function confirmDropOff(jobId: string) {
  await updateJob(jobId, { status: 'RECEIVED' });
}

export async function startRestring(jobId: string) {
  await updateJob(jobId, { status: 'IN_PROGRESS' });
}

export async function saveInspection(jobId: string, inspection: AnyRecord = {}) {
  const nextStatus = inspection.status ? normalizeStatus(inspection.status) : 'FINISHED';

  await updateJob(jobId, {
    ...inspection,
    status: nextStatus,
    inspection_saved_at: new Date().toISOString(),
  });
}

export async function markJobPaid(jobId: string) {
  const job = await getJob(jobId);
  if (!job) return;

  await updateJob(jobId, { status: 'PAID' });

  const shop = await getShop(job.shop_id);
  const current = Number(shop?.wallet_balance || 0);

  await setDoc(
    doc(db, 'shops', job.shop_id),
    {
      wallet_balance: current + getStringerNetForJob(job),
      updated_at_server: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getShop(shopId: string) {
  const snap = await getDoc(doc(db, 'shops', shopId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateShop(shopId: string, data: AnyRecord) {
  await setDoc(
    doc(db, 'shops', shopId),
    {
      ...data,
      updated_at_server: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function ensureShop(payload?: Partial<AnyRecord>) {
  const shopId = payload?.shop_id || SHARED_SHOP_ID;
  const existing = await getShop(shopId);
  if (existing) return existing;

  const shopData = {
    shop_id: shopId,
    name: payload?.name || SHARED_SHOP_NAME,
    labor_rate: Number(payload?.labor_rate ?? DEFAULT_LABOR_RATE),
    owner_uid: payload?.owner_uid || '',
    wallet_balance: Number(payload?.wallet_balance ?? 0),
    created_at_server: serverTimestamp(),
    ...payload,
  };

  await setDoc(doc(db, 'shops', shopId), shopData, { merge: true });
  return shopData;
}

export async function ensurePlayerVisibleShop(shopId?: string) {
  return ensureShop({
    shop_id: shopId || SHARED_SHOP_ID,
    name: SHARED_SHOP_NAME,
    labor_rate: DEFAULT_LABOR_RATE,
  });
}

export async function addAlert(payload: AnyRecord) {
  const id = uid('alert');

  await setDoc(
    doc(db, 'alerts', id),
    {
      id,
      read: false,
      created_at: new Date().toISOString(),
      created_at_server: serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );

  return id;
}

export async function markAlertsReadForJob(jobId: string) {
  const snap = await getDocs(
    query(collection(db, 'alerts'), where('job_id', '==', jobId))
  );

  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(d.ref, {
        read: true,
        read_at: new Date().toISOString(),
      })
    )
  );
}

export function getStringerNetForJob(job: AnyRecord) {
  return Math.max(0, Number(job?.amount_total || DEFAULT_LABOR_RATE) - 0.35);
}

export async function getPendingPayoutTotal(shopId: string) {
  const jobs = await listJobsByShop(shopId);

  return jobs
    .filter((job: AnyRecord) => job.status === 'PAID' && !job.payout_released)
    .reduce((sum: number, job: AnyRecord) => sum + getStringerNetForJob(job), 0);
}
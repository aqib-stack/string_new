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
  type FieldValue,
} from 'firebase/firestore';

type TimestampLike =
  | string
  | number
  | Date
  | { seconds: number; nanoseconds?: number }
  | { toMillis: () => number }
  | { toDate: () => Date }
  | FieldValue
  | null
  | undefined;

export type JobStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'AWAITING_PLAYER'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'PAID'
  | 'PICKED_UP'
  | 'CANCELLED';

export interface RacquetRecord {
  id?: string;
  racquet_id: string;
  owner_uid: string;
  owner_name: string;
  tag_id: string;
  racquet_name?: string;
  racquet_model?: string;
  preferred_shop_id?: string;
  preferred_shop_name?: string;
  preferred_shop_business_name?: string;
  restring_count: number;
  last_string_date: string;
  string_type: string;
  tension: string;
  is_hybrid?: boolean;
  hybrid_setup?: {
    mains_string?: string;
    mains_tension?: string;
    crosses_string?: string;
    crosses_tension?: string;
  };
  created_at?: string;
  created_at_server?: TimestampLike;
  updated_at?: string;
  updated_at_server?: TimestampLike;
  [key: string]: any;
}

export interface JobRecord {
  id?: string;
  job_id: string;
  racquet_id: string;
  shop_id: string;
  status: JobStatus;
  owner_uid: string;
  owner_name: string;
  amount_total: number;
  created_at?: string;
  created_at_server?: TimestampLike;
  updated_at?: string;
  updated_at_server?: TimestampLike;
  payment_intent_id?: string;
  damage_confirmed?: boolean;
  request_source?: string;
  payout_released?: boolean;
  inspection_saved_at?: string;
  pickup_confirmed?: boolean;
  picked_up_at?: string;
  paid_outside_app?: boolean;
  proof_photo_url?: string;
  inspection_note?: string;
  inspection_completed?: boolean;
  labor_cost?: number;
  string_cost?: number;
  customer_provided_string?: boolean;
  payment_requested_at?: string;

  requested_at?: string;
  dropped_off_at?: string;
  started_at?: string;
  finished_at?: string;
  paid_at?: string;

  flagged_issue?: 'FRAME' | 'GROMMETS' | '';
  flagged_issues?: string[];
  flagged_photo_urls?: string[];
  awaiting_player_response?: boolean;
  approved_to_continue?: boolean;
  approved_at?: string;
  cancelled_at?: string;
  cancelled_by?: 'PLAYER' | 'STRINGER' | '';
  cancel_reason?: string;
  player_feedback?: 'TOO_TIGHT' | 'PERFECT' | 'TOO_LOOSE' | '';
  player_feedback_at?: string;
  pickup_reminder_sent_at?: string;

  [key: string]: any;
}

export interface AlertRecord {
  id: string;
  read: boolean;
  created_at?: string;
  created_at_server?: TimestampLike;
  read_at?: string;
  job_id?: string;
  shop_id?: string;
  owner_uid?: string;
  owner_name?: string;
  racquet_id?: string;
  tag_id?: string;
  type?: string;
  note?: string;
  [key: string]: any;
}

export interface ShopRecord {
  id?: string;
  shop_id: string;
  name: string;
  city?: string;
  labor_rate: number;
  owner_uid: string;
  wallet_balance: number;
  created_at_server?: TimestampLike;
  updated_at_server?: TimestampLike;
  [key: string]: any;
}

type AnyRecord = Record<string, any>;

export function formatJobCode(jobId: string) {
  return String(jobId || 'job').slice(0, 10).toUpperCase();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function toMillis(value: TimestampLike): number {
  if (!value) return 0;

  if (typeof value === 'string' || typeof value === 'number') {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  if (typeof value === 'object' && value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }

  return 0;
}

function sortByNewest<T extends AnyRecord>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime =
      toMillis(a.created_at as TimestampLike) ||
      toMillis(a.created_at_server as TimestampLike) ||
      toMillis(a.updated_at as TimestampLike) ||
      toMillis(a.updated_at_server as TimestampLike);

    const bTime =
      toMillis(b.created_at as TimestampLike) ||
      toMillis(b.created_at_server as TimestampLike) ||
      toMillis(b.updated_at as TimestampLike) ||
      toMillis(b.updated_at_server as TimestampLike);

    return bTime - aTime;
  });
}

function normalizeStatus(status?: string): JobStatus {
  const value = String(status || 'REQUESTED').toUpperCase();

  if (value === 'INPROGRESS') return 'IN_PROGRESS';
  if (value === 'ON_MACHINE') return 'IN_PROGRESS';
  if (value === 'INSPECTION_SAVED') return 'FINISHED';
  if (value === 'COMPLETED') return 'FINISHED';
  if (value === 'FLAGGED') return 'AWAITING_PLAYER';

  return value as JobStatus;
}

function normalizeJob(job: AnyRecord): JobRecord {
  return {
    ...job,
    status: normalizeStatus(job.status),
    pickup_confirmed: Boolean(job.pickup_confirmed),
    paid_outside_app: Boolean(job.paid_outside_app),
    inspection_completed: Boolean(job.inspection_completed),
  } as JobRecord;
}

function normalizeAlert(alert: AnyRecord): AlertRecord {
  return {
    ...alert,
    id: alert.id,
    read: Boolean(alert.read),
  } as AlertRecord;
}

export async function listRacquetsByOwner(ownerUid: string): Promise<RacquetRecord[]> {
  const snap = await getDocs(query(collection(db, 'racquets'), where('owner_uid', '==', ownerUid)));

  const items: RacquetRecord[] = snap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...(d.data() as Omit<RacquetRecord, 'id'>),
      }) as RacquetRecord
  );

  return sortByNewest(items);
}

export async function listJobsByOwner(ownerUid: string): Promise<JobRecord[]> {
  const snap = await getDocs(query(collection(db, 'jobs'), where('owner_uid', '==', ownerUid)));

  const items: JobRecord[] = snap.docs.map(
    (d) =>
      normalizeJob({
        id: d.id,
        ...(d.data() as Omit<JobRecord, 'id'>),
      }) as JobRecord
  );

  return sortByNewest(items);
}

export async function listJobsByShop(shopId: string): Promise<JobRecord[]> {
  const snap = await getDocs(query(collection(db, 'jobs'), where('shop_id', '==', shopId)));

  const items: JobRecord[] = snap.docs.map(
    (d) =>
      normalizeJob({
        id: d.id,
        ...(d.data() as Omit<JobRecord, 'id'>),
      }) as JobRecord
  );

  return sortByNewest(items);
}

export async function listAlerts(shopId?: string): Promise<AlertRecord[]> {
  const qRef = shopId
    ? query(collection(db, 'alerts'), where('shop_id', '==', shopId))
    : query(collection(db, 'alerts'));

  const snap = await getDocs(qRef);

  const items: AlertRecord[] = snap.docs.map(
    (d) =>
      normalizeAlert({
        id: d.id,
        ...(d.data() as Omit<AlertRecord, 'id'>),
      }) as AlertRecord
  );

  return sortByNewest(items);
}

export async function listAlertsByOwner(ownerUid: string): Promise<AlertRecord[]> {
  const snap = await getDocs(query(collection(db, 'alerts'), where('owner_uid', '==', ownerUid)));

  const items: AlertRecord[] = snap.docs.map(
    (d) =>
      normalizeAlert({
        id: d.id,
        ...(d.data() as Omit<AlertRecord, 'id'>),
      }) as AlertRecord
  );

  return sortByNewest(items);
}

export async function listShops(): Promise<ShopRecord[]> {
  const snap = await getDocs(query(collection(db, 'shops')));
  const items: ShopRecord[] = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<ShopRecord, 'id'>) }) as ShopRecord
  );
  return sortByNewest(items).filter((shop) => shop.shop_id);
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const snap = await getDoc(doc(db, 'jobs', jobId));
  return snap.exists() ? normalizeJob({ id: snap.id, ...(snap.data() as Omit<JobRecord, 'id'>) }) : null;
}

export async function getRacquetById(racquetId: string): Promise<RacquetRecord | null> {
  const snap = await getDoc(doc(db, 'racquets', racquetId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<RacquetRecord, 'id'>) } as RacquetRecord) : null;
}

export async function getRacquetByTag(tagId: string): Promise<RacquetRecord | null> {
  const snap = await getDocs(query(collection(db, 'racquets'), where('tag_id', '==', tagId), limit(1)));

  return snap.docs[0]
    ? ({
        id: snap.docs[0].id,
        ...(snap.docs[0].data() as Omit<RacquetRecord, 'id'>),
      } as RacquetRecord)
    : null;
}

export async function getRacquetByTagOwner(tagId: string, ownerUid: string): Promise<RacquetRecord | null> {
  const snap = await getDocs(
    query(collection(db, 'racquets'), where('tag_id', '==', tagId), where('owner_uid', '==', ownerUid), limit(1))
  );

  return snap.docs[0]
    ? ({
        id: snap.docs[0].id,
        ...(snap.docs[0].data() as Omit<RacquetRecord, 'id'>),
      } as RacquetRecord)
    : null;
}

export async function getLatestJobForRacquet(racquetId: string): Promise<JobRecord | null> {
  const snap = await getDocs(query(collection(db, 'jobs'), where('racquet_id', '==', racquetId)));

  const jobs: JobRecord[] = snap.docs.map(
    (d) =>
      normalizeJob({
        id: d.id,
        ...(d.data() as Omit<JobRecord, 'id'>),
      }) as JobRecord
  );

  const sorted = sortByNewest(jobs);
  return sorted[0] || null;
}

export async function getOpenJobForRacquet(racquetId: string): Promise<JobRecord | null> {
  const latest = await getLatestJobForRacquet(racquetId);
  if (!latest) return null;

  const closedStatuses: JobStatus[] = ['PICKED_UP', 'CANCELLED'];
  return closedStatuses.includes(normalizeStatus(latest.status)) ? null : latest;
}

export async function createRacquet(payload: Partial<RacquetRecord>): Promise<RacquetRecord> {
  const racquet_id = payload.racquet_id || uid('racquet');

  const docData: RacquetRecord = {
    racquet_id,
    owner_uid: payload.owner_uid || '',
    owner_name: payload.owner_name || 'Player',
    tag_id: payload.tag_id || '',
    racquet_name: payload.racquet_name || 'My Racquet',
    racquet_model: payload.racquet_model || '',
    preferred_shop_id: payload.preferred_shop_id || SHARED_SHOP_ID,
    preferred_shop_name: payload.preferred_shop_name || SHARED_SHOP_NAME,
    restring_count: payload.restring_count || 0,
    last_string_date: payload.last_string_date || '',
    string_type: payload.string_type || 'Poly Tour Pro',
    tension: payload.tension || '52 lbs',
    is_hybrid: Boolean(payload.is_hybrid),
    hybrid_setup: payload.hybrid_setup || undefined,
    created_at: payload.created_at || nowIso(),
    created_at_server: serverTimestamp(),
    ...payload,
  } as RacquetRecord;

  await setDoc(doc(db, 'racquets', racquet_id), docData, { merge: true });
  return docData;
}

export async function saveRacquet(payload: Partial<RacquetRecord>) {
  return createRacquet(payload);
}

export async function updateRacquet(racquetId: string, data: Partial<RacquetRecord>) {
  await setDoc(
    doc(db, 'racquets', racquetId),
    {
      ...data,
      updated_at: nowIso(),
      updated_at_server: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function createJob(payload: Partial<JobRecord>): Promise<JobRecord> {
  const job_id = payload.job_id || uid('job');
  const createdAt = payload.created_at || nowIso();
  const normalizedStatus = normalizeStatus(payload.status || 'REQUESTED');

  const docData: JobRecord = {
    job_id,
    racquet_id: payload.racquet_id || '',
    shop_id: payload.shop_id || SHARED_SHOP_ID,
    status: normalizedStatus,
    owner_uid: payload.owner_uid || '',
    owner_name: payload.owner_name || 'Player',
    amount_total: payload.amount_total ?? DEFAULT_LABOR_RATE,
    created_at: createdAt,
    created_at_server: serverTimestamp(),
    updated_at: nowIso(),
    updated_at_server: serverTimestamp(),
    payment_intent_id: payload.payment_intent_id || '',
    damage_confirmed: payload.damage_confirmed ?? true,
    request_source: payload.request_source || 'PLAYER_PORTAL',
    payout_released: payload.payout_released || false,
    pickup_confirmed: payload.pickup_confirmed || false,
    paid_outside_app: payload.paid_outside_app || false,
    proof_photo_url: payload.proof_photo_url || '',
    inspection_note: payload.inspection_note || '',
    inspection_completed: payload.inspection_completed || false,
    labor_cost: payload.labor_cost ?? DEFAULT_LABOR_RATE,
    string_cost: payload.string_cost ?? 0,
    customer_provided_string: payload.customer_provided_string || false,
    payment_requested_at: payload.payment_requested_at || '',
    requested_at: payload.requested_at || createdAt,
    dropped_off_at: payload.dropped_off_at || '',
    started_at: payload.started_at || '',
    finished_at: payload.finished_at || '',
    paid_at: payload.paid_at || '',
    flagged_issue: payload.flagged_issue || '',
    flagged_issues: payload.flagged_issues || [],
    flagged_photo_urls: payload.flagged_photo_urls || [],
    awaiting_player_response: payload.awaiting_player_response || false,
    approved_to_continue: payload.approved_to_continue || false,
    approved_at: payload.approved_at || '',
    cancelled_at: payload.cancelled_at || '',
    cancelled_by: payload.cancelled_by || '',
    cancel_reason: payload.cancel_reason || '',
    player_feedback: payload.player_feedback || '',
    player_feedback_at: payload.player_feedback_at || '',
    pickup_reminder_sent_at: payload.pickup_reminder_sent_at || '',
    ...payload,
  } as JobRecord;

  await setDoc(doc(db, 'jobs', job_id), docData, { merge: true });
  return docData;
}

export async function updateJob(jobId: string, data: Partial<JobRecord> & AnyRecord) {
  const patch: AnyRecord = {
    ...data,
    updated_at: nowIso(),
    updated_at_server: serverTimestamp(),
  };

  if (patch.status) {
    patch.status = normalizeStatus(patch.status);
  }

  await setDoc(doc(db, 'jobs', jobId), patch, { merge: true });
}

export async function confirmDropOff(jobId: string) {
  await updateJob(jobId, {
    status: 'RECEIVED',
    dropped_off_at: nowIso(),
  });
}

export async function approveFlaggedJob(jobId: string) {
  await updateJob(jobId, {
    status: 'RECEIVED',
    awaiting_player_response: false,
    approved_to_continue: true,
    approved_at: nowIso(),
  });
}

export async function cancelJob(jobId: string, cancelledBy: 'PLAYER' | 'STRINGER', reason = '') {
  const job = await getJob(jobId);
  if (!job) return;
  const status = normalizeStatus(job.status);
  if (!['REQUESTED', 'RECEIVED', 'AWAITING_PLAYER'].includes(status)) {
    throw new Error('This job can no longer be cancelled.');
  }

  await updateJob(jobId, {
    status: 'CANCELLED',
    cancelled_at: nowIso(),
    cancelled_by: cancelledBy,
    cancel_reason: reason,
    awaiting_player_response: false,
  });
}

export async function savePlayerFeedback(jobId: string, feedback: 'TOO_TIGHT' | 'PERFECT' | 'TOO_LOOSE') {
  await updateJob(jobId, {
    player_feedback: feedback,
    player_feedback_at: nowIso(),
  });
}

export async function startRestring(jobId: string) {
  await updateJob(jobId, {
    status: 'IN_PROGRESS',
    started_at: nowIso(),
  });
}

export async function saveInspection(jobId: string, inspection: AnyRecord = {}) {
  const nextStatus = inspection.status ? normalizeStatus(inspection.status) : 'RECEIVED';

  await updateJob(jobId, {
    ...inspection,
    status: nextStatus,
    inspection_completed: true,
    inspection_saved_at: nowIso(),
  });
}

export async function markJobPaid(jobId: string) {
  const job = await getJob(jobId);
  if (!job) return;
  if (job.status === 'PAID') return;

  await updateJob(jobId, {
    status: 'PAID',
    paid_at: nowIso(),
  });

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

export async function markJobPaidOutsideApp(jobId: string) {
  const job = await getJob(jobId);
  if (!job) return;
  if (job.status === 'PAID') return;

  await updateJob(jobId, {
    status: 'PAID',
    paid_outside_app: true,
    paid_at: nowIso(),
  });

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

export async function markJobPickedUp(jobId: string) {
  const job = await getJob(jobId);
  if (!job) return;

  await updateJob(jobId, {
    status: 'PICKED_UP',
    pickup_confirmed: true,
    picked_up_at: nowIso(),
  });

  if (job.racquet_id) {
    const racquet = await getRacquetById(job.racquet_id);

    if (racquet) {
      await updateRacquet(job.racquet_id, {
        restring_count: Number(racquet.restring_count || 0) + 1,
        last_string_date: nowIso(),
      });
    }
  }
}

export async function getShop(shopId: string): Promise<ShopRecord | null> {
  const snap = await getDoc(doc(db, 'shops', shopId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<ShopRecord, 'id'>) } as ShopRecord) : null;
}

export async function updateShop(shopId: string, data: Partial<ShopRecord>) {
  await setDoc(
    doc(db, 'shops', shopId),
    {
      ...data,
      updated_at_server: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function ensureShop(payload?: Partial<ShopRecord>): Promise<ShopRecord> {
  const shopId = payload?.shop_id || SHARED_SHOP_ID;
  const existing = await getShop(shopId);
  if (existing) return existing;

  const shopData: ShopRecord = {
    shop_id: shopId,
    name: payload?.name || SHARED_SHOP_NAME,
    city: payload?.city || '',
    labor_rate: Number(payload?.labor_rate ?? DEFAULT_LABOR_RATE),
    owner_uid: payload?.owner_uid || '',
    wallet_balance: Number(payload?.wallet_balance ?? 0),
    created_at_server: serverTimestamp(),
    ...payload,
  } as ShopRecord;

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

export async function addAlert(payload: Partial<AlertRecord>) {
  const id = uid('alert');

  await setDoc(
    doc(db, 'alerts', id),
    {
      id,
      read: false,
      created_at: nowIso(),
      created_at_server: serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );

  return id;
}

export async function markAlertsReadForJob(jobId: string) {
  const snap = await getDocs(query(collection(db, 'alerts'), where('job_id', '==', jobId)));

  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(d.ref, {
        read: true,
        read_at: nowIso(),
      })
    )
  );
}

export async function sendPickupReminderIfNeeded(job: Partial<JobRecord>) {
  if (!job?.job_id || !job?.owner_uid || job.status !== 'PAID' || job.pickup_confirmed) return false;

  const paidAt = toMillis(job.paid_at || job.updated_at || job.created_at);
  if (!paidAt) return false;

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const isDue = Date.now() - paidAt >= twoDaysMs;

  if (!isDue || job.pickup_reminder_sent_at) return false;

  await addAlert({
    type: 'pickup_reminder',
    owner_uid: job.owner_uid,
    job_id: job.job_id,
    shop_id: job.shop_id,
    note: 'Your racquet is still waiting for pickup. If you already picked it up, please confirm pickup.',
    read: false,
  });

  await updateJob(job.job_id, {
    pickup_reminder_sent_at: nowIso(),
  });

  return true;
}

export function getStringerNetForJob(job: Partial<JobRecord>) {
  return Math.max(0, Number(job?.amount_total || DEFAULT_LABOR_RATE) - 0.35);
}

export async function getPendingPayoutTotal(shopId: string) {
  const jobs = await listJobsByShop(shopId);

  return jobs
    .filter((job) => job.status === 'PAID' && !job.payout_released)
    .reduce((sum, job) => sum + getStringerNetForJob(job), 0);
}
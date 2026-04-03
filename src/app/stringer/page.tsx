'use client';

import Link from 'next/link';
import { BellRing, LogOut, ScanLine, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { logoutUser } from '@/lib/authHelpers';
import {
  addAlert,
  confirmDropOff,
  createJob,
  formatJobCode,
  getOpenJobForRacquet,
  getPendingPayoutTotal,
  getRacquetByTag,
  getShop,
  listAlerts,
  listJobsByShop,
  markAlertsReadForJob,
  markJobPaidOutsideApp,
  saveInspection as saveInspectionRecord,
  startRestring,
  updateJob,
  updateShop,
} from '@/lib/firestoreData';
import { useEffect, useMemo, useState } from 'react';
import type { FieldValue } from 'firebase/firestore';

const tabs = ['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID', 'HISTORY'] as const;
const tabLabels: Record<(typeof tabs)[number], string> = {
  REQUESTED: 'Requested',
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  FINISHED: 'Finished',
  PAID: 'Paid / Awaiting pickup',
  HISTORY: 'History',
};

type FirestoreDateValue =
  | string
  | number
  | Date
  | { seconds: number; nanoseconds?: number }
  | { toDate: () => Date }
  | { toMillis: () => number }
  | FieldValue
  | null
  | undefined;

function getTimeValue(value: FirestoreDateValue): number {
  if (!value) return 0;

  if (value instanceof Date) {
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

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

export default function StringerPage() {
  const { user, loading } = useCurrentUser();
  const [jobs, setJobs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('REQUESTED');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [scanTag, setScanTag] = useState('globetag-001');
  const [flagReason, setFlagReason] = useState<'FRAME' | 'GROMMETS' | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopCity, setShopCity] = useState('');

  const shopId = user?.shop_id || '';

  async function refresh() {
    if (!shopId) return;

    const [nextJobs, nextAlerts, shop] = await Promise.all([
      listJobsByShop(shopId),
      listAlerts(shopId),
      getShop(shopId),
    ]);

    setJobs(
      nextJobs.sort((a, b) => {
        const aTime =
          getTimeValue(a.created_at) ||
          getTimeValue(a.created_at_server) ||
          getTimeValue(a.updated_at) ||
          getTimeValue(a.updated_at_server);
        const bTime =
          getTimeValue(b.created_at) ||
          getTimeValue(b.created_at_server) ||
          getTimeValue(b.updated_at) ||
          getTimeValue(b.updated_at_server);
        return bTime - aTime;
      })
    );

    setAlerts(nextAlerts);
    setShopName(String(shop?.name || ''));
    setShopCity(String(shop?.city || shop?.shop_city || ''));
  }

  useEffect(() => {
    if (!user || user.user_role !== 'STRINGER' || !shopId) return;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => {
      window.clearInterval(timer);
    };
  }, [user, shopId]);

  const filtered = useMemo(() => {
    const normalize = (value: unknown) => String(value || '').toUpperCase();
    return jobs.filter((job) => {
      const status = normalize(job.status);
      const pickedUp = Boolean(job.picked_up || job.pickup_confirmed || status === 'PICKED_UP');

      if (activeTab === 'HISTORY') return pickedUp;
      if (activeTab === 'PAID') return status === 'PAID' && !pickedUp;
      return status === activeTab && !pickedUp;
    });
  }, [jobs, activeTab]);

  const [wallet, setWallet] = useState(0);
  const [pendingPayout, setPendingPayout] = useState(0);

  useEffect(() => {
    if (!shopId) return;

    (async () => {
      const shop = await getShop(shopId);
      setWallet(Number(shop?.wallet_balance || 0));
      setPendingPayout(await getPendingPayoutTotal(shopId));
    })();
  }, [jobs, shopId]);

  const stats = useMemo(
    () => ({
      requested: jobs.filter((job) => String(job.status || '').toUpperCase() === 'REQUESTED' && !job.picked_up).length,
      received: jobs.filter((job) => String(job.status || '').toUpperCase() === 'RECEIVED' && !job.picked_up).length,
      inProgress: jobs.filter((job) => String(job.status || '').toUpperCase() === 'IN_PROGRESS' && !job.picked_up).length,
      ready: jobs.filter((job) => String(job.status || '').toUpperCase() === 'FINISHED' && !job.picked_up).length,
      awaitingPickup: jobs.filter((job) => String(job.status || '').toUpperCase() === 'PAID' && !job.picked_up).length,
      history: jobs.filter((job) => Boolean(job.picked_up || job.pickup_confirmed || String(job.status || '').toUpperCase() === 'PICKED_UP')).length,
    }),
    [jobs]
  );

  const tabCounts: Record<(typeof tabs)[number], number> = {
    REQUESTED: stats.requested,
    RECEIVED: stats.received,
    IN_PROGRESS: stats.inProgress,
    FINISHED: stats.ready,
    PAID: stats.awaitingPickup,
    HISTORY: stats.history,
  };

  async function handleLogout() {
    await logoutUser();
    window.location.href = '/';
  }

  async function confirmDropoff(jobId: string) {
    await confirmDropOff(jobId);
    await markAlertsReadForJob(jobId);
    setMessage(`Drop-off confirmed for ${formatJobCode(jobId)}.`);
    setActiveTab('RECEIVED');
    await refresh();
  }

  async function markInProgress(jobId: string) {
    await startRestring(jobId);
    await markAlertsReadForJob(jobId);
    setMessage(`Job ${formatJobCode(jobId)} moved into the active restring queue.`);
    setActiveTab('IN_PROGRESS');
    await refresh();
  }

  async function flagRacquet() {
    if (!selectedJob || !flagReason) return;

    await saveInspectionRecord(selectedJob.job_id, {
      inspection_log: {
        frame: flagReason !== 'FRAME',
        grommets: flagReason !== 'GROMMETS',
        grip: true,
        photo_url: file ? file.name : '',
      },
      inspection_note:
        flagReason === 'FRAME'
          ? 'Frame is in bad condition. Please contact your stringer.'
          : 'Grommets are in bad condition. Please contact your stringer.',
      flagged_issue: flagReason,
      damage_confirmed: false,
      status: 'RECEIVED',
    });

    await addAlert({
      type: 'racquet_flagged',
      owner_uid: selectedJob.owner_uid,
      owner_name: selectedJob.owner_name,
      shop_id: selectedJob.shop_id,
      job_id: selectedJob.job_id,
      racquet_id: selectedJob.racquet_id,
      note:
        flagReason === 'FRAME'
          ? 'Frame is in bad condition. Please contact your stringer.'
          : 'Grommets are in bad condition. Please contact your stringer.',
      read: false,
    });

    setMessage(`Racquet flagged for ${formatJobCode(selectedJob.job_id)}.`);
    setSelectedJob(null);
    setFlagReason('');
    setFile(null);
    setActiveTab('RECEIVED');
    await refresh();
  }

  async function passAndBeginStringing() {
    if (!selectedJob) return;

    await saveInspectionRecord(selectedJob.job_id, {
      inspection_log: {
        frame: true,
        grommets: true,
        grip: true,
        photo_url: file ? file.name : '',
      },
      inspection_note: '',
      flagged_issue: '',
      damage_confirmed: true,
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
    });

    setMessage(`Inspection passed for ${formatJobCode(selectedJob.job_id)}. Stringing started.`);
    setSelectedJob(null);
    setFlagReason('');
    setFile(null);
    setActiveTab('IN_PROGRESS');
    await refresh();
  }

  async function markFinished(jobId: string) {
    await updateJob(jobId, {
      status: 'FINISHED',
      finished_at: new Date().toISOString(),
    });
    setMessage(`Job ${formatJobCode(jobId)} marked as finished and ready for payment.`);
    setActiveTab('FINISHED');
    await refresh();
  }

  async function markPaidOutsideApp(jobId: string) {
    await markJobPaidOutsideApp(jobId);
    setMessage(`Job ${formatJobCode(jobId)} marked as paid outside the app.`);
    setActiveTab('PAID');
    await refresh();
  }

  async function saveShopProfile() {
    if (!shopId) return;

    await updateShop(shopId, {
      name: shopName,
      city: shopCity,
      shop_city: shopCity,
    } as any);
    setMessage('Shop profile updated successfully.');
    await refresh();
  }

  async function scanDropoff() {
    const trimmed = scanTag.trim();
    if (!trimmed || !shopId) return;

    const racquet = (await getRacquetByTag(trimmed)) as any;
    if (!racquet) {
      setMessage('No racquet with that GlobeTag is linked to a player bag yet. Ask the player to scan it first.');
      return;
    }

    const existingOpenJob = await getOpenJobForRacquet(racquet.racquet_id);

    if (existingOpenJob) {
      if (existingOpenJob.status === 'REQUESTED') {
        setMessage(`GlobeTag ${racquet.tag_id} scanned. Now confirm drop-off to move the job into received.`);
        setActiveTab('REQUESTED');
        await refresh();
        return;
      }

      setMessage(
        `An active job already exists for ${racquet.tag_id}: ${formatJobCode(existingOpenJob.job_id)} (${existingOpenJob.status}).`
      );
      setActiveTab(existingOpenJob.status === 'PAID' ? 'PAID' : (existingOpenJob.status as (typeof tabs)[number]));
      await refresh();
      return;
    }

    const job = await createJob({
      racquet_id: racquet.racquet_id,
      owner_uid: racquet.owner_uid,
      owner_name: racquet.owner_name || 'Player',
      shop_id: shopId,
      amount_total: 30,
      status: 'RECEIVED',
      request_source: 'STRINGER_SCAN',
      racquet_name: racquet.racquet_name || racquet.name || '',
      racquet_model: racquet.racquet_model || racquet.model || '',
      preferred_shop_name: racquet.preferred_shop_name || shopName || '',
      dropped_off_at: new Date().toISOString(),
    });

    await addAlert({
      type: 'stringer_scan',
      job_id: job.job_id,
      shop_id: shopId,
      racquet_id: racquet.racquet_id,
      tag_id: racquet.tag_id,
      owner_name: racquet.owner_name || 'Player',
      created_at: new Date().toISOString(),
      read: true,
    });

    setMessage(`Drop-off scan recorded for ${racquet.tag_id}. The player can now see this job in their portal.`);
    setActiveTab('RECEIVED');
    await refresh();
  }

  async function withdraw() {
    if (!wallet || !shopId) {
      setMessage('No funds available yet. Paid jobs move into the wallet automatically.');
      return;
    }
    const paidJobs = jobs.filter((job) => job.status === 'PAID' && !job.payout_released);
    await Promise.all(paidJobs.map((job) => updateJob(job.job_id, { payout_released: true })));
    await updateShop(shopId, { wallet_balance: 0 });
    setMessage(`Payout initiated for $${wallet.toFixed(2)}.`);
    await refresh();
  }

  if (loading) return <main className="container"><div className="card">Loading queue…</div></main>;
  if (!user) {
    return (
      <main className="container">
        <div className="card grid">
          <h1 className="h2">Stringer access</h1>
          <p className="p">Sign in to manage requests, drop-offs, inspections, and payouts.</p>
          <Link className="btn" href="/auth?mode=signin&role=STRINGER">Sign in as stringer</Link>
        </div>
      </main>
    );
  }
  if (user.user_role !== 'STRINGER') {
    return (
      <main className="container">
        <div className="card grid">
          <h1 className="h2">Stringer portal only</h1>
          <p className="p">This account is set up as a player. Use a stringer account to open the service queue.</p>
          <div className="inline-actions">
            <Link className="btn small-btn" href="/auth?mode=signin&role=STRINGER">Open stringer sign in</Link>
            <Link className="btn secondary small-btn" href="/player">Go to player portal</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container shell premium-shell">
      <section className="hero hero-premium stringer-hero">
        <div className="hero-inner premium-hero-inner">
          <div className="topbar topbar-inline">
            <div className="brand">
              <div className="brand-mark">SG</div>
              <div>
                <div className="small">Stringer portal</div>
                <strong>{user.name}</strong>
              </div>
            </div>
            <button className="btn secondary small-btn" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
          </div>

          <div className="hero-copy-stack">
            <span className="kicker">Daily queue</span>
            <h1 className="h1">Track drop-offs, inspection, payment, pickup, and history in one queue.</h1>
            <p className="p lead">
              Inspection now happens before restringing, outside-app payments can be recorded, and pickup confirmation is handled by the player.
            </p>
          </div>

          <div className="hero-summary-grid stringer-summary-grid">
            <div className="summary-card glass-card">
              <span className="small">Wallet</span>
              <strong>${wallet.toFixed(2)}</strong>
              <span className="summary-meta">Paid out after pickup checkout clears</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Ready to withdraw</span>
              <strong>${pendingPayout.toFixed(2)}</strong>
              <span className="summary-meta">Net amount currently available</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">History jobs</span>
              <strong>{stats.history}</strong>
              <span className="summary-meta">Completed and picked up orders</span>
            </div>
          </div>
        </div>
      </section>

      {message ? <div className="notice success">{message}</div> : null}

      <section className="panel-grid stringer-top-grid">
        <div className="card col-8 grid strong section-card section-card-large">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Queue overview</span>
              <h2 className="h2">What needs attention today</h2>
              <p className="p section-subtle">
                These premium summary cards surface the next work in line before you even open a specific tab.
              </p>
            </div>
          </div>
          <div className="stats premium-queue-stats">
            <div className="stat stat-highlight">
              <span className="small">Requested</span>
              <strong>{stats.requested}</strong>
              <span className="summary-meta">Waiting for drop-off confirmation</span>
            </div>
            <div className="stat">
              <span className="small">Received</span>
              <strong>{stats.received}</strong>
              <span className="summary-meta">Inspect before stringing</span>
            </div>
            <div className="stat">
              <span className="small">In progress</span>
              <strong>{stats.inProgress}</strong>
              <span className="summary-meta">Racquets on the machine</span>
            </div>
            <div className="stat">
              <span className="small">Awaiting pickup</span>
              <strong>{stats.awaitingPickup}</strong>
              <span className="summary-meta">Waiting for player pickup</span>
            </div>
          </div>
        </div>

        <div className="card col-4 grid strong section-card">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Drop-off scan</span>
              <h2 className="h2">Scan GlobeTag</h2>
            </div>
            <ScanLine size={18} />
          </div>
          <div>
            <label className="label">GlobeTag</label>
            <input
              className="input"
              value={scanTag}
              onChange={(e) => setScanTag(e.target.value)}
              placeholder="Enter GlobeTag"
            />
          </div>
          <button className="btn" onClick={scanDropoff}>Scan GlobeTag</button>
          <button className="btn secondary" onClick={withdraw}><Wallet size={16} /> Withdraw balance</button>
        </div>
      </section>

      <section className="panel-grid stringer-top-grid">
        <div className="card col-7 grid strong section-card">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Notifications</span>
              <h2 className="h2">Player requests and notes</h2>
            </div>
            <BellRing size={18} />
          </div>
          <div className="list notification-list-premium">
            {alerts.slice(0, 4).map((alert) => (
              <div className="meta-item notification-item" key={alert.id}>
                <strong>{alert.type === 'dropoff_request' ? 'Player requested drop-off' : 'Shop activity'}</strong>
                <div>{alert.owner_name || 'Player'} • {alert.tag_id || '—'}</div>
              </div>
            ))}
            {alerts.length === 0 ? <div className="small">No notifications yet. Player requests will appear here.</div> : null}
          </div>
        </div>

        <div className="card col-5 grid strong section-card">
          <div className="section-heading">
            <span className="kicker">Shop profile</span>
            <h2 className="h2">Name and city players can search</h2>
          </div>
          <div>
            <label className="label">Shop name</label>
            <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div>
            <label className="label">City</label>
            <input className="input" value={shopCity} onChange={(e) => setShopCity(e.target.value)} />
          </div>
          <button className="btn" onClick={saveShopProfile}>Save shop profile</button>
        </div>
      </section>

      <section className="card grid strong section-card section-card-large">
        <div className="topbar queue-header-bar">
          <div className="section-heading">
            <span className="kicker">Service queue</span>
            <h2 className="h2">Current jobs</h2>
          </div>
          <div className="tabbar premium-tabbar">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span>{tabLabels[tab]}</span>
                  {tabCounts[tab] > 0 ? (
                    <span
                      style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        background: '#dc2626',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '0 6px',
                      }}
                    >
                      {tabCounts[tab]}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="list premium-job-list">
          {filtered.map((job) => (
            <div className="card premium-job-card" key={job.job_id}>
              <div className="row between wrap">
                <div>
                  <div className="small">Job {formatJobCode(job.job_id)}</div>
                  <h3 className="h3">{job.owner_name || 'Player'}</h3>
                </div>
                <StatusPill status={job.status} />
              </div>

              <div className="job-meta-grid">
                <div className="small">
                  Source: {job.request_source === 'STRINGER_SCAN' ? 'Created by shop drop-off scan' : 'Created from the player side'}
                </div>
                <div className="small">
                  Job total: ${Number(job.amount_total || 30).toFixed(2)}
                </div>
              </div>

              {job.status === 'REQUESTED' ? (
                <div className="notice">Player requested a job. Scan the GlobeTag and confirm once the racquet is physically received.</div>
              ) : null}

              {job.status === 'RECEIVED' ? (
                <div className="notice">Inspect the racquet before you begin stringing.</div>
              ) : null}

              {job.status === 'IN_PROGRESS' ? (
                <div className="notice">Inspection completed. Finish the restring when the racquet is ready.</div>
              ) : null}

              {job.status === 'FINISHED' ? (
                <div className="notice warn">Stringing is complete. Collect payment in-app or outside the app.</div>
              ) : null}

              {job.status === 'PAID' ? (
                <div className="notice success">Paid successfully. Waiting for player pickup confirmation.</div>
              ) : null}

              {(job.picked_up || job.pickup_confirmed || String(job.status || '').toUpperCase() === 'PICKED_UP') ? (
                <div className="notice success">Pickup confirmed. This job is now stored in history.</div>
              ) : null}

              <div className="inline-actions">
                {job.status === 'REQUESTED' ? (
                  <button className="btn small-btn" onClick={() => confirmDropoff(job.job_id)}>Confirm drop-off</button>
                ) : null}

                {job.status === 'RECEIVED' ? (
                  <button className="btn secondary small-btn" onClick={() => setSelectedJob(job)}>Inspect racquet</button>
                ) : null}

                {job.status === 'IN_PROGRESS' ? (
                  <button className="btn small-btn" onClick={() => markFinished(job.job_id)}>Finish restring</button>
                ) : null}

                {job.status === 'FINISHED' ? (
                  <button className="btn small-btn" onClick={() => markPaidOutsideApp(job.job_id)}>Mark paid outside app</button>
                ) : null}
              </div>
            </div>
          ))}

          {filtered.length === 0 ? <div className="small">No jobs in this column yet.</div> : null}
        </div>
      </section>

      {selectedJob ? (
        <section className="card grid strong inspection-sheet" style={{ maxWidth: 760 }}>
          <div className="section-heading">
            <span className="kicker">Inspection</span>
            <h2 className="h2">Job {formatJobCode(selectedJob.job_id)}</h2>
            <p className="p section-subtle">Choose whether to flag the racquet or pass it into stringing.</p>
          </div>

          <div className="grid" style={{ gap: 12 }}>
            <div className="small" style={{ fontWeight: 700 }}>Flag racquet</div>

            <label className="check-row">
              <input
                type="radio"
                name="flagReason"
                checked={flagReason === 'GROMMETS'}
                onChange={() => setFlagReason('GROMMETS')}
              />
              <span>Grommets are in bad condition</span>
            </label>

            <label className="check-row">
              <input
                type="radio"
                name="flagReason"
                checked={flagReason === 'FRAME'}
                onChange={() => setFlagReason('FRAME')}
              />
              <span>Frame is in bad condition</span>
            </label>

            <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

            <div className="inline-actions">
              <button className="btn secondary small-btn" onClick={flagRacquet} disabled={!flagReason}>
                Flag Racquet
              </button>
              <button className="btn small-btn" onClick={passAndBeginStringing}>
                Pass · Begin Stringing
              </button>
              <button
                className="btn secondary small-btn"
                onClick={() => {
                  setSelectedJob(null);
                  setFlagReason('');
                  setFile(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
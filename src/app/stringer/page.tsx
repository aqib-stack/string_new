'use client';

import Link from 'next/link';
import { BellRing, CheckCircle2, ClipboardList, LogOut, ScanLine, ShieldCheck, Wallet } from 'lucide-react';
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
  saveInspection as saveInspectionRecord,
  startRestring,
  updateJob,
  updateShop,
} from '@/lib/firestoreData';
import { useEffect, useMemo, useState } from 'react';
import type { FieldValue } from 'firebase/firestore';
import { SHARED_SHOP_ID } from '@/lib/appConstants';

const tabs = ['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID'] as const;
const tabLabels: Record<(typeof tabs)[number], string> = {
  REQUESTED: 'Requested',
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  FINISHED: 'Finished',
  PAID: 'Paid',
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
  const [frame, setFrame] = useState(true);
  const [grommets, setGrommets] = useState(true);
  const [grip, setGrip] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const shopId = SHARED_SHOP_ID;

  async function refresh() {
    const [nextJobs, nextAlerts] = await Promise.all([listJobsByShop(shopId), listAlerts(shopId)]);
    setJobs(
      nextJobs.sort((a, b) => {
        const aTime = getTimeValue(a.created_at) || getTimeValue(a.created_at_server);
        const bTime = getTimeValue(b.created_at) || getTimeValue(b.created_at_server);
        return bTime - aTime;
      })
    );
    setAlerts(nextAlerts);
  }

  useEffect(() => {
    if (!user || user.user_role !== 'STRINGER') return;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => {
      window.clearInterval(timer);
    };
  }, [user, shopId]);

  const filtered = useMemo(
    () => jobs.filter((job) => String(job.status || '').toUpperCase() === activeTab),
    [jobs, activeTab]
  );

  const [wallet, setWallet] = useState(0);
  const [pendingPayout, setPendingPayout] = useState(0);

  useEffect(() => {
    (async () => {
      const shop = await getShop(shopId);
      setWallet(Number(shop?.wallet_balance || 0));
      setPendingPayout(await getPendingPayoutTotal(shopId));
    })();
  }, [jobs, shopId]);

  const stats = useMemo(
    () => ({
      requested: jobs.filter((job) => String(job.status || '').toUpperCase() === 'REQUESTED').length,
      received: jobs.filter((job) => String(job.status || '').toUpperCase() === 'RECEIVED').length,
      inProgress: jobs.filter((job) => String(job.status || '').toUpperCase() === 'IN_PROGRESS').length,
      ready: jobs.filter((job) => String(job.status || '').toUpperCase() === 'FINISHED').length,
    }),
    [jobs]
  );

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

  async function saveInspection() {
    if (!selectedJob) return;
    const damage = !(frame && grommets && grip);

    if (damage) {
      await saveInspectionRecord(selectedJob.job_id, {
        inspection_log: { frame, grommets, grip, photo_url: file ? file.name : '' },
        status: 'IN_PROGRESS',
        damage_confirmed: false,
      });
    } else {
      await saveInspectionRecord(selectedJob.job_id, {
        inspection_log: { frame, grommets, grip, photo_url: file ? file.name : '' },
        damage_confirmed: true,
      });
    }

    setMessage(
      damage
        ? `Damage flagged for ${formatJobCode(selectedJob.job_id)}. The job stays in progress.`
        : `Inspection passed for ${formatJobCode(selectedJob.job_id)}. Waiting for player payment.`
    );
    setSelectedJob(null);
    setActiveTab(damage ? 'IN_PROGRESS' : 'FINISHED');
    await refresh();
  }

  async function scanDropoff() {
    const trimmed = scanTag.trim();
    if (!trimmed) return;

    const racquet = (await getRacquetByTag(trimmed)) as any;
    if (!racquet) {
      setMessage('No racquet with that GlobeTag is linked to a player bag yet. Ask the player to scan it first.');
      return;
    }

    const existingOpenJob = await getOpenJobForRacquet(racquet.racquet_id);

    if (existingOpenJob) {
      if (existingOpenJob.status === 'REQUESTED') {
        await confirmDropOff(existingOpenJob.job_id);
        await markAlertsReadForJob(existingOpenJob.job_id);
        await addAlert({
          type: 'stringer_scan',
          job_id: existingOpenJob.job_id,
          shop_id: shopId,
          racquet_id: racquet.racquet_id,
          tag_id: racquet.tag_id,
          owner_name: racquet.owner_name || 'Player',
          created_at: new Date().toISOString(),
          read: true,
        });
        setMessage(`Drop-off recorded for ${racquet.tag_id}. The existing player request moved into the received column.`);
        setActiveTab('RECEIVED');
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
    if (!wallet) {
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
            <h1 className="h1">Track drop-offs, inspections, and payouts in one premium queue.</h1>
            <p className="p lead">
              Everything from player requests to final payout lives in one cleaner stringer workspace, with step-by-step
              actions for every job state.
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
              <span className="small">Unread alerts</span>
              <strong>{alerts.filter((a) => !a.read).length}</strong>
              <span className="summary-meta">New activity from players and scans</span>
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
              <span className="summary-meta">Player jobs waiting for drop-off confirmation</span>
            </div>
            <div className="stat">
              <span className="small">Received</span>
              <strong>{stats.received}</strong>
              <span className="summary-meta">Jobs physically at the shop</span>
            </div>
            <div className="stat">
              <span className="small">In progress</span>
              <strong>{stats.inProgress}</strong>
              <span className="summary-meta">Racquets on the machine or in inspection</span>
            </div>
            <div className="stat">
              <span className="small">Ready for payment</span>
              <strong>{stats.ready}</strong>
              <span className="summary-meta">Waiting on player checkout to release payout</span>
            </div>
          </div>
        </div>

        <div className="card col-4 grid strong section-card">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Drop-off scan</span>
              <h2 className="h2">Create a job at the shop</h2>
            </div>
            <ScanLine size={18} />
          </div>
          <p className="p">
            If a player walks in with the racquet, scan the GlobeTag here and the job will appear in both portals instantly.
          </p>
          <div>
            <label className="label">GlobeTag</label>
            <input
              className="input"
              value={scanTag}
              onChange={(e) => setScanTag(e.target.value)}
              placeholder="Enter GlobeTag"
            />
          </div>
          <button className="btn" onClick={scanDropoff}>Create job from drop-off scan</button>
          <button className="btn secondary" onClick={withdraw}><Wallet size={16} /> Withdraw balance</button>
        </div>
      </section>

      <section className="panel-grid stringer-top-grid">
        <div className="card col-7 grid strong section-card">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Notifications</span>
              <h2 className="h2">Player requests and shop activity</h2>
            </div>
            <BellRing size={18} />
          </div>
          <div className="list notification-list-premium">
            {alerts.slice(0, 4).map((alert) => (
              <div className="meta-item notification-item" key={alert.id}>
                <strong>{alert.type === 'dropoff_request' ? 'Player requested drop-off' : 'Stringer scan recorded'}</strong>
                <div>{alert.owner_name || 'Player'} • {alert.tag_id || '—'}</div>
              </div>
            ))}
            {alerts.length === 0 ? <div className="small">No notifications yet. Player requests will appear here.</div> : null}
          </div>
        </div>

        <div className="card col-5 grid strong section-card">
          <div className="section-heading">
            <span className="kicker">Workflow</span>
            <h2 className="h2">How the queue moves</h2>
          </div>
          <div className="workflow-stack">
            <div className="workflow-item">
              <ClipboardList size={18} />
              <div>
                <strong>Request</strong>
                <span>Player scan or portal request lands in the requested column.</span>
              </div>
            </div>
            <div className="workflow-item">
              <ShieldCheck size={18} />
              <div>
                <strong>Inspect</strong>
                <span>Confirm drop-off, start restring, then record inspection details.</span>
              </div>
            </div>
            <div className="workflow-item">
              <CheckCircle2 size={18} />
              <div>
                <strong>Payout</strong>
                <span>Player payment unlocks the wallet and makes the payout withdrawable.</span>
              </div>
            </div>
          </div>
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
                {tabLabels[tab]}
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
                  {job.status === 'PAID' ? 'Paid by player' : 'Job total'}: ${Number(job.amount_total || 30).toFixed(2)}
                </div>
              </div>
              {job.status === 'REQUESTED' ? (
                <div className="notice">Player requested a job. Confirm drop-off once the racquet arrives at the shop.</div>
              ) : null}
              {job.status === 'RECEIVED' ? (
                <div className="notice">Drop-off confirmed. This racquet is ready to enter the restring queue.</div>
              ) : null}
              {job.status === 'FINISHED' ? (
                <div className="notice warn">Waiting for player payment before payout is released.</div>
              ) : null}
              {job.status === 'PAID' ? (
                <div className="notice success">
                  Paid successfully. Net payout is now {job.payout_released ? 'processing in payout' : 'withdrawable'}.
                </div>
              ) : null}
              <div className="inline-actions">
                {job.status === 'REQUESTED' ? (
                  <button className="btn small-btn" onClick={() => confirmDropoff(job.job_id)}>Confirm drop-off</button>
                ) : null}
                {job.status === 'RECEIVED' ? (
                  <button className="btn small-btn" onClick={() => markInProgress(job.job_id)}>Start restring</button>
                ) : null}
                {job.status !== 'FINISHED' && job.status !== 'PAID' && job.status !== 'REQUESTED' ? (
                  <button className="btn secondary small-btn" onClick={() => setSelectedJob(job)}>Inspect racquet</button>
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
            <p className="p section-subtle">Log condition checks before you send the racquet to the finished state.</p>
          </div>
          <div className="inspection-checks">
            <label className="check-row">
              <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} /> <span>Frame is in good condition</span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={grommets} onChange={(e) => setGrommets(e.target.checked)} /> <span>Grommets are in good condition</span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={grip} onChange={(e) => setGrip(e.target.checked)} /> <span>Grip is in good condition</span>
            </label>
          </div>
          <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="inline-actions">
            <button className="btn small-btn" onClick={saveInspection}>Save inspection</button>
            <button className="btn secondary small-btn" onClick={() => setSelectedJob(null)}>Cancel</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
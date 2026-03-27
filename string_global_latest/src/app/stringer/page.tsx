'use client';

import Link from 'next/link';
import { LogOut, ScanLine, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { logoutUser } from '@/lib/authHelpers';
import {
  addAlert,
  createJob,
  formatJobCode,
  getPendingPayoutTotal,
  getRacquetByTag,
  getShop,
  listAlerts,
  listJobsByShop,
  markAlertsReadForJob,
  updateJob,
  updateShop,
} from '@/lib/demoData';
import { useEffect, useMemo, useState } from 'react';

const tabs = ['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID'] as const;

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

  const shopId = user?.shop_id || 'demo-shop-1';

  function refresh() {
    setJobs(listJobsByShop(shopId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    setAlerts(listAlerts().filter((alert) => alert.shop_id === shopId));
  }

  useEffect(() => {
    if (!user || user.user_role !== 'STRINGER') return;
    refresh();
    const onStorage = () => refresh();
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(refresh, 1200);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [user, shopId]);

  const filtered = useMemo(() => jobs.filter((job) => job.status === activeTab), [jobs, activeTab]);
  const wallet = Number(getShop(shopId)?.wallet_balance || 0);
  const pendingPayout = useMemo(() => getPendingPayoutTotal(shopId), [jobs, shopId]);

  async function handleLogout() {
    await logoutUser();
    window.location.href = '/';
  }

  function confirmDropoff(jobId: string) {
    updateJob(jobId, { status: 'RECEIVED' });
    markAlertsReadForJob(jobId);
    setMessage(`Drop-off confirmed for ${formatJobCode(jobId)}.`);
    setActiveTab('RECEIVED');
    refresh();
  }

  function markInProgress(jobId: string) {
    updateJob(jobId, { status: 'IN_PROGRESS' });
    markAlertsReadForJob(jobId);
    setMessage(`Job ${formatJobCode(jobId)} moved into the active restring queue.`);
    setActiveTab('IN_PROGRESS');
    refresh();
  }

  function saveInspection() {
    if (!selectedJob) return;
    const damage = !(frame && grommets && grip);
    updateJob(selectedJob.job_id, {
      inspection_log: { frame, grommets, grip, photo_url: file ? file.name : '' },
      status: damage ? 'IN_PROGRESS' : 'FINISHED',
      damage_confirmed: !damage,
    });
    setMessage(damage ? `Damage flagged for ${formatJobCode(selectedJob.job_id)}. The job stays in progress.` : `Inspection passed for ${formatJobCode(selectedJob.job_id)}. Waiting for player payment.`);
    setSelectedJob(null);
    setActiveTab(damage ? 'IN_PROGRESS' : 'FINISHED');
    refresh();
  }

  function scanDropoff() {
    const trimmed = scanTag.trim();
    if (!trimmed) return;
    const racquet = getRacquetByTag(trimmed) as any;
    if (!racquet) {
      setMessage('No racquet with that GlobeTag is linked to a player bag yet.');
      return;
    }
    const job = createJob({
      racquet_id: racquet.racquet_id,
      owner_uid: racquet.owner_uid,
      owner_name: racquet.owner_name || 'Player',
      shop_id: shopId,
      amount_total: 30,
      status: 'RECEIVED',
      request_source: 'STRINGER_SCAN',
    });
    addAlert({
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
    refresh();
  }

  function withdraw() {
    if (!wallet) {
      setMessage('No funds available yet. Paid jobs move into the wallet automatically.');
      return;
    }
    updateShop(shopId, { wallet_balance: 0 });
    setMessage(`Payout initiated for $${wallet.toFixed(2)}.`);
    refresh();
  }

  if (loading) return <main className="container"><div className="card">Loading queue…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Stringer access</h1><p className="p">Sign in to manage requests, drop-offs, inspections, and payouts.</p><Link className="btn" href="/auth?mode=signin&role=STRINGER">Sign in as stringer</Link></div></main>;
  if (user.user_role !== 'STRINGER') return <main className="container"><div className="card grid"><h1 className="h2">Stringer portal only</h1><p className="p">This account is set up as a player. Use a stringer account to open the service queue.</p><div className="inline-actions"><Link className="btn small-btn" href="/auth?mode=signin&role=STRINGER">Open stringer sign in</Link><Link className="btn secondary small-btn" href="/player">Go to player portal</Link></div></div></main>;

  return (
    <main className="container shell">
      <section className="hero">
        <div className="hero-media" style={{ backgroundImage: 'url(/hero-racquet.svg)' }} />
        <div className="hero-inner">
          <div className="topbar">
            <div className="brand"><div className="brand-mark">SG</div><div><div className="small">Stringer portal</div><strong>{user.name}</strong></div></div>
            <button className="btn secondary small-btn" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
          </div>
          <span className="kicker">Daily queue</span>
          <h1 className="h1">Track drop-offs, inspections, and payout in one place.</h1>
          <p className="p">Player scans and stringer drop-off scans stay perfectly synced so the queue always reflects the latest job state.</p>
          <div className="stats">
            <div className="stat"><span className="small">Wallet</span><strong>${wallet.toFixed(2)}</strong></div>
            <div className="stat"><span className="small">Ready to withdraw</span><strong>${pendingPayout.toFixed(2)}</strong></div>
            <div className="stat"><span className="small">Unread alerts</span><strong>{alerts.filter((a) => !a.read).length}</strong></div>
          </div>
        </div>
      </section>

      {message ? <div className="notice success">{message}</div> : null}

      <section className="panel-grid">
        <div className="card col-4 grid strong">
          <div className="topbar"><div className="section-heading"><span className="kicker">Drop-off scan</span><h2 className="h2">Create a job at the shop</h2></div><ScanLine size={18} /></div>
          <p className="p">If the player walks in with the racquet, scan the GlobeTag here and the job will appear in both portals instantly.</p>
          <input className="input" value={scanTag} onChange={(e) => setScanTag(e.target.value)} placeholder="Enter GlobeTag" />
          <button className="btn" onClick={scanDropoff}>Create job from drop-off scan</button>
          <button className="btn secondary" onClick={withdraw}><Wallet size={16} /> Withdraw balance</button>
        </div>

        <div className="card col-8 grid">
          <div className="topbar"><div className="section-heading"><span className="kicker">Notifications</span><h2 className="h2">Player requests and shop activity</h2></div></div>
          <div className="list">
            {alerts.slice(0, 4).map((alert) => (
              <div className="meta-item" key={alert.id}>
                <strong>{alert.type === 'dropoff_request' ? 'Player requested drop-off' : 'Stringer scan recorded'}</strong>
                <div>{alert.owner_name || 'Player'} • {alert.tag_id || '—'}</div>
              </div>
            ))}
            {alerts.length === 0 ? <div className="small">No notifications yet. Player requests will appear here.</div> : null}
          </div>
        </div>
      </section>

      <section className="card grid strong">
        <div className="tabbar">
          {tabs.map((tab) => (
            <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab.replace('_', ' ')}</div>
          ))}
        </div>
        <div className="list">
          {filtered.map((job) => (
            <div className="card" key={job.job_id}>
              <div className="row between wrap">
                <div>
                  <div className="small">Job {formatJobCode(job.job_id)}</div>
                  <h3 className="h3">{job.owner_name || 'Player'}</h3>
                </div>
                <StatusPill status={job.status} />
              </div>
              <div className="small">Source: {job.request_source === 'STRINGER_SCAN' ? 'Created by shop drop-off scan' : 'Created from the player side'}</div>
              <div className="small">{job.status === 'PAID' ? 'Paid by player' : 'Job total'}: ${Number(job.amount_total || 30).toFixed(2)}</div>
              {job.status === 'REQUESTED' ? <div className="notice">Player requested a job. Confirm drop-off once the racquet arrives at the shop.</div> : null}
              {job.status === 'RECEIVED' ? <div className="notice">Drop-off confirmed. This racquet is ready to enter the restring queue.</div> : null}
              {job.status === 'FINISHED' ? <div className="notice warn">Waiting for player payment before payout is released.</div> : null}
              {job.status === 'PAID' ? <div className="notice success">Paid successfully. Net payout is now withdrawable.</div> : null}
              <div className="inline-actions">
                {job.status === 'REQUESTED' ? <button className="btn small-btn" onClick={() => confirmDropoff(job.job_id)}>Confirm drop-off</button> : null}
                {job.status === 'RECEIVED' ? <button className="btn small-btn" onClick={() => markInProgress(job.job_id)}>Start restring</button> : null}
                {job.status !== 'FINISHED' && job.status !== 'PAID' && job.status !== 'REQUESTED' ? <button className="btn secondary small-btn" onClick={() => setSelectedJob(job)}>Inspect racquet</button> : null}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <div className="small">No jobs in this column yet.</div> : null}
        </div>
      </section>

      {selectedJob ? (
        <section className="card grid" style={{ maxWidth: 760 }}>
          <div className="section-heading"><span className="kicker">Inspection</span><h2 className="h2">Job {formatJobCode(selectedJob.job_id)}</h2></div>
          <label className="row"><input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} /> Frame is in good condition</label>
          <label className="row"><input type="checkbox" checked={grommets} onChange={(e) => setGrommets(e.target.checked)} /> Grommets are in good condition</label>
          <label className="row"><input type="checkbox" checked={grip} onChange={(e) => setGrip(e.target.checked)} /> Grip is in good condition</label>
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

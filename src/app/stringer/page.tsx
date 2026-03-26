'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { addAlert, clearDemoData, formatJobCode, getPendingPayoutTotal, getShop, listJobsByShop, updateJob, updateShop } from '@/lib/demoData';
import { clearDemoUser } from '@/lib/demoAuth';
import { useEffect, useMemo, useState } from 'react';

const tabs = ['RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID'] as const;

export default function StringerDashboard() {
  const { user, loading } = useCurrentUser();
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('RECEIVED');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [frame, setFrame] = useState(true);
  const [grommets, setGrommets] = useState(true);
  const [grip, setGrip] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [wallet, setWallet] = useState(0);
  const [message, setMessage] = useState('');

  const effectiveShopId = user?.shop_id || 'demo-shop-1';

  function refreshData() {
    setJobs(listJobsByShop(effectiveShopId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    const shop = getShop(effectiveShopId);
    setWallet(shop?.wallet_balance || 0);
  }

  useEffect(() => {
    if (user?.user_role !== 'STRINGER') return;
    refreshData();

    const onStorage = () => refreshData();
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(() => refreshData(), 1200);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [effectiveShopId, user]);

  const filtered = useMemo(() => jobs.filter((job) => job.status === activeTab), [jobs, activeTab]);
  const pendingPayout = useMemo(() => getPendingPayoutTotal(effectiveShopId), [jobs, effectiveShopId]);

  async function saveInspection() {
    if (!selectedJob) return;
    setUploading(true);
    const damage = !(frame && grommets && grip);
    updateJob(selectedJob.job_id, {
      inspection_log: {
        frame,
        grommets,
        grip,
        photo_url: file ? file.name : '',
      },
      status: damage ? 'IN_PROGRESS' : 'FINISHED',
      damage_confirmed: !damage,
    });
    if (damage) {
      addAlert({ type: 'damage', job_id: selectedJob.job_id, created_at: new Date().toISOString() });
      setMessage(`Inspection saved for job ${formatJobCode(selectedJob.job_id)}. Damage flagged, job kept in progress.`);
      setActiveTab('IN_PROGRESS');
    } else {
      setMessage(`Inspection passed for job ${formatJobCode(selectedJob.job_id)}. Job is finished and now waiting for player payment.`);
      setActiveTab('FINISHED');
    }
    setUploading(false);
    setSelectedJob(null);
    setFile(null);
    refreshData();
  }

  async function markInProgress(jobId: string) {
    updateJob(jobId, { status: 'IN_PROGRESS' });
    setMessage(`Job ${formatJobCode(jobId)} moved to in progress.`);
    setActiveTab('IN_PROGRESS');
    refreshData();
  }

  async function withdraw() {
    if (!wallet) {
      setMessage('No funds available yet. Complete jobs must be paid before withdrawal.');
      return;
    }
    updateShop(effectiveShopId, { wallet_balance: 0 });
    setMessage(`Withdrawal completed for $${wallet.toFixed(2)}.`);
    refreshData();
  }

  function resetDemo() {
    clearDemoUser();
    clearDemoData();
    window.location.href = '/';
  }

  if (loading) return <main className="container"><div className="card">Loading...</div></main>;

  if (!user) {
    return (
      <main className="container">
        <div className="card grid">
          <h1 className="h2">Stringer portal</h1>
          <p className="p">Please log in as a stringer to manage the restring queue and withdraw paid earnings.</p>
          <Link className="btn" href="/auth?next=/stringer">Log in as stringer</Link>
        </div>
      </main>
    );
  }

  if (user.user_role !== 'STRINGER') {
    return (
      <main className="container">
        <div className="card grid">
          <h1 className="h2">Stringer portal only</h1>
          <p className="p">This area is only for stringers. Your current session is signed in as a player.</p>
          <div className="row wrap">
            <Link className="btn" href="/auth?next=/stringer">Switch to stringer</Link>
            <Link className="btn secondary" href="/player">Go to player portal</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container grid">
      <div className="card grid">
        <span className="kicker">Stringer portal</span>
        <div className="row between">
          <div>
            <h1 className="h2">Queue + inspection</h1>
            <p className="p">Players drop off racquets first. Once you finish the job, the player pays before pickup. Only paid jobs increase the withdrawable wallet.</p>
          </div>
          <div className="badge green">Wallet ${wallet.toFixed(2)}</div>
        </div>
        <div className="card grid">
          <div className="row between"><span className="small">Withdrawable balance</span><strong>${wallet.toFixed(2)}</strong></div>
          <div className="row between"><span className="small">Paid jobs ready to withdraw</span><strong>${pendingPayout.toFixed(2)}</strong></div>
          <div className="row between"><span className="small">Platform fee per job</span><strong>$0.35</strong></div>
        </div>
        <div className="row wrap">
          <button className="btn secondary" onClick={withdraw} disabled={!wallet}>Withdraw</button>
          <button className="btn ghost" onClick={resetDemo}>Reset demo data</button>
        </div>
        {!wallet ? <div className="small">No funds available yet. Complete jobs must be paid before withdrawal.</div> : null}
        {message ? <div className="notice success">{message}</div> : null}
      </div>

      <div className="card grid">
        <div className="tabbar four">
          {tabs.map((tab) => (
            <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab.replace('_', ' ')}</div>
          ))}
        </div>
        <div className="list">
          {filtered.map((job) => (
            <div className="card" key={job.job_id}>
              <div className="row between">
                <strong>Job {formatJobCode(job.job_id)}</strong>
                <StatusPill status={job.status} />
              </div>
              <div className="small">Racquet: {job.racquet_id}</div>
              <div className="small">Owner: {job.owner_name || 'Demo Player'}</div>
              <div className="small">{job.status === 'PAID' ? 'Paid by player' : 'Job total'}: ${Number(job.amount_total || 30).toFixed(2)}</div>
              {job.status === 'FINISHED' ? <div className="small">Waiting for player payment before this amount moves into the wallet.</div> : null}
              {job.status === 'PAID' ? <div className="notice success">Paid successfully. Net payout is ready to withdraw.</div> : null}
              <div className="row wrap">
                {job.status === 'RECEIVED' ? <button className="btn secondary" onClick={() => void markInProgress(job.job_id)}>Start</button> : null}
                {job.status !== 'FINISHED' && job.status !== 'PAID' ? <button className="btn" onClick={() => setSelectedJob(job)}>Inspect</button> : null}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <div className="small">No jobs in this column.</div> : null}
        </div>
      </div>

      {selectedJob ? (
        <div className="card grid">
          <h2 className="h2">Inspection for job {formatJobCode(selectedJob.job_id)}</h2>
          <label className="row"><input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} /> Frame OK</label>
          <label className="row"><input type="checkbox" checked={grommets} onChange={(e) => setGrommets(e.target.checked)} /> Grommets OK</label>
          <label className="row"><input type="checkbox" checked={grip} onChange={(e) => setGrip(e.target.checked)} /> Grip OK</label>
          <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="btn" onClick={() => void saveInspection()} disabled={uploading}>{uploading ? 'Saving...' : 'Save inspection'}</button>
          <p className="small">If any damage is flagged, the job stays in progress and an alert is logged in demo storage.</p>
        </div>
      ) : null}
    </main>
  );
}

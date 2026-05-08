'use client';

import Link from 'next/link';
import { BellRing, LogOut, ScanLine, Settings, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { JobProgressLine } from '@/components/JobProgressLine';
import { StringSetupSummary, getStringSetupSummary } from '@/components/StringSetupSummary';
import { logoutUser } from '@/lib/authHelpers';
import {
  addAlert,
  cancelJob,
  confirmDropOff,
  createJob,
  formatJobCode,
  getOpenJobForRacquet,
  getPendingPayoutTotal,
  getRacquetByTag,
  getShop,
  listAlerts,
  listJobsByShop,
  listJobsByRacquet,
  markAlertsReadForJob,
  markJobFinished,
  markJobPaidOutsideApp,
  saveInspection as saveInspectionRecord,
  updateJob,
  getStringerNetForJob,
  updateShop,
} from '@/lib/firestoreData';
import { useEffect, useMemo, useState } from 'react';
import type { FieldValue } from 'firebase/firestore';

const tabs = ['REQUESTED', 'RECEIVED', 'AWAITING_PLAYER', 'IN_PROGRESS', 'FINISHED', 'PAID'] as const;
const tabLabels: Record<(typeof tabs)[number], string> = {
  REQUESTED: 'Requested',
  RECEIVED: 'Received',
  AWAITING_PLAYER: 'Awaiting Player',
  IN_PROGRESS: 'In progress',
  FINISHED: 'Finished',
  PAID: 'Awaiting pickup',
};

type FirestoreDateValue = string | number | Date | { seconds: number; nanoseconds?: number } | { toDate: () => Date } | { toMillis: () => number } | FieldValue | null | undefined;

function getTimeValue(value: FirestoreDateValue): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatTimeline(value: FirestoreDateValue) {
  const time = getTimeValue(value);
  if (!time) return '—';
  return new Date(time).toLocaleDateString();
}

function jobHistoryLine(job: any) {
  const summary = getStringSetupSummary(job);
  return `${formatJobCode(job.job_id)} • ${summary.setupLabel} • ${summary.tensionLabel} • ${job.status}`;
}

export default function StringerPage() {
  const { user, loading } = useCurrentUser();
  const [jobs, setJobs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('REQUESTED');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [scanTag, setScanTag] = useState('globetag-001');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopLaborRate, setShopLaborRate] = useState('20');
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, { labor: string; stringCost: string; customerProvided: boolean }>>({});
  const [sendingJobId, setSendingJobId] = useState('');
  const [scannedRacquet, setScannedRacquet] = useState<any | null>(null);
  const [scannedHistory, setScannedHistory] = useState<any[]>([]);

  const shopId = user?.shop_id || '';

  async function refresh() {
    if (!shopId) return;
    const [nextJobs, nextAlerts, shop] = await Promise.all([listJobsByShop(shopId), listAlerts(shopId), getShop(shopId)]);
    setJobs(nextJobs.sort((a, b) => (getTimeValue(b.created_at) || getTimeValue(b.created_at_server)) - (getTimeValue(a.created_at) || getTimeValue(a.created_at_server))));
    setAlerts(nextAlerts);
    setShopName(String(shop?.name || ''));
    setShopLaborRate(String(Number(shop?.labor_rate || 20)));
  }

  useEffect(() => {
    if (!user || user.user_role !== 'STRINGER' || !shopId) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [user, shopId]);

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

  const stats = useMemo(() => ({
    requested: jobs.filter((job) => job.status === 'REQUESTED').length,
    received: jobs.filter((job) => job.status === 'RECEIVED').length,
    awaiting: jobs.filter((job) => job.status === 'AWAITING_PLAYER').length,
    inProgress: jobs.filter((job) => job.status === 'IN_PROGRESS').length,
    ready: jobs.filter((job) => job.status === 'FINISHED').length,
    awaitingPickup: jobs.filter((job) => job.status === 'PAID').length,
  }), [jobs]);

  const actionCount = stats.requested + stats.received + stats.awaiting + stats.inProgress + stats.awaitingPickup;

  const tabCounts: Record<(typeof tabs)[number], number> = {
    REQUESTED: stats.requested,
    RECEIVED: stats.received,
    AWAITING_PLAYER: stats.awaiting,
    IN_PROGRESS: stats.inProgress,
    FINISHED: stats.ready,
    PAID: stats.awaitingPickup,
  };

  const filtered = useMemo(() => {
    return jobs.filter((job) => job.status === activeTab);
  }, [jobs, activeTab]);

  const historyJobs = useMemo(() => jobs.filter((job) => ['PICKED_UP', 'CANCELLED'].includes(job.status)), [jobs]);

  const revenueStats = useMemo(() => {
    const digitalFunds = pendingPayout;
    const cashOnHand = jobs
      .filter((job) => job.paid_outside_app)
      .reduce((sum, job) => sum + Number(job.amount_total || 0), 0);
    const totalBusinessRevenue = wallet + cashOnHand;
    const uncollectedRevenue = jobs
      .filter((job) => job.status === 'FINISHED' && job.payment_requested_at)
      .reduce((sum, job) => sum + Number(job.amount_total || 0), 0);
    const pipelineCapital = jobs
      .filter((job) => ['REQUESTED', 'RECEIVED', 'IN_PROGRESS'].includes(job.status))
      .reduce((sum, job) => sum + Number(job.amount_total || 0), 0);
    const stringingCyclesDue = jobs.filter((job) => ['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED'].includes(job.status)).length;
    return { digitalFunds, cashOnHand, totalBusinessRevenue, uncollectedRevenue, pipelineCapital, stringingCyclesDue };
  }, [jobs, pendingPayout, wallet]);

  const issueJobs = useMemo(() => jobs.filter((job) =>
    job.status === 'AWAITING_PLAYER' ||
    (job.status === 'FINISHED' && job.payment_requested_at) ||
    (job.status === 'PAID' && !job.pickup_confirmed)
  ), [jobs]);

  function getPricingDraft(job: any) {
    return pricingDrafts[job.job_id] || {
      labor: String(Number(job.labor_cost ?? shopLaborRate ?? 20)),
      stringCost: String(Number(job.customer_provided_string ? 0 : (job.string_cost ?? 0))),
      customerProvided: Boolean(job.customer_provided_string),
    };
  }

  function updatePricingDraft(jobId: string, patch: Partial<{ labor: string; stringCost: string; customerProvided: boolean }>) {
    setPricingDrafts((current) => ({ ...current, [jobId]: { ...getPricingDraft({ job_id: jobId }), ...current[jobId], ...patch } }));
  }

  async function handleLogout() { await logoutUser(); window.location.href = '/'; }
  async function confirmDropoff(jobId: string) { await confirmDropOff(jobId); await markAlertsReadForJob(jobId); setMessage(`Drop-off confirmed for ${formatJobCode(jobId)}.`); setActiveTab('RECEIVED'); await refresh(); }

  async function flagRacquet() {
    if (!selectedJob || !selectedIssues.length) return;
    await saveInspectionRecord(selectedJob.job_id, {
      inspection_note: `Issue found: ${selectedIssues.join(', ')}`,
      flagged_issues: selectedIssues,
      flagged_photo_urls: file ? [`Inspection photo: ${file.name}`] : [],
      flagged_issue: selectedIssues[0] === 'Frame damage' ? 'FRAME' : 'GROMMETS',
      damage_confirmed: false,
      status: 'AWAITING_PLAYER',
      awaiting_player_response: true,
    });
    await addAlert({ type: 'racquet_flagged', owner_uid: selectedJob.owner_uid, owner_name: selectedJob.owner_name, shop_id: selectedJob.shop_id, job_id: selectedJob.job_id, racquet_id: selectedJob.racquet_id, note: `Issue found: ${selectedIssues.join(', ')}`, read: false });
    setMessage(`Racquet flagged for ${formatJobCode(selectedJob.job_id)}.`);
    setSelectedJob(null); setSelectedIssues([]); setFile(null); setActiveTab('AWAITING_PLAYER'); await refresh();
  }

  async function passAndBeginStringing() {
    if (!selectedJob) return;
    await saveInspectionRecord(selectedJob.job_id, { inspection_note: '', flagged_issue: '', flagged_issues: [], damage_confirmed: true, status: 'IN_PROGRESS', started_at: new Date().toISOString() });
    setMessage(`Inspection passed for ${formatJobCode(selectedJob.job_id)}. Stringing started.`);
    setSelectedJob(null); setSelectedIssues([]); setFile(null); setActiveTab('IN_PROGRESS'); await refresh();
  }

  async function markFinished(jobId: string) { await markJobFinished(jobId); setMessage(`Job ${formatJobCode(jobId)} marked as finished.`); setActiveTab('FINISHED'); await refresh(); }

  async function sendPaymentRequest(job: any) {
    const draft = getPricingDraft(job);
    const labor = Number(draft.labor || 0);
    const stringCost = draft.customerProvided ? 0 : Number(draft.stringCost || 0);
    const total = labor + stringCost;
    if (total <= 0) return setMessage('Please enter a valid total before sending the payment request.');
    try {
      setSendingJobId(job.job_id);
      await updateJob(job.job_id, { labor_cost: labor, string_cost: stringCost, customer_provided_string: draft.customerProvided, amount_total: total, payment_requested_at: new Date().toISOString() });
      await addAlert({ type: 'payment_request', owner_uid: job.owner_uid, owner_name: job.owner_name, shop_id: job.shop_id, job_id: job.job_id, racquet_id: job.racquet_id, note: `Payment requested for ${formatMoney(total)}.`, read: false });
      setMessage(`Payment request for ${formatMoney(total)} sent.`); await refresh();
    } finally { setSendingJobId(''); }
  }

  async function markPaidOutsideApp(jobId: string) { await markJobPaidOutsideApp(jobId); setMessage(`Job ${formatJobCode(jobId)} marked as paid outside the app.`); setActiveTab('PAID'); await refresh(); }

  async function scanDropoff() {
    const trimmed = scanTag.trim(); if (!trimmed || !shopId) return;
    const racquet = (await getRacquetByTag(trimmed)) as any;
    if (!racquet) return setMessage('No racquet with that GlobeTag is linked yet.');
    setScannedRacquet(racquet);
    setScannedHistory((await listJobsByRacquet(racquet.racquet_id)).slice(0, 5));
    const existingOpenJob = await getOpenJobForRacquet(racquet.racquet_id);
    if (existingOpenJob) {
      if (existingOpenJob.status === 'REQUESTED') { setMessage(`GlobeTag ${racquet.tag_id} scanned. Confirm drop-off to move the job into received.`); setActiveTab('REQUESTED'); await refresh(); return; }
      setMessage(`An active job already exists for ${racquet.tag_id}: ${formatJobCode(existingOpenJob.job_id)}.`); await refresh(); return;
    }
    const job = await createJob({ racquet_id: racquet.racquet_id, owner_uid: racquet.owner_uid, owner_name: racquet.owner_name || 'Player', shop_id: shopId, amount_total: Number(shopLaborRate || 20), labor_cost: Number(shopLaborRate || 20), string_cost: 0, customer_provided_string: false, status: 'RECEIVED', request_source: 'STRINGER_SCAN', racquet_name: racquet.racquet_name || '', racquet_model: racquet.racquet_model || '', preferred_shop_name: racquet.preferred_shop_name || shopName || '', string_type: racquet.string_type || '', tension: racquet.tension || '', is_hybrid: Boolean(racquet.is_hybrid), hybrid_setup: racquet.hybrid_setup || undefined, dropped_off_at: new Date().toISOString() });
    await addAlert({ type: 'stringer_scan', job_id: job.job_id, shop_id: shopId, racquet_id: racquet.racquet_id, tag_id: racquet.tag_id, owner_name: racquet.owner_name || 'Player', created_at: new Date().toISOString(), read: true });
    setMessage(`Drop-off scan recorded for ${racquet.tag_id}.`); setActiveTab('RECEIVED'); await refresh();
  }

  async function withdraw() {
    if (!wallet || !shopId) return setMessage('No funds available yet.');
    const paidJobs = jobs.filter((job) => job.status === 'PAID' && !job.payout_released);
    await Promise.all(paidJobs.map((job) => updateJob(job.job_id, { payout_released: true })));
    await updateShop(shopId, { wallet_balance: 0 } as any);
    setMessage(`Payout initiated for ${formatMoney(wallet)}.`); await refresh();
  }

  if (loading) return <main className="container"><div className="card">Loading queue…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Stringer access</h1><p className="p">Sign in to manage requests, drop-offs, inspections, and payouts.</p><Link className="btn" href="/auth?mode=signin&role=STRINGER">Sign in as stringer</Link></div></main>;
  if (user.user_role !== 'STRINGER') return <main className="container"><div className="card grid"><h1 className="h2">Stringer portal only</h1><p className="p">This account is set up as a player.</p><div className="inline-actions"><Link className="btn small-btn" href="/auth?mode=signin&role=STRINGER">Open stringer sign in</Link><Link className="btn secondary small-btn" href="/player">Go to player portal</Link></div></div></main>;

  return (
    <main className="container shell premium-shell">
      <section className="hero hero-premium stringer-hero">
        <div className="hero-inner premium-hero-inner">
          <div className="topbar topbar-inline">
            <div className="brand"><div className="brand-mark">SG</div><div><div className="small">Stringer portal</div><strong>{shopName || user.business_name || user.name}</strong></div></div>
            <div className="inline-actions"><Link className="btn secondary small-btn" href="/stringer/settings"><Settings size={16} /> Settings</Link><button className="btn secondary small-btn" onClick={handleLogout}><LogOut size={16} /> Sign out</button></div>
          </div>
          <div className="hero-copy-stack"><span className="kicker">Daily workflow</span><h1 className="h1">Service queue built for fast action.</h1><p className="p lead">Keep the dashboard focused on live jobs. Shop settings live separately.</p></div>
          <div className="hero-summary-grid stringer-summary-grid">
            <div className="summary-card glass-card revenue-card"><span className="small">Wallet</span><strong>{formatMoney(revenueStats.totalBusinessRevenue)}</strong><span className="summary-subtitle">TOTAL BUSINESS REVENUE</span><span className="summary-meta">Combined earnings from digital & manual payments.</span></div>
            <div className="summary-card glass-card revenue-card"><span className="small">Ready to withdraw</span><strong>{formatMoney(revenueStats.digitalFunds)}</strong><span className="summary-subtitle">DIGITAL FUNDS</span><span className="summary-meta">Net amount currently available for transfer.</span><button className="btn small-btn" onClick={withdraw}>Withdraw now</button></div>
            <div className="summary-card glass-card revenue-card"><span className="small">Cash-on-hand</span><strong>{formatMoney(revenueStats.cashOnHand)}</strong><span className="summary-subtitle">MANUAL PAYMENTS</span><span className="summary-meta">Total revenue collected via cash, Venmo, or Zelle.</span><button className="btn secondary small-btn" onClick={() => setMessage('External payment logging is tracked when you mark a job paid outside the app.')}>+ Log external payment</button></div>
          </div>
        </div>
      </section>

      {message ? <div className="notice success">{message}</div> : null}

      <section className="panel-grid stringer-top-grid">
        <div className="card col-8 grid strong section-card section-card-large">
          <div className="topbar"><div className="section-heading"><span className="kicker">Queue overview</span><h2 className="h2">What needs attention today</h2><p className="p section-subtle">{actionCount} active jobs requiring action.</p></div></div>
          <div className="stats premium-queue-stats">
            <div className="stat stat-highlight"><span className="small">Requested</span><strong>{stats.requested}</strong></div>
            <div className="stat"><span className="small">Received</span><strong>{stats.received}</strong></div>
            <div className="stat"><span className="small">In progress</span><strong>{stats.inProgress}</strong></div>
            <div className="stat"><span className="small">Awaiting pick-up</span><strong>{stats.awaitingPickup}</strong></div>
          </div>
        </div>

        <div className="card col-4 grid strong section-card">
          <div className="topbar"><div className="section-heading"><span className="kicker">Drop-off scan</span><h2 className="h2">Scan GlobeTag</h2></div><ScanLine size={18} /></div>
          <input className="input" value={scanTag} onChange={(e) => setScanTag(e.target.value)} placeholder="Enter GlobeTag" />
          <button className="btn" onClick={scanDropoff}>Scan GlobeTag</button>
          <button className="btn secondary" onClick={withdraw}><Wallet size={16} /> Withdraw balance</button>
          {scannedRacquet ? <div className="scan-result-card"><strong>{scannedRacquet.racquet_name || scannedRacquet.tag_id}</strong><span>{scannedRacquet.racquet_model || 'Model not added'}</span><span>Head size: {scannedRacquet.head_size || 'Not added'}</span><span>Grip size: {scannedRacquet.grip_size || 'Not added'}</span><span>Weight: {scannedRacquet.weight || 'Not added'}</span><span>Pattern: {scannedRacquet.string_pattern || 'Not added'}</span><span>Balance: {scannedRacquet.balance || 'Not added'}</span><span>Setup: {getStringSetupSummary(scannedRacquet).setupLabel}</span><span>Tension: {getStringSetupSummary(scannedRacquet).tensionLabel}</span>{scannedHistory.length ? <div className="scan-history-list"><strong className="small">Last 5 jobs</strong>{scannedHistory.slice(0, 5).map((job) => <div key={job.job_id} className="scan-history-item">{jobHistoryLine(job.is_hybrid ? job : { ...scannedRacquet, ...job })}</div>)}</div> : <div className="small">No past string jobs found.</div>}</div> : null}
        </div>
      </section>


      <section className="panel-grid stringer-top-grid">
        <div className="card col-7 grid strong section-card revenue-insights-card"><div className="topbar"><div className="section-heading"><span className="kicker">Business insights</span><h2 className="h2">Active Revenue and Opportunity Tracking</h2></div><BellRing size={18} /></div><div className="stats premium-queue-stats"><div className="stat glow-stat"><span className="small">Stringing Cycles Due</span><strong>{revenueStats.stringingCyclesDue}</strong><span className="summary-meta">Next 14 days</span></div><div className="stat glow-stat"><span className="small">Uncollected Revenue</span><strong>{formatMoney(revenueStats.uncollectedRevenue)}</strong><span className="summary-meta">Aging rack</span></div><div className="stat glow-stat"><span className="small">Pipeline Capital</span><strong>{formatMoney(revenueStats.pipelineCapital)}</strong><span className="summary-meta">Work orders in progress</span></div></div></div>
        <div className="card col-5 grid strong section-card issues-panel"><div className="topbar"><div className="section-heading"><span className="kicker">Exceptions</span><h2 className="h2">Issues & Attention <span className="issue-count">{issueJobs.length}</span></h2><p className="p">Flagged racquets, payment problems, and paused jobs.</p></div><button className="btn small-btn" onClick={() => setMessage('Nudge sent for all open issues.')}>Nudge all</button></div>{issueJobs.length ? <div className="list issue-list">{issueJobs.slice(0, 6).map((job) => <div key={job.job_id} className="issue-row"><div><strong>{job.owner_name || 'Player'}</strong><span>{job.status === 'AWAITING_PLAYER' ? 'Awaiting response' : job.status === 'PAID' ? 'Pickup overdue' : 'Pending payment'}</span></div><button className="btn secondary small-btn" onClick={() => setMessage('Nudge prepared.')}>{job.status === 'AWAITING_PLAYER' ? 'Chat' : 'Nudge'}</button></div>)}</div> : <div className="small">No exceptions right now.</div>}</div>
      </section>

      <section className="card grid strong section-card section-card-large">
        <div className="topbar queue-header-bar"><div className="section-heading"><span className="kicker">Service queue</span><h2 className="h2">Current jobs</h2></div><div className="tabbar premium-tabbar">{tabs.map((tab) => <button key={tab} type="button" className={'tab ' + (activeTab === tab ? 'active' : '')} onClick={() => setActiveTab(tab)}>{tabLabels[tab]} ({tabCounts[tab] || 0})</button>)}</div></div>
        <div className="list premium-job-list">
          {filtered.map((job) => {
            const pricingDraft = getPricingDraft(job); const laborValue = Number(pricingDraft.labor || 0); const stringValue = pricingDraft.customerProvided ? 0 : Number(pricingDraft.stringCost || 0); const totalValue = laborValue + stringValue;
            return <div className="card premium-job-card" key={job.job_id}><div className="row between wrap"><div><div className="small">Job {formatJobCode(job.job_id)}</div><h3 className="h3">{job.owner_name || 'Player'}</h3><div className="small">{getStringSetupSummary(job).setupLabel} • {getStringSetupSummary(job).tensionLabel} • {formatMoney(Number(job.amount_total || 0))}</div></div><StatusPill status={job.status} paymentRequested={Boolean(job.payment_requested_at)} /></div><JobProgressLine status={job.status} /><div className="meta-grid"><StringSetupSummary data={job} compact /><div className="meta-item"><strong>Date</strong>{formatTimeline(job.created_at || job.created_at_server)}</div><div className="meta-item"><strong>Player</strong>{job.owner_name || '—'}</div><div className="meta-item"><strong>Latest saved total</strong>{formatMoney(Number(job.amount_total || 0))}</div><div className="meta-item"><strong>Stringer net</strong>{formatMoney(getStringerNetForJob(job))}</div></div>{job.status === 'AWAITING_PLAYER' ? <div className="notice warn">Flagged and paused. Waiting for player approval or cancellation.</div> : null}{job.approved_to_continue ? <div className="notice success">Approved by player. Continue in queue without re-inspection.</div> : null}{job.flagged_issues?.length ? <div className="small">Issues: {job.flagged_issues.join(', ')}</div> : null}{job.flagged_photo_urls?.length ? <div className="notice warn">Inspection photos available: {job.flagged_photo_urls.join(', ')}</div> : null}
            <div className="inline-actions">{job.status === 'REQUESTED' ? <button className="btn small-btn" onClick={() => confirmDropoff(job.job_id)}>Confirm drop-off</button> : null}{job.status === 'RECEIVED' ? <button className="btn secondary small-btn" onClick={() => setSelectedJob(job)}>Inspect racquet</button> : null}{job.status === 'IN_PROGRESS' ? <button className="btn small-btn" onClick={() => markFinished(job.job_id)}>Finish restring</button> : null}{['REQUESTED', 'RECEIVED', 'AWAITING_PLAYER'].includes(job.status) ? <button className="btn secondary small-btn" onClick={async () => { const reason = window.prompt('Optional cancellation reason', 'Cancelled by stringer') || 'Cancelled by stringer'; await cancelJob(job.job_id, 'STRINGER', reason); setMessage('Job cancelled.'); await refresh(); }}>Cancel job</button> : null}</div>
            {job.status === 'FINISHED' ? <div className="grid" style={{ gap: 10 }}><div className="meta-grid"><div className="meta-item"><strong>Labor</strong>{formatMoney(laborValue)}</div><div className="meta-item"><strong>String cost</strong>{formatMoney(stringValue)}</div><div className="meta-item"><strong>Total</strong>{formatMoney(totalValue)}</div><div className="meta-item"><strong>Ready since</strong>{formatTimeline(job.finished_at)}</div></div><label className="label">Labor price</label><input className="input" type="number" min="0" step="0.01" value={pricingDraft.labor} onChange={(e) => updatePricingDraft(job.job_id, { labor: e.target.value })} /><label className="label">String cost</label><input className="input" type="number" min="0" step="0.01" value={pricingDraft.customerProvided ? '0' : pricingDraft.stringCost} disabled={pricingDraft.customerProvided} onChange={(e) => updatePricingDraft(job.job_id, { stringCost: e.target.value })} /><label className="check-row"><input type="checkbox" checked={pricingDraft.customerProvided} onChange={(e) => updatePricingDraft(job.job_id, { customerProvided: e.target.checked, stringCost: e.target.checked ? '0' : pricingDraft.stringCost })} /><span>Customer provided string</span></label><div className="inline-actions"><button className="btn small-btn" type="button" onClick={() => void sendPaymentRequest(job)} disabled={sendingJobId === job.job_id || Boolean(job.payment_requested_at)}>{job.payment_requested_at ? 'Payment Request Sent' : sendingJobId === job.job_id ? 'Sending…' : `Send Payment Request ${formatMoney(totalValue)}`}</button><button className="btn secondary small-btn" onClick={() => markPaidOutsideApp(job.job_id)}>Mark paid outside app</button></div></div> : null}
            </div>;
          })}
          {filtered.length === 0 ? <div className="small">No jobs in this column yet.</div> : null}
        </div>
      </section>

      <section className="card grid strong section-card section-card-large">
        <div className="topbar"><div className="section-heading"><span className="kicker">Job History</span><h2 className="h2">Completed and cancelled jobs</h2><p className="p section-subtle">History is separate from the live service queue.</p></div></div>
        <div className="list premium-job-list">
          {historyJobs.map((job) => <div className="card premium-job-card" key={job.job_id}><div className="row between wrap"><div><div className="small">Job {formatJobCode(job.job_id)}</div><h3 className="h3">{job.owner_name || 'Player'}</h3><div className="small">{job.status === 'CANCELLED' ? 'Cancelled by ' + String(job.cancelled_by || 'system').toLowerCase() : 'Picked up'}</div></div><StatusPill status={job.status} paymentRequested={Boolean(job.payment_requested_at)} /></div><div className="meta-grid"><StringSetupSummary data={job} compact /><div className="meta-item"><strong>Date</strong>{formatTimeline(job.picked_up_at || job.cancelled_at || job.updated_at || job.created_at)}</div><div className="meta-item"><strong>Reason</strong>{job.cancel_reason || '—'}</div></div></div>)}
          {historyJobs.length === 0 ? <div className="small">No completed or cancelled jobs yet.</div> : null}
        </div>
      </section>

      {selectedJob ? <section className="card grid strong inspection-sheet" style={{ maxWidth: 760 }}><div className="section-heading"><span className="kicker">Inspection</span><h2 className="h2">Job {formatJobCode(selectedJob.job_id)}</h2><p className="p section-subtle">Flag with or without a photo, or move directly into stringing.</p></div><label className="check-row"><input type="checkbox" checked={selectedIssues.includes('Grommet damage')} onChange={(e) => setSelectedIssues((cur) => e.target.checked ? [...cur, 'Grommet damage'] : cur.filter((item) => item !== 'Grommet damage'))} /><span>Grommet damage</span></label><label className="check-row"><input type="checkbox" checked={selectedIssues.includes('Frame damage')} onChange={(e) => setSelectedIssues((cur) => e.target.checked ? [...cur, 'Frame damage'] : cur.filter((item) => item !== 'Frame damage'))} /><span>Frame damage</span></label><input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /><div className="inline-actions"><button className="btn secondary small-btn" onClick={flagRacquet} disabled={!selectedIssues.length}>Flag Racquet</button><button className="btn small-btn" onClick={passAndBeginStringing}>Pass · Begin Stringing</button><button className="btn secondary small-btn" onClick={() => { setSelectedJob(null); setSelectedIssues([]); setFile(null); }}>Close</button></div></section> : null}
    </main>
  );
}

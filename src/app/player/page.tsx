'use client';

import Image from 'next/image';
import Link from 'next/link';
import { History, LogOut, ScanLine, Settings, WalletCards } from 'lucide-react';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { ReadinessBar } from '@/components/ReadinessBar';
import { JobProgressLine } from '@/components/JobProgressLine';
import { logoutUser } from '@/lib/authHelpers';
import {
  addAlert,
  approveFlaggedJob,
  cancelJob,
  createJob,
  formatJobCode,
  getJob,
  listJobsByOwner,
  listRacquetsByOwner,
  markJobPaid,
  markJobPickedUp,
  savePlayerFeedback,
  sendPickupReminderIfNeeded,
} from '@/lib/firestoreData';
import { formatLastStringDate } from '@/lib/health';
import { StringSetupSummary } from '@/components/StringSetupSummary';
import { useEffect, useMemo, useState } from 'react';

function getTimeValue(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatTimeline(value: any) {
  const time = getTimeValue(value);
  if (!time) return '—';
  return new Date(time).toLocaleDateString();
}

function getReadiness(racquet: any, jobs: any[]) {
  const activeJob = jobs.find((job) => job.racquet_id === racquet.racquet_id && !['PICKED_UP', 'CANCELLED'].includes(job.status));
  if (activeJob) {
    if (activeJob.status === 'FINISHED' && activeJob.payment_requested_at) return { percent: 80, statusLabel: 'Awaiting payment' };
    if (activeJob.status === 'PAID') return { percent: 95, statusLabel: 'Awaiting pickup' };
    return { percent: 55, statusLabel: 'In service' };
  }

  if (!racquet?.last_string_date) {
    return { percent: 0, statusLabel: 'No service recorded' };
  }

  const daysSince = Math.floor((Date.now() - new Date(racquet.last_string_date).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince <= 30) return { percent: 100, statusLabel: 'Ready' };
  if (daysSince <= 45) return { percent: 55, statusLabel: 'Due soon' };
  return { percent: 20, statusLabel: 'Needs restringing' };
}

export default function PlayerDashboard() {
  const { user, loading } = useCurrentUser();
  const [racquets, setRacquets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [notice, setNotice] = useState('');
  const [requestingRacquetId, setRequestingRacquetId] = useState('');

  async function refreshData(currentUser = user) {
    if (!currentUser || currentUser.user_role !== 'PLAYER') return;

    const [nextRacquets, nextJobs] = await Promise.all([
      listRacquetsByOwner(currentUser.uid),
      listJobsByOwner(currentUser.uid),
    ]);

    const sortedJobs = nextJobs.sort((a, b) => {
      const aTime = getTimeValue(a.created_at) || getTimeValue(a.created_at_server);
      const bTime = getTimeValue(b.created_at) || getTimeValue(b.created_at_server);
      return bTime - aTime;
    });

    for (const job of sortedJobs) {
      await sendPickupReminderIfNeeded(job);
    }

    setRacquets(nextRacquets);
    setJobs(sortedJobs);
  }

  useEffect(() => {
    if (!user || user.user_role !== 'PLAYER') return;
    void refreshData(user);
    const timer = window.setInterval(() => void refreshData(user), 2500);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user || user.user_role !== 'PLAYER') return;
    const params = new URLSearchParams(window.location.search);
    const paidJobId = params.get('paid');
    if (!paidJobId) return;

    (async () => {
      const job = await getJob(paidJobId);
      if (job && job.owner_uid === user.uid && job.status !== 'PAID') {
        await markJobPaid(paidJobId);
      }
      setNotice(`Payment received for ${formatJobCode(paidJobId)}. Your racquet is now waiting for pickup.`);
      await refreshData(user);
    })();

    window.history.replaceState({}, '', window.location.pathname);
  }, [user]);

  async function handleLogout() {
    await logoutUser();
    window.location.href = '/';
  }

  async function requestFromBag(racquet: any) {
    if (!user) return;
    const openJob = jobs.find((job) => job.racquet_id === racquet.racquet_id && !['PICKED_UP', 'CANCELLED'].includes(job.status));
    if (openJob) {
      setNotice(`An active string job already exists for ${racquet.racquet_name || racquet.tag_id}.`);
      return;
    }

    try {
      setRequestingRacquetId(racquet.racquet_id);
      const job = await createJob({
        racquet_id: racquet.racquet_id,
        owner_uid: user.uid,
        owner_name: user.name,
        shop_id: racquet.preferred_shop_id,
        amount_total: 30,
        status: 'REQUESTED',
        request_source: 'PLAYER_PORTAL',
        requested_at: new Date().toISOString(),
        racquet_name: racquet.racquet_name || '',
        racquet_model: racquet.racquet_model || '',
        preferred_shop_name: racquet.preferred_shop_name || '',
        string_type: racquet.string_type || '',
        tension: racquet.tension || '',
        is_hybrid: Boolean(racquet.is_hybrid),
        hybrid_setup: racquet.hybrid_setup || undefined,
      });

      await addAlert({
        type: 'dropoff_request',
        shop_id: racquet.preferred_shop_id,
        owner_uid: user.uid,
        owner_name: user.name,
        job_id: job.job_id,
        racquet_id: racquet.racquet_id,
        tag_id: racquet.tag_id,
        note: `${racquet.racquet_name || racquet.tag_id} requested from player bag`,
        read: false,
      });

      setNotice(`Restring request sent for ${racquet.racquet_name || racquet.tag_id}.`);
      await refreshData(user);
    } finally {
      setRequestingRacquetId('');
    }
  }

  async function confirmPickup(job: any) {
    await markJobPickedUp(job.job_id);
    setNotice(`Pickup confirmed for ${formatJobCode(job.job_id)}.`);
    await refreshData(user);
  }

  const activeJobs = useMemo(() => {
    const byRacquet = new Map<string, any>();
    for (const job of jobs.filter((item) => !['PICKED_UP', 'CANCELLED'].includes(item.status))) {
      const key = job.racquet_id || job.job_id;
      if (!byRacquet.has(key)) byRacquet.set(key, job);
    }
    return Array.from(byRacquet.values());
  }, [jobs]);
  const historyJobs = useMemo(() => jobs.filter((job) => ['PICKED_UP', 'CANCELLED'].includes(job.status)), [jobs]);
  const readyForPaymentCount = useMemo(() => jobs.filter((job) => Boolean(job.payment_requested_at) && job.status === 'FINISHED').length, [jobs]);
  const requestedReceivedCount = useMemo(() => jobs.filter((job) => ['REQUESTED', 'RECEIVED'].includes(job.status)).length, [jobs]);
  const awaitingResponseCount = useMemo(() => jobs.filter((job) => job.status === 'AWAITING_PLAYER').length, [jobs]);
  const awaitingPickupCount = useMemo(() => jobs.filter((job) => job.status === 'PAID').length, [jobs]);
  const readinessStats = useMemo(() => {
    const ready = racquets.filter((racquet) => getReadiness(racquet, jobs).statusLabel === 'Ready').length;
    return { ready, needsService: Math.max(0, racquets.length - ready) };
  }, [racquets, jobs]);

  if (loading) return <main className="container"><div className="card">Loading your bag…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Player access</h1><p className="p">Sign in to see your racquets, request string jobs, and complete pickup payments.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Sign in as player</Link></div></main>;
  if (user.user_role !== 'PLAYER') return <main className="container"><div className="card grid"><h1 className="h2">Player portal only</h1><p className="p">This account is set up as a stringer. Switch to a player account to manage a bag and racquets.</p><div className="inline-actions"><Link className="btn small-btn" href="/auth?mode=signin&role=PLAYER">Open player sign in</Link><Link className="btn secondary small-btn" href="/stringer">Go to stringer portal</Link></div></div></main>;

  return (
    <main className="container shell premium-shell">
      <section className="hero hero-premium player-hero">
        <div className="hero-inner premium-hero-inner">
          <div className="topbar topbar-inline">
            <div className="brand">
              <div className="brand-mark">SG</div>
              <div>
                <div className="small">Player portal</div>
                <strong>{user.name}</strong>
              </div>
            </div>
            <div className="inline-actions">
              <Link className="btn secondary small-btn" href="/player/settings"><Settings size={16} /> Settings</Link>
              <button className="btn secondary small-btn" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
            </div>
          </div>

          <div className="hero-copy-stack">
            <span className="kicker">Match readiness</span>
            <h1 className="h1">Your racquets. Your full service history.</h1>
            <p className="p lead">Stringers own the workflow. You own the long-term racquet history and readiness view.</p>
          </div>

          <div className="inline-actions hero-actions">
            <Link className="btn small-btn" href="/onboarding"><ScanLine size={16} /> Scan GlobeTag</Link>
            <Link className="btn secondary small-btn" href="#history"><History size={16} /> My Racquet History</Link>
          </div>

          <div className="hero-summary-grid">
            <div className="summary-card glass-card">
              <span className="small">Racquets in bag</span>
              <strong>{racquets.length}</strong>
              <span className="summary-meta">Saved in your player bag</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Match readiness</span>
              <strong>{readinessStats.ready} racquets ready • {readinessStats.needsService} need restringing</strong>
              <span className="summary-meta">Based on last completed string date</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Active jobs</span>
              <strong>{activeJobs.length}</strong>
              <span className="summary-meta">Live jobs across your racquets</span>
            </div>
          </div>
        </div>
      </section>

      {notice ? <div className="notice success">{notice}</div> : null}

      <section className="panel-grid player-dashboard-grid">
        <div className="card col-8 grid strong section-card section-card-large">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Bag</span>
              <h2 className="h2">My racquets</h2>
              <p className="p section-subtle">Status first, then readiness, then setup details.</p>
            </div>
            <Link className="btn secondary small-btn" href="/onboarding">Add racquet</Link>
          </div>

          <div className="list racquet-list-premium">
            {racquets.map((racquet) => {
              const readiness = getReadiness(racquet, jobs);
              const latestJobForRacquet = jobs.find((job) => job.racquet_id === racquet.racquet_id) || null;
              const hasOpenJob = Boolean(latestJobForRacquet && !['PICKED_UP', 'CANCELLED'].includes(latestJobForRacquet.status));
              const showPayNow = latestJobForRacquet?.status === 'FINISHED' && latestJobForRacquet?.payment_requested_at;

              return (
                <div key={racquet.racquet_id} className="card premium-link-card">
                  <div className="racquet-card racquet-card-premium">
                    <div className="racquet-thumb racquet-thumb-premium">
                      <Image src="/racquet-card.svg" alt="Racquet illustration" width={88} height={88} />
                    </div>
                    <div className="grid racquet-copy-grid">
                      <div className="row between wrap racquet-header-row">
                        <div>
                          <div className="small">{racquet.racquet_model || 'Model pending'}</div>
                          <h3 className="h3">{racquet.racquet_name || racquet.tag_id}</h3>
                          <div className="small">GlobeTag {racquet.tag_id}</div>
                        </div>
                        <div className="row wrap racquet-pill-row">
                          {latestJobForRacquet && !['PICKED_UP', 'CANCELLED'].includes(latestJobForRacquet.status) ? <StatusPill status={latestJobForRacquet.status} paymentRequested={Boolean(latestJobForRacquet.payment_requested_at)} /> : latestJobForRacquet?.status === 'CANCELLED' ? <StatusPill status={latestJobForRacquet.status} /> : <span className="small">Ready to play</span>}
                        </div>
                      </div>

                      <ReadinessBar percent={readiness.percent} label={readiness.statusLabel} />

                      <div className="meta-grid">
                        <StringSetupSummary data={racquet} />
                        <div className="meta-item"><strong>Current stringer</strong>{racquet.preferred_shop_name || 'No service recorded yet'}</div>
                        <div className="meta-item"><strong>Last string date</strong>{formatLastStringDate(racquet.last_string_date)}</div>
                      </div>

                      <div className="inline-actions">
                        <Link className="btn secondary small-btn" href={`/player/racquet/${racquet.racquet_id}`}>View Details</Link>
                        {showPayNow ? (
                          <Link className="btn small-btn" href={`/player/payment/${latestJobForRacquet.job_id}`}><WalletCards size={16} /> Pay now</Link>
                        ) : hasOpenJob ? (
                          <Link className="btn small-btn" href={`/player/racquet/${racquet.racquet_id}`}>View Job</Link>
                        ) : (
                          <button className="btn small-btn" onClick={() => requestFromBag(racquet)} disabled={requestingRacquetId === racquet.racquet_id}>
                            {requestingRacquetId === racquet.racquet_id ? 'Requesting…' : 'Request restring'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {racquets.length === 0 ? <div className="small">Your bag is empty.</div> : null}
          </div>
        </div>

        <div className="card col-4 grid strong section-card side-stack-card">
          <div className="section-heading">
            <span className="kicker">Current timeline</span>
            <h2 className="h2">At a glance</h2>
            <p className="p section-subtle">Clear player actions only.</p>
          </div>
          <div className="stat"><span className="small">Ready for payment</span><strong>{readyForPaymentCount}</strong></div>
          <div className="stat"><span className="small">Requested / Received</span><strong>{requestedReceivedCount}</strong></div>
          <div className="stat"><span className="small">Flagged / Awaiting Your Response</span><strong>{awaitingResponseCount}</strong></div>
          <div className="stat"><span className="small">Awaiting Pickup</span><strong>{awaitingPickupCount}</strong></div>
        </div>
      </section>

      <section className="card grid strong section-card section-card-large" id="jobs">
        <div className="topbar"><div className="section-heading"><span className="kicker">Active orders</span><h2 className="h2">Current jobs</h2></div></div>
        <div className="list premium-job-list">
          {activeJobs.map((job) => {
            const racquet = racquets.find((item) => item.racquet_id === job.racquet_id) || job;
            const showReminder = job.status === 'PAID' && !job.pickup_confirmed && Date.now() - getTimeValue(job.paid_at || job.updated_at || job.created_at) >= 2 * 24 * 60 * 60 * 1000;
            const canCancel = ['REQUESTED', 'RECEIVED', 'AWAITING_PLAYER'].includes(job.status);
            return (
              <div className="card premium-job-card" key={job.job_id}>
                <div className="row between wrap">
                  <div>
                    <div className="small">Job {formatJobCode(job.job_id)}</div>
                    <h3 className="h3">{racquet?.racquet_name || racquet?.tag_id || 'Racquet'}</h3>
                    <div className="small">{job.is_hybrid ? `${job.hybrid_setup?.mains_string || 'No main string'} / ${job.hybrid_setup?.crosses_string || 'No cross string'} • ${job.hybrid_setup?.mains_tension || 'No main tension'} / ${job.hybrid_setup?.crosses_tension || 'No cross tension'}` : `${job.string_type || racquet?.string_type || 'No saved setup'} • ${job.tension || racquet?.tension || 'No tension saved'}`}</div>
                  </div>
                  <StatusPill status={job.status} paymentRequested={Boolean(job.payment_requested_at)} />
                </div>

                <JobProgressLine status={job.status} playerView />
                {job.flagged_issues?.length ? <div className="notice warn">Issue found: {job.flagged_issues.join(', ')}. This job is paused until you approve or cancel it.</div> : null}
                {job.inspection_note ? <div className="notice warn">Stringer note: {job.inspection_note}</div> : null}
                {job.flagged_photo_urls?.length ? <div className="notice warn">Inspection photo(s): {job.flagged_photo_urls.join(', ')}</div> : null}
                {showReminder ? <div className="notice warn">Reminder: your racquet has been waiting for pickup for 2+ days.</div> : null}

                <div className="meta-grid">
                  <StringSetupSummary data={job.is_hybrid ? job : racquet} compact />
                  <div className="meta-item"><strong>Date requested</strong>{formatTimeline(job.requested_at || job.created_at)}</div>
                  <div className="meta-item"><strong>Current Stringer</strong>{job.preferred_shop_name || racquet?.preferred_shop_name || '—'}</div>
                </div>

                <div className="inline-actions">
                  <Link className="btn secondary small-btn" href={`/player/racquet/${job.racquet_id}`}>View Job</Link>
                  {job.status === 'FINISHED' && job.payment_requested_at ? <Link className="btn small-btn" href={`/player/payment/${job.job_id}`}><WalletCards size={16} /> Pay now</Link> : null}
                  {job.status === 'PAID' && !job.pickup_confirmed ? <button className="btn small-btn" onClick={() => confirmPickup(job)}>Confirm pickup</button> : null}
                  {job.status === 'AWAITING_PLAYER' ? <button className="btn small-btn" onClick={async () => { await approveFlaggedJob(job.job_id); setNotice('Approved. The stringer can now continue.'); await refreshData(user); }}>Approve & continue</button> : null}
                  {canCancel ? <button className="btn secondary small-btn" onClick={async () => { const reason = window.prompt('Optional cancellation reason', 'Cancelled by player') || 'Cancelled by player'; await cancelJob(job.job_id, 'PLAYER', reason); setNotice('Job cancelled.'); await refreshData(user); }}>Cancel job</button> : null}
                </div>
              </div>
            );
          })}
          {activeJobs.length === 0 ? (
            <div className="grid" style={{ gap: 12 }}>
              <div className="small">No active jobs yet. Request a restring to get started.</div>
              <div className="inline-actions"><Link className="btn small-btn" href="/onboarding">Request restring</Link></div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card grid strong section-card section-card-large" id="history">
        <div className="topbar"><div className="section-heading"><span className="kicker">My Racquet History</span><h2 className="h2">Timeline of past string jobs</h2></div></div>
        <div className="list premium-job-list">
          {historyJobs.map((job) => {
            const racquet = racquets.find((item) => item.racquet_id === job.racquet_id) || job;
            return (
              <div className="card premium-job-card" key={job.job_id}>
                <div className="row between wrap">
                  <div>
                    <div className="small">{formatTimeline(job.picked_up_at || job.cancelled_at || job.updated_at || job.created_at)}</div>
                    <h3 className="h3">{racquet?.racquet_name || racquet?.tag_id || 'Racquet'}</h3>
                    <div className="small">{job.preferred_shop_name || racquet?.preferred_shop_name || 'Stringer not recorded'}</div>
                  </div>
                  <StatusPill status={job.status} paymentRequested={Boolean(job.payment_requested_at)} />
                </div>
                <JobProgressLine status={job.status === 'CANCELLED' ? 'REQUESTED' : job.status} playerView />
                <div className="meta-grid"><StringSetupSummary data={job.is_hybrid ? job : racquet} compact /></div>
                {job.status === 'PICKED_UP' && !job.player_feedback ? (
                  <div className="inline-actions">
                    <span className="small">How did it feel?</span>
                    <button className="btn secondary small-btn" onClick={async () => { await savePlayerFeedback(job.job_id, 'TOO_TIGHT'); await refreshData(user); }}>Too tight</button>
                    <button className="btn secondary small-btn" onClick={async () => { await savePlayerFeedback(job.job_id, 'PERFECT'); await refreshData(user); }}>Perfect</button>
                    <button className="btn secondary small-btn" onClick={async () => { await savePlayerFeedback(job.job_id, 'TOO_LOOSE'); await refreshData(user); }}>Too loose</button>
                  </div>
                ) : null}
                {job.player_feedback ? <div className="small">Feedback: {String(job.player_feedback).replaceAll('_', ' ').toLowerCase()}</div> : null}
                {job.status === 'CANCELLED' ? <div className="notice warn">Cancelled by {String(job.cancelled_by || 'system').toLowerCase()}{job.cancel_reason ? `: ${job.cancel_reason}` : ''}</div> : null}
              </div>
            );
          })}
          {historyJobs.length === 0 ? <div className="small">No racquet history yet.</div> : null}
        </div>
      </section>
    </main>
  );
}

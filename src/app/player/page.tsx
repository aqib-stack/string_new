'use client';

import Image from 'next/image';
import Link from 'next/link';
import { History, LogOut, ScanLine, WalletCards } from 'lucide-react';
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
import { formatLastStringDate, getRacquetHealth } from '@/lib/health';
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

function racquetSetupLabel(racquet: any) {
  if (racquet?.is_hybrid && racquet?.hybrid_setup) {
    return `${racquet.hybrid_setup.mains_string || 'Mains'} / ${racquet.hybrid_setup.crosses_string || 'Crosses'}`;
  }
  return racquet?.string_type || 'No service recorded yet';
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

  const activeJobs = useMemo(() => jobs.filter((job) => !['PICKED_UP', 'CANCELLED'].includes(job.status)), [jobs]);
  const actionableJobs = useMemo(() => jobs.filter((job) => ['REQUESTED', 'RECEIVED', 'AWAITING_PLAYER'].includes(job.status)), [jobs]);
  const historyJobs = useMemo(() => jobs.filter((job) => ['PICKED_UP', 'CANCELLED'].includes(job.status)), [jobs]);
  const readyCount = useMemo(() => racquets.filter((racquet) => ['Fresh', 'Optimal'].includes(getRacquetHealth(racquet.last_string_date).statusLabel)).length, [racquets]);
  const needsServiceCount = Math.max(0, racquets.length - readyCount);
  const requestedReceivedCount = jobs.filter((job) => ['REQUESTED', 'RECEIVED'].includes(job.status)).length;
  const awaitingResponseCount = jobs.filter((job) => job.status === 'AWAITING_PLAYER').length;
  const awaitingPickupCount = jobs.filter((job) => job.status === 'PAID').length;
  const attentionCount = requestedReceivedCount + awaitingResponseCount;

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
            <button className="btn secondary small-btn" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
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
              <strong>{readyCount} racquets ready • {needsServiceCount} need restringing</strong>
              <span className="summary-meta">A quick high-level status check</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Active jobs</span>
              <strong>{actionableJobs.length}</strong>
              <span className="summary-meta">Jobs needing attention now</span>
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
              const health = getRacquetHealth(racquet.last_string_date);
              const latestJobForRacquet = jobs.find((job) => job.racquet_id === racquet.racquet_id) || null;
              const hasOpenJob = Boolean(latestJobForRacquet && !['PICKED_UP', 'CANCELLED'].includes(latestJobForRacquet.status));

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
                          {latestJobForRacquet ? <StatusPill status={latestJobForRacquet.status} /> : <span className="small">Ready to play</span>}
                        </div>
                      </div>

                      <ReadinessBar percent={health.percent} label={health.statusLabel} />

                      <div className="meta-grid">
                        <div className="meta-item"><strong>String setup</strong>{racquetSetupLabel(racquet)}</div>
                        <div className="meta-item"><strong>Tension</strong>{racquet.is_hybrid ? 'Hybrid setup' : (racquet.tension || 'No service recorded yet')}</div>
                        <div className="meta-item"><strong>Current Stringer</strong>{racquet.preferred_shop_name || 'No service recorded yet'}</div>
                        <div className="meta-item"><strong>Last string date</strong>{formatLastStringDate(racquet.last_string_date)}</div>
                      </div>

                      <div className="inline-actions">
                        <Link className="btn secondary small-btn" href={`/player/racquet/${racquet.racquet_id}`}>View Details</Link>
                        {hasOpenJob ? (
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
            <h2 className="h2">Jobs needing attention</h2>
            <p className="p section-subtle">{attentionCount} {attentionCount === 1 ? 'job needs' : 'jobs need'} attention today.</p>
          </div>
          <div className="stat"><span className="small">Requested / Received</span><strong>{requestedReceivedCount}</strong></div>
          <div className="stat"><span className="small">Awaiting your response</span><strong>{awaitingResponseCount}</strong></div>
          <div className="stat"><span className="small">Awaiting pickup</span><strong>{awaitingPickupCount}</strong></div>
        </div>
      </section>

      <section className="card grid strong section-card section-card-large" id="jobs">
        <div className="topbar"><div className="section-heading"><span className="kicker">Active orders</span><h2 className="h2">Current jobs</h2></div></div>
        <div className="list premium-job-list">
          {activeJobs.map((job) => {
            const racquet = racquets.find((item) => item.racquet_id === job.racquet_id);
            const showReminder = job.status === 'PAID' && !job.pickup_confirmed && Date.now() - getTimeValue(job.paid_at || job.updated_at || job.created_at) >= 2 * 24 * 60 * 60 * 1000;
            const canCancel = ['REQUESTED', 'RECEIVED', 'AWAITING_PLAYER'].includes(job.status);
            return (
              <div className="card premium-job-card" key={job.job_id}>
                <div className="row between wrap">
                  <div>
                    <div className="small">Job {formatJobCode(job.job_id)}</div>
                    <h3 className="h3">{racquet?.racquet_name || racquet?.tag_id || 'Racquet'}</h3>
                    <div className="small">{racquetSetupLabel(racquet)} • {racquet?.is_hybrid ? 'Hybrid' : (racquet?.tension || '—')}</div>
                  </div>
                  <StatusPill status={job.status} />
                </div>

                <JobProgressLine status={job.status} />
                {job.flagged_issues?.length ? <div className="notice warn">Issue found: {job.flagged_issues.join(', ')}. This job is paused until you approve or cancel it.</div> : null}
                {job.inspection_note ? <div className="notice warn">Stringer note: {job.inspection_note}</div> : null}
                {showReminder ? <div className="notice warn">Reminder: your racquet has been waiting for pickup for 2+ days.</div> : null}

                <div className="meta-grid">
                  <div className="meta-item"><strong>Date requested</strong>{formatTimeline(job.requested_at || job.created_at)}</div>
                  <div className="meta-item"><strong>Drop-off</strong>{formatTimeline(job.dropped_off_at)}</div>
                  <div className="meta-item"><strong>Ready</strong>{job.finished_at ? formatTimeline(job.finished_at) : 'Not ready yet'}</div>
                  <div className="meta-item"><strong>Current Stringer</strong>{racquet?.preferred_shop_name || '—'}</div>
                </div>

                <div className="inline-actions">
                  <Link className="btn secondary small-btn" href={`/player/racquet/${job.racquet_id}`}>View Job</Link>
                  {job.status === 'FINISHED' ? <Link className="btn small-btn" href={`/player/payment/${job.job_id}`}><WalletCards size={16} /> Pay now</Link> : null}
                  {job.status === 'PAID' && !job.pickup_confirmed ? <button className="btn small-btn" onClick={() => confirmPickup(job)}>Confirm pickup</button> : null}
                  {job.status === 'AWAITING_PLAYER' ? <button className="btn small-btn" onClick={async () => { await approveFlaggedJob(job.job_id); setNotice('Approved. The stringer can now continue.'); await refreshData(user); }}>Approve & continue</button> : null}
                  {canCancel ? <button className="btn secondary small-btn" onClick={async () => { await cancelJob(job.job_id, 'PLAYER', 'Cancelled by player'); setNotice('Job cancelled.'); await refreshData(user); }}>Cancel job</button> : null}
                </div>
              </div>
            );
          })}
          {activeJobs.length === 0 ? <div className="small">No active jobs right now.</div> : null}
        </div>
      </section>

      <section className="card grid strong section-card section-card-large" id="history">
        <div className="topbar"><div className="section-heading"><span className="kicker">My Racquet History</span><h2 className="h2">Timeline of past string jobs</h2></div></div>
        <div className="list premium-job-list">
          {historyJobs.map((job) => {
            const racquet = racquets.find((item) => item.racquet_id === job.racquet_id);
            return (
              <div className="card premium-job-card" key={job.job_id}>
                <div className="row between wrap">
                  <div>
                    <div className="small">{formatTimeline(job.picked_up_at || job.cancelled_at || job.updated_at || job.created_at)}</div>
                    <h3 className="h3">{racquet?.racquet_name || racquet?.tag_id || 'Racquet'}</h3>
                    <div className="small">{racquetSetupLabel(racquet)} • {racquet?.is_hybrid ? 'Hybrid setup' : (racquet?.tension || '—')} • {racquet?.preferred_shop_name || 'Stringer not recorded'}</div>
                  </div>
                  <StatusPill status={job.status} />
                </div>
                <JobProgressLine status={job.status === 'CANCELLED' ? 'REQUESTED' : job.status} />
                {job.status === 'PICKED_UP' && !job.player_feedback ? (
                  <div className="inline-actions">
                    <span className="small">How did it feel?</span>
                    <button className="btn secondary small-btn" onClick={async () => { await savePlayerFeedback(job.job_id, 'TOO_TIGHT'); await refreshData(user); }}>Too tight</button>
                    <button className="btn secondary small-btn" onClick={async () => { await savePlayerFeedback(job.job_id, 'PERFECT'); await refreshData(user); }}>Perfect</button>
                    <button className="btn secondary small-btn" onClick={async () => { await savePlayerFeedback(job.job_id, 'TOO_LOOSE'); await refreshData(user); }}>Too loose</button>
                  </div>
                ) : null}
                {job.player_feedback ? <div className="small">Feedback: {String(job.player_feedback).replaceAll('_', ' ').toLowerCase()}</div> : null}
                {job.status === 'CANCELLED' ? <div className="small">Cancelled by {String(job.cancelled_by || 'system').toLowerCase()}.</div> : null}
              </div>
            );
          })}
          {historyJobs.length === 0 ? <div className="small">No racquet history yet.</div> : null}
        </div>
      </section>
    </main>
  );
}

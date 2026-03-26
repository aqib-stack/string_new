'use client';

import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { clearDemoUser } from '@/lib/demoAuth';
import { clearDemoData, formatJobCode, getJob, getLatestJobForRacquet, listJobsByOwner, listRacquetsByOwner, markJobPaid } from '@/lib/demoData';
import { formatLastStringDate, getRacquetHealth } from '@/lib/health';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PlayerDashboard() {
  const { user, loading } = useCurrentUser();
  const [racquets, setRacquets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [notice, setNotice] = useState('');

  function refreshData(currentUser = user) {
    if (!currentUser || currentUser.user_role !== 'PLAYER') return;
    setRacquets(listRacquetsByOwner(currentUser.uid));
    setJobs(listJobsByOwner(currentUser.uid).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
  }

  useEffect(() => {
    if (!user || user.user_role !== 'PLAYER') return;
    refreshData(user);

    const onStorage = () => refreshData(user);
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(() => refreshData(user), 1200);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user || user.user_role !== 'PLAYER') return;
    const params = new URLSearchParams(window.location.search);
    const paidJobId = params.get('paid');
    if (!paidJobId) return;

    const job = getJob(paidJobId);
    if (job && job.owner_uid === user.uid && job.status !== 'PAID') {
      markJobPaid(paidJobId);
    }

    setNotice(`Payment received for job ${formatJobCode(paidJobId)}. 🎉 Racquet ready for pickup and the stringer wallet is now ready for withdrawal.`);
    refreshData(user);

    window.history.replaceState({}, '', window.location.pathname);
  }, [user]);

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
          <h1 className="h2">Player portal</h1>
          <p className="p">Please log in as a player to track your racquet and pay for finished jobs.</p>
          <Link className="btn" href="/auth?next=/player">Log in as player</Link>
        </div>
      </main>
    );
  }

  if (user.user_role !== 'PLAYER') {
    return (
      <main className="container">
        <div className="card grid">
          <h1 className="h2">Player portal only</h1>
          <p className="p">This area is only for players. Your current session is signed in as a stringer.</p>
          <div className="row wrap">
            <Link className="btn" href="/auth?next=/player">Switch to player</Link>
            <Link className="btn secondary" href="/stringer">Go to stringer portal</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container grid">
      <div className="card grid">
        <span className="kicker">Player</span>
        <h1 className="h2">Welcome, {user.name}</h1>
        <p className="p">After login you can see each racquet status, open the racquet data, check health, edit strings and tension, and request restring when needed.</p>
        <div className="row wrap">
          <Link className="btn secondary" href="/scan/demo-tag-001">Scan another tag</Link>
          <button className="btn ghost" onClick={resetDemo}>Reset demo data</button>
        </div>
        {notice ? <div className="notice success">{notice}</div> : null}
      </div>

      <div className="card grid">
        <div className="row between">
          <h2 className="h2">My racquets</h2>
          <span className="small">{racquets.length} total</span>
        </div>
        <div className="list">
          {racquets.map((racquet) => {
            const health = getRacquetHealth(racquet.last_string_date);
            const latestJob = getLatestJobForRacquet(racquet.racquet_id);
            return (
              <Link className="card link-card" key={racquet.racquet_id} href={`/player/racquet/${racquet.racquet_id}`}>
                <div className="row between">
                  <strong>{racquet.tag_id}</strong>
                  <span className={`badge ${health.tone}`}>{health.statusLabel}</span>
                </div>
                <div className="small">{racquet.string_type} · {racquet.tension}</div>
                <div className="small">Restrung {racquet.restring_count || 0} times · Last string date: {formatLastStringDate(racquet.last_string_date)}</div>
                <div className="row between">
                  <span className="small">Tap to see racquet health and edit setup</span>
                  {latestJob ? <StatusPill status={latestJob.status} /> : <span className="small">No active job</span>}
                </div>
              </Link>
            );
          })}
          {racquets.length === 0 ? <div className="small">No racquets yet. Scan a GlobeTag to add one.</div> : null}
        </div>
      </div>

      <div className="card grid">
        <div className="row between">
          <h2 className="h2">Active jobs</h2>
          <span className="small">{jobs.length} total</span>
        </div>
        <div className="list">
          {jobs.map((job) => (
            <div className="card grid" key={job.job_id}>
              <div className="row between">
                <strong>Job {formatJobCode(job.job_id)}</strong>
                <StatusPill status={job.status} />
              </div>
              <div className="small">Total: ${Number(job.amount_total || 30).toFixed(2)}</div>
              {job.status === 'RECEIVED' ? <div className="small">Your racquet has been dropped off and is waiting in the stringer queue.</div> : null}
              {job.status === 'IN_PROGRESS' ? <div className="small">The stringer is currently inspecting or restringing this racquet.</div> : null}
              {job.status === 'FINISHED' ? <div className="notice">Ready for payment. Pay now before pickup.</div> : null}
              {job.status === 'PAID' ? <div className="notice success">Payment complete. 🎉 Racquet ready for pickup.</div> : null}
              {job.status === 'FINISHED' ? (
                <Link className="btn" href={`/player/payment/${job.job_id}`}>Pay now</Link>
              ) : null}
            </div>
          ))}
          {jobs.length === 0 ? <div className="small">No jobs yet. Scan a GlobeTag to create one.</div> : null}
        </div>
      </div>
    </main>
  );
}

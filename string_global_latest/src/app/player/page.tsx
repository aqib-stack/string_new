'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, Plus, WalletCards } from 'lucide-react';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { logoutUser } from '@/lib/authHelpers';
import { formatJobCode, getLatestJobForRacquet, getJob, listJobsByOwner, listRacquetsByOwner, markJobPaid } from '@/lib/demoData';
import { formatLastStringDate, getRacquetHealth } from '@/lib/health';
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
    setNotice(`Payment received for ${formatJobCode(paidJobId)}. Your racquet is now ready for pickup.`);
    refreshData(user);
    window.history.replaceState({}, '', window.location.pathname);
  }, [user]);

  async function handleLogout() {
    await logoutUser();
    window.location.href = '/';
  }

  if (loading) return <main className="container"><div className="card">Loading your bag…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Player access</h1><p className="p">Sign in to see your racquets, request string jobs, and complete pickup payments.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Sign in as player</Link></div></main>;
  if (user.user_role !== 'PLAYER') return <main className="container"><div className="card grid"><h1 className="h2">Player portal only</h1><p className="p">This account is set up as a stringer. Switch to a player account to manage a bag and racquets.</p><div className="inline-actions"><Link className="btn small-btn" href="/auth?mode=signin&role=PLAYER">Open player sign in</Link><Link className="btn secondary small-btn" href="/stringer">Go to stringer portal</Link></div></div></main>;

  return (
    <main className="container shell">
      <section className="hero">
        <div className="hero-media" style={{ backgroundImage: 'url(/hero-racquet.svg)' }} />
        <div className="hero-inner">
          <div className="topbar">
            <div className="brand"><div className="brand-mark">SG</div><div><div className="small">Player portal</div><strong>{user.name}</strong></div></div>
            <button className="btn secondary small-btn" onClick={handleLogout}><LogOut size={16} /> Sign out</button>
          </div>
          <span className="kicker">My bag</span>
          <h1 className="h1">Your racquets. Always match-ready.</h1>
          <p className="p">Scan a GlobeTag to add a new racquet to your bag. When service is needed, request a string job and track each update through pickup.</p>
          <div className="inline-actions">
            <Link className="btn small-btn" href="/onboarding"><Plus size={16} /> Scan GlobeTag</Link>
            <Link className="btn secondary small-btn" href="#jobs"><WalletCards size={16} /> View active jobs</Link>
          </div>
        </div>
      </section>

      {notice ? <div className="notice success">{notice}</div> : null}

      <section className="panel-grid">
        <div className="card col-8 grid strong">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Bag</span>
              <h2 className="h2">My bag</h2>
            </div>
            <Link className="btn secondary small-btn" href="/onboarding">Add racquet</Link>
          </div>

          {racquets.length === 0 ? (
            <div className="grid" style={{ justifyItems: 'start' }}>
              <Image className="empty-illustration" src="/bag-empty.svg" alt="Empty racquet bag illustration" width={340} height={255} />
              <div className="section-heading">
                <h3 className="h3">Your bag is empty</h3>
                <p className="p">Scan your GlobeTag to add your first racquet. Once it&apos;s in your bag, you&apos;ll be able to edit setup, track health, and request service.</p>
              </div>
              <Link className="btn small-btn" href="/onboarding">Scan your first racquet</Link>
            </div>
          ) : (
            <div className="list">
              {racquets.map((racquet) => {
                const health = getRacquetHealth(racquet.last_string_date);
                return (
                  <Link key={racquet.racquet_id} className="card link-card" href={`/player/racquet/${racquet.racquet_id}`}>
                    <div className="racquet-card">
                      <div className="racquet-thumb">
                        <Image src="/racquet-card.svg" alt="Racquet illustration" width={88} height={88} />
                      </div>
                      <div className="grid">
                        <div className="row between wrap">
                          <div>
                            <div className="small">GlobeTag</div>
                            <h3 className="h3">{racquet.tag_id}</h3>
                          </div>
                          <div className={`badge ${health.tone}`}>{health.statusLabel}</div>
                        </div>
                        <div className="meta-grid">
                          <div className="meta-item"><strong>Strings</strong>{racquet.string_type}</div>
                          <div className="meta-item"><strong>Tension</strong>{racquet.tension}</div>
                          <div className="meta-item"><strong>Restring count</strong>{racquet.restring_count || 0}</div>
                          <div className="meta-item"><strong>Last string date</strong>{formatLastStringDate(racquet.last_string_date)}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card col-4 grid">
          <span className="kicker">Overview</span>
          <h2 className="h2">At a glance</h2>
          <div className="stats" style={{ gridTemplateColumns: '1fr' }}>
            <div className="stat"><span className="small">Racquets in bag</span><strong>{racquets.length}</strong></div>
            <div className="stat"><span className="small">Open jobs</span><strong>{jobs.filter((job) => job.status !== 'PAID').length}</strong></div>
            <div className="stat"><span className="small">Ready for payment</span><strong>{jobs.filter((job) => job.status === 'FINISHED').length}</strong></div>
          </div>
        </div>
      </section>

      <section id="jobs" className="card grid strong">
        <div className="topbar">
          <div className="section-heading">
            <span className="kicker">String jobs</span>
            <h2 className="h2">Live service updates</h2>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="small">No jobs yet. Once you request a string job, it will appear here with live status updates.</div>
        ) : (
          <div className="list">
            {jobs.map((job) => (
              <div className="card" key={job.job_id}>
                <div className="row between wrap">
                  <div>
                    <div className="small">Job {formatJobCode(job.job_id)}</div>
                    <h3 className="h3">{job.status === 'PAID' ? 'Paid · ready for pickup' : job.status.replaceAll('_', ' ')}</h3>
                  </div>
                  <StatusPill status={job.status} />
                </div>
                <div className="progress-line">
                  {['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID'].map((step) => (
                    <div key={step} className={`progress-step ${['REQUESTED','RECEIVED','IN_PROGRESS','FINISHED','PAID'].indexOf(job.status) >= ['REQUESTED','RECEIVED','IN_PROGRESS','FINISHED','PAID'].indexOf(step) ? 'active' : ''}`} />
                  ))}
                </div>
                <div className="small">Shop: Central Court Tennis Lab • Total: ${Number(job.amount_total || 30).toFixed(2)}</div>
                {job.status === 'FINISHED' ? <div className="notice">Your racquet is finished. Complete payment to release pickup.</div> : null}
                {job.status === 'PAID' ? <div className="notice success">Payment completed successfully. Your racquet is ready for pickup.</div> : null}
                <div className="inline-actions">
                  {job.status === 'FINISHED' ? <Link className="btn small-btn" href={`/player/payment/${job.job_id}`}>Pay now</Link> : null}
                  <Link className="btn secondary small-btn" href={`/player/racquet/${job.racquet_id}`}>View racquet</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

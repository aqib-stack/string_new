'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BellRing, Clock3, LogOut, ScanLine, Sparkles, WalletCards } from 'lucide-react';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { logoutUser } from '@/lib/authHelpers';
import { formatJobCode, getJob, listJobsByOwner, listRacquetsByOwner, markJobPaid } from '@/lib/firestoreData';
import { formatLastStringDate, getRacquetHealth } from '@/lib/health';
import { useEffect, useMemo, useState } from 'react';

const steps = ['REQUESTED', 'RECEIVED', 'IN_PROGRESS', 'FINISHED', 'PAID'] as const;
const stepLabels: Record<(typeof steps)[number], string> = {
  REQUESTED: 'Requested',
  RECEIVED: 'Dropped off',
  IN_PROGRESS: 'On machine',
  FINISHED: 'Finished',
  PAID: 'Paid',
};

export default function PlayerDashboard() {
  const { user, loading } = useCurrentUser();
  const [racquets, setRacquets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [notice, setNotice] = useState('');

  async function refreshData(currentUser = user) {
    if (!currentUser || currentUser.user_role !== 'PLAYER') return;
    const [nextRacquets, nextJobs] = await Promise.all([
      listRacquetsByOwner(currentUser.uid),
      listJobsByOwner(currentUser.uid),
    ]);
    setRacquets(nextRacquets);
    setJobs(
  nextJobs.sort((a, b) =>
    (a.createdAt?.seconds || 0) < (b.createdAt?.seconds || 0) ? 1 : -1
  )
);
  }

  useEffect(() => {
    if (!user || user.user_role !== 'PLAYER') return;
    void refreshData(user);
    const timer = window.setInterval(() => { void refreshData(user); }, 2500);
    return () => {
      window.clearInterval(timer);
    };
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
      setNotice(`Payment received for ${formatJobCode(paidJobId)}. Your racquet is now ready for pickup.`);
      await refreshData(user);
    })();
    window.history.replaceState({}, '', window.location.pathname);
  }, [user]);

  async function handleLogout() {
    await logoutUser();
    window.location.href = '/';
  }

  const openJobs = useMemo(() => jobs.filter((job) => job.status !== 'PAID'), [jobs]);
  const readyForPayment = useMemo(() => jobs.filter((job) => job.status === 'FINISHED'), [jobs]);
  const activeJob = jobs[0] || null;
  const activeRacquet = activeJob ? racquets.find((racquet) => racquet.racquet_id === activeJob.racquet_id) : racquets[0] || null;
  const activeHealth = getRacquetHealth(activeRacquet?.last_string_date);
  const latestServiceText = activeRacquet ? formatLastStringDate(activeRacquet.last_string_date) : 'Not set yet';

  if (loading) return <main className="container"><div className="card">Loading your bag…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Player access</h1><p className="p">Sign in to see your racquets, request string jobs, and complete pickup payments.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Sign in as player</Link></div></main>;
  if (user.user_role !== 'PLAYER') return <main className="container"><div className="card grid"><h1 className="h2">Player portal only</h1><p className="p">This account is set up as a stringer. Switch to a player account to manage a bag and racquets.</p><div className="inline-actions"><Link className="btn small-btn" href="/auth?mode=signin&role=PLAYER">Open player sign in</Link><Link className="btn secondary small-btn" href="/stringer">Go to stringer portal</Link></div></div></main>;

  return (
    <main className="container shell premium-shell">
      <section className="hero hero-premium player-hero">
        <div className="hero-media hero-media-photo">
          <Image className="hero-racquet-photo" src="/hero-real-racquet.svg" alt="Premium tennis racquet" width={520} height={520} priority />
        </div>
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
            <span className="kicker">Match-day ready</span>
            <h1 className="h1">Your racquets. Premium tracking from scan to pickup.</h1>
            <p className="p lead">Keep your setup dialed in, request service in seconds, and watch every status update move from scan to payment with a cleaner pro-shop experience.</p>
          </div>

          <div className="inline-actions hero-actions">
            <Link className="btn small-btn" href="/onboarding"><ScanLine size={16} /> Scan GlobeTag</Link>
            <Link className="btn secondary small-btn" href="#jobs"><WalletCards size={16} /> View active jobs</Link>
          </div>

          <div className="hero-summary-grid">
            <div className="summary-card glass-card">
              <span className="small">Racquets in bag</span>
              <strong>{racquets.length}</strong>
              <span className="summary-meta">Saved with your preferred string setup</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Open jobs</span>
              <strong>{openJobs.length}</strong>
              <span className="summary-meta">Live updates from your stringer queue</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Latest service</span>
              <strong>{latestServiceText}</strong>
              <span className="summary-meta">Your last completed restring date</span>
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
              <h2 className="h2">My bag</h2>
              <p className="p section-subtle">Premium racquet cards keep your current setup, restring count, and health status easy to read at a glance.</p>
            </div>
            <Link className="btn secondary small-btn" href="/onboarding">Add racquet</Link>
          </div>

          {racquets.length === 0 ? (
            <div className="empty-state-grid">
              <Image className="empty-illustration" src="/bag-empty.svg" alt="Empty racquet bag illustration" width={340} height={255} />
              <div className="section-heading">
                <h3 className="h3">Your bag is empty</h3>
                <p className="p">Scan your GlobeTag to add your first racquet. Once it&apos;s in your bag, you&apos;ll be able to edit setup, track health, and request service.</p>
              </div>
              <Link className="btn small-btn" href="/onboarding">Scan your first racquet</Link>
            </div>
          ) : (
            <div className="list racquet-list-premium">
              {racquets.map((racquet) => {
                const health = getRacquetHealth(racquet.last_string_date);
                const latestJobForRacquet = jobs.find((job) => job.racquet_id === racquet.racquet_id) || null;
                return (
                  <Link key={racquet.racquet_id} className="card link-card premium-link-card" href={`/player/racquet/${racquet.racquet_id}`}>
                    <div className="racquet-card racquet-card-premium">
                      <div className="racquet-thumb racquet-thumb-premium">
                        <Image src="/racquet-card.svg" alt="Racquet illustration" width={88} height={88} />
                      </div>
                      <div className="grid racquet-copy-grid">
                        <div className="row between wrap racquet-header-row">
                          <div>
                            <div className="small">GlobeTag</div>
                            <h3 className="h3">{racquet.tag_id}</h3>
                          </div>
                          <div className="row wrap racquet-pill-row">
                            <div className={`badge ${health.tone}`}>{health.statusLabel}</div>
                            {latestJobForRacquet ? <StatusPill status={latestJobForRacquet.status} /> : null}
                          </div>
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

        <div className="card col-4 grid strong section-card side-stack-card">
          <span className="kicker">Overview</span>
          <h2 className="h2">At a glance</h2>
          <div className="stats stats-single premium-stats-list">
            <div className="stat stat-highlight"><span className="small">Open jobs</span><strong>{openJobs.length}</strong><span className="summary-meta">Currently in the pro-shop workflow</span></div>
            <div className="stat"><span className="small">Ready for payment</span><strong>{readyForPayment.length}</strong><span className="summary-meta">Jobs waiting on your checkout</span></div>
            <div className="stat"><span className="small">Bag health</span><strong>{activeHealth.statusLabel}</strong><span className="summary-meta">Based on your latest recorded restring</span></div>
          </div>
        </div>
      </section>

      <section id="jobs" className="panel-grid player-job-grid">
        <div className="card col-7 grid strong section-card section-card-large">
          <div className="topbar">
            <div className="section-heading">
              <span className="kicker">Active service</span>
              <h2 className="h2">Current job timeline</h2>
              <p className="p section-subtle">A cleaner stepper shows exactly where your racquet is in the restring flow right now.</p>
            </div>
            {activeJob ? <StatusPill status={activeJob.status} /> : null}
          </div>

          {activeJob ? (
            <div className="job-highlight-shell">
              <div className="job-highlight-top">
                <div>
                  <div className="small">Latest job</div>
                  <h3 className="h3">{formatJobCode(activeJob.job_id)}</h3>
                </div>
                <div className="job-highlight-meta">
                  <span><Clock3 size={15} /> Live status updates</span>
                  <span><BellRing size={15} /> Pickup-ready alerts</span>
                </div>
              </div>
              <div className="stepper-row">
                {steps.map((step) => {
                  const isActive = steps.indexOf(activeJob.status) >= steps.indexOf(step);
                  const isCurrent = activeJob.status === step;
                  return (
                    <div key={step} className={`stepper-node ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}>
                      <div className="stepper-dot" />
                      <span>{stepLabels[step]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="job-highlight-footer">
                <div className="small">Shop: Central Court Tennis Lab • Total: ${Number(activeJob.amount_total || 30).toFixed(2)}</div>
                <Link className="inline-link" href={`/player/racquet/${activeJob.racquet_id}`}>Open racquet details <ArrowRight size={15} /></Link>
              </div>
            </div>
          ) : (
            <div className="empty-job-panel">
              <Sparkles size={18} />
              <div>
                <h3 className="h3">No active job right now</h3>
                <p className="p">Scan any racquet already in your bag to create a request and kick off the premium service flow.</p>
              </div>
            </div>
          )}
        </div>

        <div className="card col-5 grid strong section-card">
          <div className="section-heading">
            <span className="kicker">Quick actions</span>
            <h2 className="h2">Scan, request, pay</h2>
          </div>
          <div className="quick-action-stack">
            <Link className="quick-action-card" href="/onboarding">
              <div className="quick-action-icon"><ScanLine size={18} /></div>
              <div>
                <strong>Scan a GlobeTag</strong>
                <span>Add a new racquet or turn an existing one into a live job request.</span>
              </div>
            </Link>
            <Link className="quick-action-card" href={activeJob ? `/player/racquet/${activeJob.racquet_id}` : '/player'}>
              <div className="quick-action-icon"><Sparkles size={18} /></div>
              <div>
                <strong>Review active service</strong>
                <span>Open the latest racquet card and follow the job through every queue state.</span>
              </div>
            </Link>
            {readyForPayment[0] ? (
              <Link className="quick-action-card quick-action-card-accent" href={`/player/payment/${readyForPayment[0].job_id}`}>
                <div className="quick-action-icon"><WalletCards size={18} /></div>
                <div>
                  <strong>Complete pickup payment</strong>
                  <span>Release your finished racquet and move the job into the paid column.</span>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card grid strong section-card section-card-large">
        <div className="topbar">
          <div className="section-heading">
            <span className="kicker">String jobs</span>
            <h2 className="h2">Live service updates</h2>
            <p className="p section-subtle">Every job uses the same premium visual language so the player and stringer portals stay in sync.</p>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="small">No jobs yet. Once you request a string job, it will appear here with live status updates.</div>
        ) : (
          <div className="list premium-job-list">
            {jobs.map((job) => {
              const progressIndex = steps.indexOf(job.status as (typeof steps)[number]);
              return (
                <div className="card premium-job-card" key={job.job_id}>
                  <div className="row between wrap">
                    <div>
                      <div className="small">Job {formatJobCode(job.job_id)}</div>
                      <h3 className="h3">{job.status === 'PAID' ? 'Paid · ready for pickup' : stepLabels[job.status as (typeof steps)[number]] || job.status.replaceAll('_', ' ')}</h3>
                    </div>
                    <StatusPill status={job.status} />
                  </div>
                  <div className="progress-line progress-line-premium">
                    {steps.map((step, index) => (
                      <div key={step} className={`progress-step ${progressIndex >= index ? 'active' : ''}`} />
                    ))}
                  </div>
                  <div className="job-meta-grid">
                    <div className="small">Shop: Central Court Tennis Lab</div>
                    <div className="small">Total: ${Number(job.amount_total || 30).toFixed(2)}</div>
                  </div>
                  {job.status === 'FINISHED' ? <div className="notice">Your racquet is finished. Complete payment to release pickup.</div> : null}
                  {job.status === 'PAID' ? <div className="notice success">Payment completed successfully. Your racquet is ready for pickup.</div> : null}
                  <div className="inline-actions">
                    {job.status === 'FINISHED' ? <Link className="btn small-btn" href={`/player/payment/${job.job_id}`}>Pay now</Link> : null}
                    <Link className="btn secondary small-btn" href={`/player/racquet/${job.racquet_id}`}>View racquet</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

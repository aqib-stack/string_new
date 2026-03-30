'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, History, LogOut, ScanLine, WalletCards } from 'lucide-react';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { logoutUser } from '@/lib/authHelpers';
import { formatJobCode, getJob, listJobsByOwner, listRacquetsByOwner, markJobPaid } from '@/lib/firestoreData';
import { formatLastStringDate, getRacquetHealth } from '@/lib/health';
import { useEffect, useMemo, useState } from 'react';

function getTimeValue(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

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
      nextJobs.sort((a, b) => {
        const aTime = getTimeValue(a.created_at) || getTimeValue(a.created_at_server);
        const bTime = getTimeValue(b.created_at) || getTimeValue(b.created_at_server);
        return bTime - aTime;
      })
    );
  }

  useEffect(() => {
    if (!user || user.user_role !== 'PLAYER') return;
    void refreshData(user);
    const timer = window.setInterval(() => { void refreshData(user); }, 2500);
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
      setNotice(`Payment received for ${formatJobCode(paidJobId)}. Your racquet is now waiting for pickup confirmation.`);
      await refreshData(user);
    })();
    window.history.replaceState({}, '', window.location.pathname);
  }, [user]);

  async function handleLogout() {
    await logoutUser();
    window.location.href = '/';
  }

  const activeJobs = useMemo(() => jobs.filter((job) => job.status !== 'PICKED_UP'), [jobs]);
  const historyJobs = useMemo(() => jobs.filter((job) => job.status === 'PICKED_UP'), [jobs]);
  const readyForPayment = useMemo(() => jobs.filter((job) => job.status === 'FINISHED'), [jobs]);
  const activeJob = activeJobs[0] || null;
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
            <h1 className="h1">Your racquets. Premium tracking from drop-off to pickup.</h1>
            <p className="p lead">Save racquet name, model, preferred stringer, and follow every job until payment and pickup are fully complete.</p>
          </div>

          <div className="inline-actions hero-actions">
            <Link className="btn small-btn" href="/onboarding"><ScanLine size={16} /> Scan GlobeTag</Link>
            <Link className="btn secondary small-btn" href="#history"><History size={16} /> View history</Link>
          </div>

          <div className="hero-summary-grid">
            <div className="summary-card glass-card">
              <span className="small">Racquets in bag</span>
              <strong>{racquets.length}</strong>
              <span className="summary-meta">Saved with your preferred setup and shop</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Active jobs</span>
              <strong>{activeJobs.length}</strong>
              <span className="summary-meta">Paid jobs stay active until pickup</span>
            </div>
            <div className="summary-card glass-card">
              <span className="small">Latest service</span>
              <strong>{latestServiceText}</strong>
              <span className="summary-meta">{activeHealth.statusLabel}</span>
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
              <p className="p section-subtle">Each racquet now includes racquet name, model, saved setup, and preferred stringer details.</p>
            </div>
            <Link className="btn secondary small-btn" href="/onboarding">Add racquet</Link>
          </div>

          {racquets.length === 0 ? (
            <div className="empty-state-grid">
              <Image className="empty-illustration" src="/bag-empty.svg" alt="Empty racquet bag illustration" width={340} height={255} />
              <div className="section-heading">
                <h3 className="h3">Your bag is empty</h3>
                <p className="p">Scan your GlobeTag to add your first racquet with its name, model, and saved setup.</p>
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
                            <div className="small">{racquet.racquet_model || 'Model pending'}</div>
                            <h3 className="h3">{racquet.racquet_name || racquet.tag_id}</h3>
                            <div className="small">GlobeTag {racquet.tag_id}</div>
                          </div>
                          <div className="row wrap racquet-pill-row">
                            <div className={`badge ${health.tone}`}>{health.statusLabel}</div>
                            {latestJobForRacquet ? <StatusPill status={latestJobForRacquet.status} /> : null}
                          </div>
                        </div>
                        <div className="meta-grid">
                          <div className="meta-item"><strong>Strings</strong>{racquet.string_type}</div>
                          <div className="meta-item"><strong>Tension</strong>{racquet.tension}</div>
                          <div className="meta-item"><strong>Preferred shop</strong>{racquet.preferred_shop_name || 'Not selected'}</div>
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
          <div className="section-heading">
            <span className="kicker">Queue summary</span>
            <h2 className="h2">Current timeline</h2>
          </div>
          <div className="stat"><span className="small">Ready for payment</span><strong>{readyForPayment.length}</strong></div>
          <div className="stat"><span className="small">Awaiting pickup</span><strong>{activeJobs.filter((job) => job.status === 'PAID').length}</strong></div>
          <div className="stat"><span className="small">Order history</span><strong>{historyJobs.length}</strong></div>
          {activeJob ? <div className="notice">Current focus: {formatJobCode(activeJob.job_id)} for {activeRacquet?.racquet_name || activeRacquet?.tag_id || 'your racquet'}.</div> : <div className="small">No active jobs right now.</div>}
          <Link className="btn small-btn" href={activeJob ? `/player/racquet/${activeJob.racquet_id}` : '/onboarding'}>{activeJob ? 'Open active racquet' : 'Add a racquet'} <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="card grid strong section-card section-card-large" id="jobs">
        <div className="topbar">
          <div className="section-heading">
            <span className="kicker">Active orders</span>
            <h2 className="h2">Current jobs</h2>
          </div>
        </div>
        <div className="list premium-job-list">
          {activeJobs.map((job) => {
            const racquet = racquets.find((item) => item.racquet_id === job.racquet_id);
            return (
              <div className="card premium-job-card" key={job.job_id}>
                <div className="row between wrap">
                  <div>
                    <div className="small">Job {formatJobCode(job.job_id)}</div>
                    <h3 className="h3">{racquet?.racquet_name || racquet?.tag_id || 'Racquet'}</h3>
                    <div className="small">{racquet?.racquet_model || 'Model pending'} • {job.proof_photo_url ? `Proof photo: ${job.proof_photo_url}` : 'No proof photo'}</div>
                  </div>
                  <StatusPill status={job.status} />
                </div>
                {job.inspection_note ? <div className="notice warn">Stringer note: {job.inspection_note}</div> : null}
                {job.status === 'PAID' ? <div className="notice success">Paid successfully. This job stays here until the stringer confirms pickup.</div> : null}
                <div className="inline-actions">
                  <Link className="btn secondary small-btn" href={`/player/racquet/${job.racquet_id}`}>Open racquet</Link>
                  {job.status === 'FINISHED' ? <Link className="btn small-btn" href={`/player/payment/${job.job_id}`}><WalletCards size={16} /> Pay now</Link> : null}
                </div>
              </div>
            );
          })}
          {activeJobs.length === 0 ? <div className="small">No active jobs right now.</div> : null}
        </div>
      </section>

      <section className="card grid strong section-card section-card-large" id="history">
        <div className="topbar">
          <div className="section-heading">
            <span className="kicker">Order history</span>
            <h2 className="h2">Completed pickups</h2>
          </div>
        </div>
        <div className="list premium-job-list">
          {historyJobs.map((job) => {
            const racquet = racquets.find((item) => item.racquet_id === job.racquet_id);
            return (
              <div className="card premium-job-card" key={job.job_id}>
                <div className="row between wrap">
                  <div>
                    <div className="small">Job {formatJobCode(job.job_id)}</div>
                    <h3 className="h3">{racquet?.racquet_name || racquet?.tag_id || 'Racquet'}</h3>
                    <div className="small">Picked up {formatLastStringDate(job.picked_up_at || job.updated_at || job.created_at)}</div>
                  </div>
                  <StatusPill status={job.status} />
                </div>
              </div>
            );
          })}
          {historyJobs.length === 0 ? <div className="small">No pickup history yet.</div> : null}
        </div>
      </section>
    </main>
  );
}

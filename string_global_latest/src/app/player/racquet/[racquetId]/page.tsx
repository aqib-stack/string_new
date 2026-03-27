'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { addAlert, createJob, formatJobCode, getLatestJobForRacquet, getOpenJobForRacquet, getRacquetById, updateRacquet } from '@/lib/demoData';
import { formatLastStringDate, getRacquetHealth } from '@/lib/health';

export default function PlayerRacquetDetailPage({ params }: { params: Promise<{ racquetId: string }> }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [racquetId, setRacquetId] = useState('');
  const [racquet, setRacquet] = useState<any | null>(null);
  const [stringType, setStringType] = useState('');
  const [tension, setTension] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function refresh(id = racquetId) {
    if (!id) return;
    const nextRacquet = getRacquetById(id);
    setRacquet(nextRacquet);
    setStringType(nextRacquet?.string_type || '');
    setTension(nextRacquet?.tension || '');
  }

  useEffect(() => {
    params.then(({ racquetId }) => {
      setRacquetId(racquetId);
      const nextRacquet = getRacquetById(racquetId);
      setRacquet(nextRacquet);
      setStringType(nextRacquet?.string_type || '');
      setTension(nextRacquet?.tension || '');
    });
  }, [params]);

  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(() => refresh(), 1200);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [racquetId]);

  const latestJob = useMemo(() => (racquet ? getLatestJobForRacquet(racquet.racquet_id) : null), [racquet]);
  const openJob = useMemo(() => (racquet ? getOpenJobForRacquet(racquet.racquet_id) : null), [racquet]);
  const health = getRacquetHealth(racquet?.last_string_date);

  async function saveSetup() {
    if (!racquet) return;
    setSaving(true);
    updateRacquet(racquet.racquet_id, { string_type: stringType, tension });
    setEditing(false);
    setMessage('Racquet setup updated successfully.');
    refresh();
    setSaving(false);
  }

  function requestStringJob() {
    if (!user || !racquet) return;
    if (openJob) {
      setMessage(`An active string job already exists: ${formatJobCode(openJob.job_id)}.`);
      return;
    }
    const job = createJob({
      racquet_id: racquet.racquet_id,
      owner_uid: user.uid,
      owner_name: user.name,
      shop_id: 'demo-shop-1',
      amount_total: 30,
      status: 'REQUESTED',
      request_source: 'PLAYER_PORTAL',
    });
    addAlert({
      type: 'dropoff_request',
      shop_id: 'demo-shop-1',
      job_id: job.job_id,
      racquet_id: racquet.racquet_id,
      tag_id: racquet.tag_id,
      owner_name: user.name,
      created_at: new Date().toISOString(),
      read: false,
    });
    setMessage('String job requested. Your pro shop stringer has been notified about the drop-off.');
    refresh();
  }

  const primaryAction = useMemo(() => {
    if (!latestJob) return { type: 'button' as const, label: 'Request string job', disabled: false };
    switch (latestJob.status) {
      case 'REQUESTED':
        return { type: 'button' as const, label: 'Drop-off requested', disabled: true };
      case 'RECEIVED':
        return { type: 'button' as const, label: 'At pro shop', disabled: true };
      case 'IN_PROGRESS':
        return { type: 'button' as const, label: 'In progress', disabled: true };
      case 'FINISHED':
        return { type: 'link' as const, label: 'Ready for payment', href: `/player/payment/${latestJob.job_id}` };
      case 'PAID':
        return { type: 'button' as const, label: 'Paid · ready for pickup', disabled: true };
      default:
        return { type: 'button' as const, label: 'Request string job', disabled: false };
    }
  }, [latestJob]);

  if (loading) return <main className="container"><div className="card">Loading racquet…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Player access</h1><p className="p">Sign in to manage racquet setup, health, and string jobs.</p><Link className="btn" href={`/auth?mode=signin&role=PLAYER&next=${encodeURIComponent(`/player/racquet/${racquetId}`)}`}>Sign in</Link></div></main>;
  if (user.user_role !== 'PLAYER') return <main className="container"><div className="card grid"><h1 className="h2">Player portal only</h1><p className="p">This account is configured as a stringer. Use a player account to view racquet details.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Open player sign in</Link></div></main>;
  if (!racquet || racquet.owner_uid !== user.uid) return <main className="container"><div className="card grid"><h1 className="h2">Racquet not found</h1><p className="p">We couldn&apos;t find this GlobeTag in the current player bag.</p><Link className="btn" href="/player">Back to player portal</Link></div></main>;

  return (
    <main className="container shell">
      <section className="panel-grid">
        <div className="card col-7 grid strong">
          <div className="racquet-card">
            <div className="racquet-thumb"><Image src="/racquet-card.svg" alt="Racquet illustration" width={96} height={96} /></div>
            <div className="grid">
              <div className="row between wrap">
                <div>
                  <span className="kicker">Racquet in bag</span>
                  <h1 className="h2">{racquet.tag_id}</h1>
                </div>
                <div className={`badge ${health.tone}`}>{health.statusLabel}</div>
              </div>
              <p className="p">Review your string setup, check overall racquet health, and request service whenever you need a fresh restring.</p>
            </div>
          </div>
          {message ? <div className="notice success">{message}</div> : null}
          <div className="meta-grid">
            <div className="meta-item"><strong>Racquet ID</strong>{racquet.racquet_id}</div>
            <div className="meta-item"><strong>Owner UID</strong>{racquet.owner_uid}</div>
            <div className="meta-item"><strong>Tag ID</strong>{racquet.tag_id}</div>
            <div className="meta-item"><strong>Restring count</strong>{racquet.restring_count || 0}</div>
            <div className="meta-item"><strong>Last string date</strong>{formatLastStringDate(racquet.last_string_date)}</div>
            <div className="meta-item"><strong>Health</strong>{health.statusLabel}</div>
          </div>
        </div>

        <div className="card col-5 grid">
          <span className="kicker">Current service</span>
          <div className="row between wrap">
            <h2 className="h2">String job status</h2>
            {latestJob ? <StatusPill status={latestJob.status} /> : <span className="small">No active job</span>}
          </div>
          {latestJob ? <div className="small">Latest job: {formatJobCode(latestJob.job_id)}</div> : <div className="small">This racquet is in your bag and ready whenever you need service.</div>}
          {latestJob?.status === 'REQUESTED' ? <div className="notice">Drop-off requested. Your stringer has already been notified.</div> : null}
          {latestJob?.status === 'RECEIVED' ? <div className="notice">The racquet is at the pro shop and waiting in the queue.</div> : null}
          {latestJob?.status === 'IN_PROGRESS' ? <div className="notice">The stringer is actively inspecting or restringing this racquet.</div> : null}
          {latestJob?.status === 'FINISHED' ? <div className="notice">This job is complete and waiting for payment before pickup.</div> : null}
          {latestJob?.status === 'PAID' ? <div className="notice success">Paid successfully. Your racquet is ready for pickup.</div> : null}
          <div className="inline-actions">
            {primaryAction.type === 'link' ? (
              <Link className="btn small-btn" href={primaryAction.href}>{primaryAction.label}</Link>
            ) : (
              <button className="btn small-btn" onClick={requestStringJob} disabled={primaryAction.disabled}>{primaryAction.label}</button>
            )}
            <button className="btn secondary small-btn" onClick={() => router.push('/player')}>Back to portal</button>
          </div>
        </div>
      </section>

      <section className="card grid strong" style={{ maxWidth: 760 }}>
        <div className="topbar">
          <div className="section-heading"><span className="kicker">String setup</span><h2 className="h2">Saved preferences</h2></div>
          {!editing ? <button className="btn secondary small-btn" onClick={() => setEditing(true)}>Edit setup</button> : null}
        </div>
        {editing ? (
          <div className="grid">
            <div>
              <label className="label">String type</label>
              <input className="input" value={stringType} onChange={(e) => setStringType(e.target.value)} />
            </div>
            <div>
              <label className="label">Tension</label>
              <input className="input" value={tension} onChange={(e) => setTension(e.target.value)} />
            </div>
            <div className="inline-actions">
              <button className="btn small-btn" onClick={() => void saveSetup()} disabled={saving}>{saving ? 'Saving…' : 'Save setup'}</button>
              <button className="btn secondary small-btn" onClick={() => { setEditing(false); setStringType(racquet.string_type); setTension(racquet.tension); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="meta-grid">
            <div className="meta-item"><strong>String type</strong>{racquet.string_type}</div>
            <div className="meta-item"><strong>Tension</strong>{racquet.tension}</div>
          </div>
        )}
      </section>
    </main>
  );
}

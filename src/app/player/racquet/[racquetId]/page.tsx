'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import { createJob, formatJobCode, getLatestJobForRacquet, getOpenJobForRacquet, getRacquetById, updateRacquet } from '@/lib/demoData';
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

  async function requestRestring() {
    if (!user || !racquet) return;
    if (openJob) {
      setMessage(`An active job already exists for this racquet: ${formatJobCode(openJob.job_id)}.`);
      return;
    }
    createJob({
      racquet_id: racquet.racquet_id,
      owner_uid: user.uid,
      owner_name: user.name,
      shop_id: 'demo-shop-1',
      amount_total: 30,
    });
    setMessage('Restring request created. Your racquet status is now visible in the player and stringer portals.');
    refresh();
  }

  if (loading) return <main className="container"><div className="card">Loading...</div></main>;

  if (!user) {
    return (
      <main className="container">
        <div className="card grid">
          <h1 className="h2">Player racquet details</h1>
          <p className="p">Please log in as a player to view your racquet data.</p>
          <Link className="btn" href={`/auth?next=${encodeURIComponent(`/player/racquet/${racquetId}`)}`}>Log in as player</Link>
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
            <Link className="btn" href={`/auth?next=${encodeURIComponent(`/player/racquet/${racquetId}`)}`}>Switch to player</Link>
            <Link className="btn secondary" href="/stringer">Go to stringer portal</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!racquet || racquet.owner_uid !== user.uid) {
    return (
      <main className="container">
        <div className="card grid">
          <h1 className="h2">Racquet not found</h1>
          <p className="p">We could not find this racquet in the current player account.</p>
          <Link className="btn" href="/player">Back to player portal</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container grid">
      <div className="card grid">
        <div className="row between wrap">
          <div>
            <span className="kicker">Racquet details</span>
            <h1 className="h2">{racquet.tag_id}</h1>
          </div>
          <div className={`badge ${health.tone}`}>{health.statusLabel}</div>
        </div>
        <p className="p">See racquet health, view the saved racquet data, edit strings and tension, and tap Request Restring when needed.</p>
        {message ? <div className="notice success">{message}</div> : null}
        <div className="meta-grid">
          <div className="meta-item"><strong>Racquet ID</strong>{racquet.racquet_id}</div>
          <div className="meta-item"><strong>Owner UID</strong>{racquet.owner_uid}</div>
          <div className="meta-item"><strong>Tag ID</strong>{racquet.tag_id}</div>
          <div className="meta-item"><strong>Restring Count</strong>{racquet.restring_count || 0}</div>
          <div className="meta-item"><strong>Last String Date</strong>{formatLastStringDate(racquet.last_string_date)}</div>
          <div className="meta-item"><strong>Racquet Health</strong>{health.statusLabel}</div>
        </div>
      </div>

      <div className="card grid">
        <div className="row between wrap">
          <h2 className="h2">String setup</h2>
          {!editing ? <button className="btn secondary" style={{ width: 'auto' }} onClick={() => setEditing(true)}>Edit strings + tension</button> : null}
        </div>

        {editing ? (
          <>
            <div>
              <label className="label">String type</label>
              <input className="input" value={stringType} onChange={(e) => setStringType(e.target.value)} />
            </div>
            <div>
              <label className="label">Tension</label>
              <input className="input" value={tension} onChange={(e) => setTension(e.target.value)} />
            </div>
            <div className="row wrap">
              <button className="btn" onClick={() => void saveSetup()} disabled={saving}>{saving ? 'Saving...' : 'Save racquet setup'}</button>
              <button className="btn secondary" onClick={() => { setEditing(false); setStringType(racquet.string_type); setTension(racquet.tension); }}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="meta-grid">
            <div className="meta-item"><strong>String Type</strong>{racquet.string_type}</div>
            <div className="meta-item"><strong>Tension</strong>{racquet.tension}</div>
          </div>
        )}
      </div>

      <div className="card grid">
        <div className="row between wrap">
          <h2 className="h2">Racquet status</h2>
          {latestJob ? <StatusPill status={latestJob.status} /> : <span className="small">No job yet</span>}
        </div>
        {latestJob ? (
          <>
            <div className="small">Latest job: {formatJobCode(latestJob.job_id)}</div>
            {latestJob.status === 'FINISHED' ? <div className="notice">This racquet is finished and waiting for payment before pickup.</div> : null}
            {latestJob.status === 'PAID' ? <div className="notice success">This racquet has been paid and is ready for pickup.</div> : null}
          </>
        ) : (
          <div className="small">No restring job has been created yet for this racquet.</div>
        )}

        <div className="row wrap">
          <button className="btn" onClick={() => void requestRestring()}>Tap “Request Restring”</button>
          {openJob?.status === 'FINISHED' ? <Link className="btn secondary" href={`/player/payment/${openJob.job_id}`}>Pay now</Link> : null}
          <button className="btn secondary" onClick={() => router.push('/player')}>Back to player portal</button>
        </div>
      </div>
    </main>
  );
}

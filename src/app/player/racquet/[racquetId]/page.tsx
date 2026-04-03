'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/components/RoleGate';
import { StatusPill } from '@/components/StatusPill';
import {
  addAlert,
  createJob,
  formatJobCode,
  getLatestJobForRacquet,
  getOpenJobForRacquet,
  getRacquetById,
  listShops,
  markJobPickedUp,
  updateRacquet,
} from '@/lib/firestoreData';
import { formatLastStringDate, getRacquetHealth } from '@/lib/health';
import { SHARED_SHOP_ID } from '@/lib/appConstants';

const STRING_TYPES = ['Poly Tour Pro', 'RPM Blast', 'ALU Power', 'Synthetic Gut', 'Natural Gut', 'Hybrid Setup'];
const TENSION_OPTIONS = ['45 lbs', '48 lbs', '50 lbs', '52 lbs', '54 lbs', '56 lbs', '58 lbs', '60 lbs'];

export default function PlayerRacquetDetailPage({ params }: { params: Promise<{ racquetId: string }> }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [racquetId, setRacquetId] = useState('');
  const [racquet, setRacquet] = useState<any | null>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [racquetName, setRacquetName] = useState('');
  const [racquetModel, setRacquetModel] = useState('');
  const [stringType, setStringType] = useState('Poly Tour Pro');
  const [tension, setTension] = useState('52 lbs');
  const [preferredShopId, setPreferredShopId] = useState(SHARED_SHOP_ID);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [latestJob, setLatestJob] = useState<any | null>(null);
  const [openJob, setOpenJob] = useState<any | null>(null);

  async function refresh(id = racquetId) {
    if (!id) return;
    const [nextRacquet, nextShops] = await Promise.all([getRacquetById(id), listShops()]);
    setRacquet(nextRacquet);
    setShops(nextShops);
    setRacquetName(nextRacquet?.racquet_name || '');
    setRacquetModel(nextRacquet?.racquet_model || '');
    setStringType(nextRacquet?.string_type || 'Poly Tour Pro');
    setTension(nextRacquet?.tension || '52 lbs');
    setPreferredShopId(nextRacquet?.preferred_shop_id || SHARED_SHOP_ID);
    if (nextRacquet?.racquet_id) {
      setLatestJob(await getLatestJobForRacquet(nextRacquet.racquet_id));
      setOpenJob(await getOpenJobForRacquet(nextRacquet.racquet_id));
    }
  }

  useEffect(() => {
    params.then(({ racquetId }) => {
      setRacquetId(racquetId);
      void refresh(racquetId);
    });
  }, [params]);

  useEffect(() => {
    if (!racquetId) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [racquetId]);

  const health = getRacquetHealth(racquet?.last_string_date);
  const preferredShop = shops.find((shop) => shop.shop_id === preferredShopId) || shops[0] || null;

  async function saveSetup() {
    if (!racquet) return;
    setSaving(true);
    await updateRacquet(racquet.racquet_id, {
      racquet_name: racquetName,
      racquet_model: racquetModel,
      string_type: stringType,
      tension,
      preferred_shop_id: preferredShop?.shop_id || SHARED_SHOP_ID,
      preferred_shop_name: preferredShop?.name || 'Preferred shop',
    });
    setEditing(false);
    setMessage('Racquet setup updated successfully.');
    await refresh();
    setSaving(false);
  }

  async function requestStringJob() {
    if (!user || !racquet) return;
    if (openJob && openJob.status !== 'PICKED_UP') {
      setMessage(`An active string job already exists: ${formatJobCode(openJob.job_id)}.`);
      return;
    }
    const shopId = preferredShop?.shop_id || racquet.preferred_shop_id || SHARED_SHOP_ID;
    const shopName = preferredShop?.name || racquet.preferred_shop_name || 'Preferred shop';
    const job = await createJob({
      racquet_id: racquet.racquet_id,
      owner_uid: user.uid,
      owner_name: user.name,
      shop_id: shopId,
      amount_total: 30,
      status: 'REQUESTED',
      request_source: 'PLAYER_PORTAL',
      proof_photo_url: proofFile ? proofFile.name : '',
    });
    await updateRacquet(racquet.racquet_id, {
      string_type: stringType,
      tension,
      racquet_name: racquetName || racquet.racquet_name,
      racquet_model: racquetModel || racquet.racquet_model,
      preferred_shop_id: shopId,
      preferred_shop_name: shopName,
    });
    await addAlert({
      type: 'dropoff_request',
      shop_id: shopId,
      job_id: job.job_id,
      racquet_id: racquet.racquet_id,
      tag_id: racquet.tag_id,
      owner_name: user.name,
      note: proofFile ? `Proof photo attached: ${proofFile.name}` : '',
      created_at: new Date().toISOString(),
      read: false,
    });
    setMessage('String job requested. Your preferred stringer has been notified.');
    setProofFile(null);
    await refresh();
  }

  async function confirmPickup() {
    if (!latestJob) return;
    await markJobPickedUp(latestJob.job_id);
    setMessage(`Pickup confirmed for ${formatJobCode(latestJob.job_id)}.`);
    await refresh();
  }

  const primaryAction = useMemo(() => {
    if (!latestJob || latestJob.status === 'PICKED_UP') {
      return { type: 'button' as const, label: 'Request string job', disabled: false };
    }

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
        return { type: 'button' as const, label: 'Paid · awaiting pickup', disabled: true };
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
                  <h1 className="h2">{racquet.racquet_name || racquet.tag_id}</h1>
                  <div className="small">{racquet.racquet_model || 'Model not added yet'} • GlobeTag {racquet.tag_id}</div>
                </div>
                <div className={`badge ${health.tone}`}>{health.statusLabel}</div>
              </div>
              <p className="p">Review your string setup, preferred shop, and live order status before you request service.</p>
            </div>
          </div>
          {message ? <div className="notice success">{message}</div> : null}
          <div className="meta-grid">
            <div className="meta-item"><strong>Racquet name</strong>{racquet.racquet_name || 'Not set'}</div>
            <div className="meta-item"><strong>Racquet model</strong>{racquet.racquet_model || 'Not set'}</div>
            <div className="meta-item"><strong>Preferred shop</strong>{racquet.preferred_shop_name || 'Not selected'}</div>
            <div className="meta-item"><strong>Restring count</strong>{racquet.restring_count || 0}</div>
            <div className="meta-item"><strong>Last string date</strong>{formatLastStringDate(racquet.last_string_date)}</div>
            <div className="meta-item"><strong>Health</strong>{health.statusLabel}</div>
          </div>
        </div>

        <div className="card col-5 grid">
          <span className="kicker">Current service</span>
          <div className="row between wrap">
            <h2 className="h2">String job status</h2>
            {latestJob && latestJob.status !== 'PICKED_UP' ? <StatusPill status={latestJob.status} /> : <span className="small">No active job</span>}
          </div>
          {latestJob ? <div className="small">Latest job: {formatJobCode(latestJob.job_id)}</div> : <div className="small">This racquet is ready whenever you need service.</div>}
          {latestJob?.inspection_note ? <div className="notice warn">Stringer note: {latestJob.inspection_note}</div> : null}
          {latestJob?.status === 'REQUESTED' ? <div className="notice">Drop-off requested. Your stringer has already been notified.</div> : null}
          {latestJob?.status === 'RECEIVED' ? <div className="notice">The racquet is at the pro shop and has been checked in.</div> : null}
          {latestJob?.status === 'IN_PROGRESS' ? <div className="notice">The stringer has completed inspection and is now working on this racquet.</div> : null}
          {latestJob?.status === 'FINISHED' ? <div className="notice">This job is complete and waiting for payment before pickup.</div> : null}
          {latestJob?.status === 'PAID' ? <div className="notice success">Paid successfully. Please confirm pickup once you collect the racquet.</div> : null}
          {latestJob?.status === 'PICKED_UP' ? <div className="notice success">Picked up successfully. This order now lives in your history.</div> : null}
          <div className="inline-actions">
            {primaryAction.type === 'link' ? (
              <Link className="btn small-btn" href={primaryAction.href}>{primaryAction.label}</Link>
            ) : (
              <button className="btn small-btn" onClick={requestStringJob} disabled={primaryAction.disabled}>{primaryAction.label}</button>
            )}
            {latestJob?.status === 'PAID' && !latestJob?.pickup_confirmed ? (
              <button className="btn small-btn" onClick={confirmPickup}>Confirm pickup</button>
            ) : null}
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
              <label className="label">Racquet name</label>
              <input className="input" value={racquetName} onChange={(e) => setRacquetName(e.target.value)} placeholder="Match racquet" />
            </div>
            <div>
              <label className="label">Racquet model</label>
              <input className="input" value={racquetModel} onChange={(e) => setRacquetModel(e.target.value)} placeholder="Blade 98 v8" />
            </div>
            <div>
              <label className="label">String type</label>
              <select className="input" value={stringType} onChange={(e) => setStringType(e.target.value)}>
                {STRING_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tension</label>
              <select className="input" value={tension} onChange={(e) => setTension(e.target.value)}>
                {TENSION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Preferred stringer / shop</label>
              <select className="input" value={preferredShopId} onChange={(e) => setPreferredShopId(e.target.value)}>
                {shops.map((shop) => <option key={shop.shop_id} value={shop.shop_id}>{shop.name}{shop.city ? ` • ${shop.city}` : ''}</option>)}
              </select>
            </div>
            <div className="inline-actions">
              <button className="btn small-btn" onClick={() => void saveSetup()} disabled={saving}>{saving ? 'Saving…' : 'Save setup'}</button>
              <button className="btn secondary small-btn" onClick={() => { setEditing(false); setRacquetName(racquet.racquet_name || ''); setRacquetModel(racquet.racquet_model || ''); setStringType(racquet.string_type); setTension(racquet.tension); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="meta-grid">
            <div className="meta-item"><strong>String type</strong>{racquet.string_type}</div>
            <div className="meta-item"><strong>Tension</strong>{racquet.tension}</div>
            <div className="meta-item"><strong>Preferred shop</strong>{racquet.preferred_shop_name || 'Not selected'}</div>
            <div className="meta-item"><strong>Proof photo</strong>{proofFile ? proofFile.name : 'Attach when requesting a job'}</div>
          </div>
        )}
        <div>
          <label className="label">Proof of drop-off photo</label>
          <input className="input" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
        </div>
      </section>
    </main>
  );
}
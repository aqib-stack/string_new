'use client';

import { useCurrentUser } from '@/components/RoleGate';
import { addAlert, createJob, createRacquet, ensurePlayerVisibleShop, getOpenJobForRacquet, getRacquetByTagOwner, listJobsByRacquet, listShops, saveRacquet } from '@/lib/firestoreData';
import { getRacquetHealth } from '@/lib/health';
import { SHARED_SHOP_ID } from '@/lib/appConstants';
import { ArrowRight, CheckCircle2, ScanLine, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getStringSetupSummary } from '@/components/StringSetupSummary';

const STRING_TYPES = ['Poly Tour Pro', 'RPM Blast', 'ALU Power', 'Synthetic Gut', 'Natural Gut'];
const TENSION_OPTIONS = Array.from({ length: 41 }, (_, index) => String(30 + index) + " lbs");
function tensionNumber(value: string) { return String(value || '52').replace(/[^0-9]/g, '') || '52'; }

export default function ScanTagPage({ params }: { params: Promise<{ tagId: string }> }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [tagId, setTagId] = useState('');
  const [racquetName, setRacquetName] = useState('');
  const [racquetModel, setRacquetModel] = useState('');
  const [stringType, setStringType] = useState('Poly Tour Pro');
  const [tension, setTension] = useState('52 lbs');
  const [useHybrid, setUseHybrid] = useState(false);
  const [mainsString, setMainsString] = useState('');
  const [mainsTension, setMainsTension] = useState('52 lbs');
  const [crossesString, setCrossesString] = useState('');
  const [crossesTension, setCrossesTension] = useState('52 lbs');
  const [preferredShopId, setPreferredShopId] = useState(SHARED_SHOP_ID);
  const [shops, setShops] = useState<any[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [racquet, setRacquet] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);

  useEffect(() => { params.then(({ tagId }) => setTagId(tagId)); }, [params]);
  useEffect(() => { (async () => setShops(await listShops()))(); }, []);
  useEffect(() => {
    if (!tagId || !user || user.user_role !== 'PLAYER') return;
    (async () => {
      const existing = await getRacquetByTagOwner(tagId, user.uid);
      setRacquet(existing);
      if (existing) {
        setRacquetName(existing.racquet_name || ''); setRacquetModel(existing.racquet_model || '');
        setStringType(existing.string_type || 'Poly Tour Pro'); setTension(existing.tension || '52 lbs'); setPreferredShopId(existing.preferred_shop_id || SHARED_SHOP_ID);
        setUseHybrid(Boolean(existing.is_hybrid));
        setMainsString(existing.hybrid_setup?.mains_string || ''); setMainsTension(existing.hybrid_setup?.mains_tension || '52 lbs');
        setCrossesString(existing.hybrid_setup?.crosses_string || ''); setCrossesTension(existing.hybrid_setup?.crosses_tension || '52 lbs');
        setHistoryJobs((await listJobsByRacquet(existing.racquet_id)).slice(0, 5));
      }
    })();
  }, [tagId, user]);

  const preferredShop = useMemo(() => shops.find((shop) => shop.shop_id === preferredShopId) || shops[0] || null, [shops, preferredShopId]);
  const racquetPayload = {
    owner_uid: user?.uid || '', owner_name: user?.name || '', tag_id: tagId,
    racquet_name: racquetName.trim() || 'My Racquet', racquet_model: racquetModel.trim(),
    string_type: useHybrid ? 'Hybrid setup' : stringType, tension: useHybrid ? 'Hybrid setup' : tension,
    is_hybrid: useHybrid,
    hybrid_setup: useHybrid ? { mains_string: mainsString, mains_tension: mainsTension, crosses_string: crossesString, crosses_tension: crossesTension } : undefined,
    preferred_shop_id: preferredShop?.shop_id || SHARED_SHOP_ID, preferred_shop_name: preferredShop?.name || 'Preferred shop',
  };

  async function repeatLastJob() {
    if (!racquet?.racquet_id) return;
    const allJobs = await listJobsByRacquet(racquet.racquet_id);
    const latest = allJobs.find((job) => ['PICKED_UP', 'PAID', 'FINISHED'].includes(job.status) && (job.is_hybrid || job.string_type || job.tension));
    if (!latest) return setMessage('No previous completed setup found to repeat.');
    setUseHybrid(Boolean(latest.is_hybrid));
    if (latest.is_hybrid) {
      setMainsString(latest.hybrid_setup?.mains_string || '');
      setMainsTension(latest.hybrid_setup?.mains_tension || '52 lbs');
      setCrossesString(latest.hybrid_setup?.crosses_string || '');
      setCrossesTension(latest.hybrid_setup?.crosses_tension || '52 lbs');
    } else {
      setStringType(latest.string_type || stringType);
      setTension(latest.tension || tension);
    }
    setMessage('Last completed job loaded as an autofill. Review it, then request service.');
  }

  async function handlePrimaryAction() {
    if (!user || user.user_role !== 'PLAYER') return;
    setSubmitting(true);
    try {
      await ensurePlayerVisibleShop();
      if (!racquet?.racquet_id) { await createRacquet(racquetPayload as any); router.replace('/player?added=1'); return; }
      await saveRacquet({ ...racquet, ...racquetPayload } as any);
      const openJob = await getOpenJobForRacquet(racquet.racquet_id);
      if (openJob) { setMessage(`An active string job already exists: ${openJob.job_id?.slice(0, 10).toUpperCase()}.`); return; }
      const job = await createJob({ racquet_id: racquet.racquet_id, owner_uid: user.uid, owner_name: user.name, shop_id: preferredShop?.shop_id || SHARED_SHOP_ID, amount_total: 30, status: 'REQUESTED', request_source: 'PLAYER_SCAN', proof_photo_url: proofFile ? proofFile.name : '', racquet_name: racquetPayload.racquet_name, racquet_model: racquetPayload.racquet_model, preferred_shop_name: racquetPayload.preferred_shop_name, string_type: racquetPayload.string_type, tension: racquetPayload.tension, is_hybrid: racquetPayload.is_hybrid, hybrid_setup: racquetPayload.hybrid_setup });
      await addAlert({ type: 'dropoff_request', shop_id: preferredShop?.shop_id || SHARED_SHOP_ID, job_id: job.job_id, racquet_id: racquet.racquet_id, tag_id: racquet.tag_id, owner_name: user.name, note: proofFile ? `Proof photo attached: ${proofFile.name}` : '', created_at: new Date().toISOString(), read: false });
      router.replace('/player?requested=1');
    } catch {
      setMessage('We could not process this tag right now.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <main className="container"><div className="card">Loading scan…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Player sign-in required</h1><p className="p">Sign in before scanning a GlobeTag.</p><Link className="btn" href={`/auth?mode=signin&role=PLAYER&next=${encodeURIComponent(`/scan/${tagId}`)}`}>Sign in to continue</Link></div></main>;
  if (user.user_role !== 'PLAYER') return <main className="container"><div className="card grid"><h1 className="h2">Player scan only</h1><p className="p">This scan flow is available for player accounts.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Open player sign in</Link></div></main>;

  const health = getRacquetHealth(racquet?.last_string_date);
  const currentSummary = racquet ? getStringSetupSummary(racquet) : null;

  return (
    <main className="container shell premium-shell">
      <section className="card grid strong section-card scan-result-card" style={{ maxWidth: 840 }}>
        <div className="scan-result-top"><div className="scan-result-badge"><ScanLine size={18} /></div><div className="section-heading"><span className="kicker">GlobeTag detected</span><h1 className="h2">Tag ID: {tagId}</h1><p className="p">Keep the flow simple by default, then expand only if a hybrid setup is needed.</p></div></div>
        {message ? <div className="notice warn">{message}</div> : null}
        <div className="meta-grid">
          <div><label className="label">Racquet name</label><input className="input" value={racquetName} onChange={(e) => setRacquetName(e.target.value)} placeholder="Match racquet" /></div>
          <div><label className="label">Racquet model</label><input className="input" value={racquetModel} onChange={(e) => setRacquetModel(e.target.value)} placeholder="Pure Aero 98" /></div>
          {!useHybrid ? <><div><label className="label">String</label><select className="input" value={stringType} onChange={(e) => setStringType(e.target.value)}>{STRING_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}</select></div><div><label className="label">Tension</label><input className="input" type="number" min="30" max="70" step="1" value={tensionNumber(tension)} onChange={(e) => setTension(`${e.target.value} lbs`)} /></div></> : null}
          <div><label className="label">Preferred stringer / shop</label><select className="input" value={preferredShopId} onChange={(e) => setPreferredShopId(e.target.value)}>{shops.map((shop) => <option key={shop.shop_id} value={shop.shop_id}>{shop.name}{shop.city ? ` • ${shop.city}` : ''}</option>)}</select></div>
        </div>
        <button type="button" className="btn secondary small-btn" onClick={() => setUseHybrid((v) => !v)}>{useHybrid ? 'Use single string setup' : 'Add hybrid setup'}</button>
        {useHybrid ? <div className="meta-grid"><div><label className="label">Mains string</label><input className="input" value={mainsString} onChange={(e) => setMainsString(e.target.value)} /></div><div><label className="label">Mains tension</label><input className="input" type="number" min="30" max="70" step="1" value={tensionNumber(mainsTension)} onChange={(e) => setMainsTension(`${e.target.value} lbs`)} /></div><div><label className="label">Crosses string</label><input className="input" value={crossesString} onChange={(e) => setCrossesString(e.target.value)} /></div><div><label className="label">Crosses tension</label><input className="input" type="number" min="30" max="70" step="1" value={tensionNumber(crossesTension)} onChange={(e) => setCrossesTension(`${e.target.value} lbs`)} /></div></div> : null}
        {racquet && currentSummary ? <div className="card grid"><span className="kicker">Current racquet data</span><div className="meta-grid"><div className="meta-item"><strong>Current setup</strong>{currentSummary.setupLabel}</div><div className="meta-item"><strong>Current tension</strong>{currentSummary.tensionLabel}</div><div className="meta-item"><strong>Stringer / shop</strong>{racquet.preferred_shop_name || 'Not selected'}</div><div className="meta-item"><strong>Readiness</strong>{health.statusLabel}</div><div className="meta-item"><strong>Head size</strong>{racquet.head_size || 'Not added'}</div><div className="meta-item"><strong>Grip size</strong>{racquet.grip_size || 'Not added'}</div><div className="meta-item"><strong>Weight</strong>{racquet.weight || 'Not added'}</div><div className="meta-item"><strong>Pattern</strong>{racquet.string_pattern || 'Not added'}</div><div className="meta-item"><strong>Balance</strong>{racquet.balance || 'Not added'}</div></div><div className="list" style={{ gap: 8 }}><strong>Last 5 string jobs</strong>{historyJobs.length ? historyJobs.slice(0, 5).map((job) => { const summary = getStringSetupSummary(job.is_hybrid ? job : racquet); return <div key={job.job_id} className="scan-history-item">{job.job_id?.slice(0, 10).toUpperCase()} • {summary.setupLabel} • {summary.tensionLabel} • {job.status}</div>; }) : <div className="small">No history yet</div>}</div><button type="button" className="btn secondary small-btn" onClick={() => void repeatLastJob()}>Repeat last job autofill</button></div> : null}
        <div><label className="label">Optional proof photo</label><input className="input" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} /></div>
        {racquet ? <div className={`badge ${health.tone}`}>{health.statusLabel}</div> : <div className="scan-preview-grid"><div className="scan-preview-panel"><span className="scan-preview-icon"><Sparkles size={18} /></span><h3 className="h3">New racquet</h3><p className="p">Save the racquet and its preferred setup.</p></div><div className="scan-preview-panel scan-preview-panel-soft"><span className="scan-preview-icon"><CheckCircle2 size={18} /></span><h3 className="h3">What gets saved</h3><p className="p">Racquet name, model, setup, and preferred shop.</p></div></div>}
        <div className="inline-actions"><button className="btn small-btn" onClick={() => void handlePrimaryAction()} disabled={submitting}>{submitting ? (racquet ? 'Sending request…' : 'Adding to bag…') : (racquet ? 'Request string job' : 'Add racquet to bag')}</button><Link className="btn secondary small-btn" href="/player">Back to player portal</Link>{racquet ? <ArrowRight size={16} /> : null}</div>
      </section>
    </main>
  );
}

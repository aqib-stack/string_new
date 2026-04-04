'use client';

import { useCurrentUser } from '@/components/RoleGate';
import { addAlert, createJob, createRacquet, ensurePlayerVisibleShop, getRacquetByTagOwner, listShops, saveRacquet } from '@/lib/firestoreData';
import { getRacquetHealth } from '@/lib/health';
import { SHARED_SHOP_ID } from '@/lib/appConstants';
import { ArrowRight, CheckCircle2, ScanLine, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const STRING_TYPES = ['Poly Tour Pro', 'RPM Blast', 'ALU Power', 'Synthetic Gut', 'Natural Gut'];
const TENSION_OPTIONS = ['45 lbs', '48 lbs', '50 lbs', '52 lbs', '54 lbs', '56 lbs', '58 lbs', '60 lbs'];

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

  async function handlePrimaryAction() {
    if (!user || user.user_role !== 'PLAYER') return;
    setSubmitting(true);
    try {
      await ensurePlayerVisibleShop();
      if (!racquet?.racquet_id) { await createRacquet(racquetPayload as any); router.replace('/player?added=1'); return; }
      await saveRacquet({ ...racquet, ...racquetPayload } as any);
      const job = await createJob({ racquet_id: racquet.racquet_id, owner_uid: user.uid, owner_name: user.name, shop_id: preferredShop?.shop_id || SHARED_SHOP_ID, amount_total: 30, status: 'REQUESTED', request_source: 'PLAYER_SCAN', proof_photo_url: proofFile ? proofFile.name : '' });
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

  return (
    <main className="container shell premium-shell">
      <section className="card grid strong section-card scan-result-card" style={{ maxWidth: 840 }}>
        <div className="scan-result-top"><div className="scan-result-badge"><ScanLine size={18} /></div><div className="section-heading"><span className="kicker">GlobeTag detected</span><h1 className="h2">Tag ID: {tagId}</h1><p className="p">Keep the flow simple by default, then expand only if a hybrid setup is needed.</p></div></div>
        {message ? <div className="notice warn">{message}</div> : null}
        <div className="meta-grid">
          <div><label className="label">Racquet name</label><input className="input" value={racquetName} onChange={(e) => setRacquetName(e.target.value)} placeholder="Match racquet" /></div>
          <div><label className="label">Racquet model</label><input className="input" value={racquetModel} onChange={(e) => setRacquetModel(e.target.value)} placeholder="Pure Aero 98" /></div>
          {!useHybrid ? <><div><label className="label">String</label><select className="input" value={stringType} onChange={(e) => setStringType(e.target.value)}>{STRING_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}</select></div><div><label className="label">Tension</label><select className="input" value={tension} onChange={(e) => setTension(e.target.value)}>{TENSION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></> : null}
          <div><label className="label">Preferred stringer / shop</label><select className="input" value={preferredShopId} onChange={(e) => setPreferredShopId(e.target.value)}>{shops.map((shop) => <option key={shop.shop_id} value={shop.shop_id}>{shop.name}{shop.city ? ` • ${shop.city}` : ''}</option>)}</select></div>
        </div>
        <button type="button" className="btn secondary small-btn" onClick={() => setUseHybrid((v) => !v)}>{useHybrid ? 'Use single string setup' : 'Add hybrid setup'}</button>
        {useHybrid ? <div className="meta-grid"><div><label className="label">Mains string</label><input className="input" value={mainsString} onChange={(e) => setMainsString(e.target.value)} /></div><div><label className="label">Mains tension</label><select className="input" value={mainsTension} onChange={(e) => setMainsTension(e.target.value)}>{TENSION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div><div><label className="label">Crosses string</label><input className="input" value={crossesString} onChange={(e) => setCrossesString(e.target.value)} /></div><div><label className="label">Crosses tension</label><select className="input" value={crossesTension} onChange={(e) => setCrossesTension(e.target.value)}>{TENSION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></div> : null}
        <div><label className="label">Optional proof photo</label><input className="input" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} /></div>
        {racquet ? <div className={`badge ${health.tone}`}>{health.statusLabel}</div> : <div className="scan-preview-grid"><div className="scan-preview-panel"><span className="scan-preview-icon"><Sparkles size={18} /></span><h3 className="h3">New racquet</h3><p className="p">Save the racquet and its preferred setup.</p></div><div className="scan-preview-panel scan-preview-panel-soft"><span className="scan-preview-icon"><CheckCircle2 size={18} /></span><h3 className="h3">What gets saved</h3><p className="p">Racquet name, model, setup, and preferred shop.</p></div></div>}
        <div className="inline-actions"><button className="btn small-btn" onClick={() => void handlePrimaryAction()} disabled={submitting}>{submitting ? (racquet ? 'Sending request…' : 'Adding to bag…') : (racquet ? 'Request string job' : 'Add racquet to bag')}</button><Link className="btn secondary small-btn" href="/player">Back to player portal</Link>{racquet ? <ArrowRight size={16} /> : null}</div>
      </section>
    </main>
  );
}

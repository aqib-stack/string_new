'use client';

import { useCurrentUser } from '@/components/RoleGate';
import {
  addAlert,
  createJob,
  createRacquet,
  ensureDemoShop,
  getRacquetByTagOwner,
  saveRacquet,
} from '@/lib/demoData';
import { getRacquetHealth } from '@/lib/health';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ScanTagPage({ params }: { params: Promise<{ tagId: string }> }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [tagId, setTagId] = useState('');
  const [stringType, setStringType] = useState('Poly Tour Pro');
  const [tension, setTension] = useState('52 lbs');
  const [racquet, setRacquet] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    params.then(({ tagId }) => setTagId(tagId));
  }, [params]);

  useEffect(() => {
    if (!tagId || !user || user.user_role !== 'PLAYER') return;
    const existing = getRacquetByTagOwner(tagId, user.uid);
    setRacquet(existing);
    if (existing) {
      setStringType(existing.string_type || 'Poly Tour Pro');
      setTension(existing.tension || '52 lbs');
    }
  }, [tagId, user]);

  async function handlePrimaryAction() {
    if (!user || user.user_role !== 'PLAYER') return;
    setSubmitting(true);
    try {
      ensureDemoShop({ shop_id: 'demo-shop-1', name: 'Central Court Tennis Lab', labor_rate: 30, owner_uid: 'shop-owner', wallet_balance: 0 });

      if (!racquet?.racquet_id) {
        createRacquet({
          owner_uid: user.uid,
          owner_name: user.name,
          tag_id: tagId,
          string_type: stringType,
          tension,
        });
        router.replace('/player?added=1');
        return;
      }

      saveRacquet({
        ...racquet,
        owner_uid: user.uid,
        owner_name: user.name,
        tag_id: tagId,
        string_type: stringType,
        tension,
      });

      const job = createJob({
        racquet_id: racquet.racquet_id,
        owner_uid: user.uid,
        owner_name: user.name,
        shop_id: 'demo-shop-1',
        amount_total: 30,
        status: 'REQUESTED',
        request_source: 'PLAYER_SCAN',
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
      router.replace('/player?requested=1');
    } catch (err) {
      console.error(err);
      setMessage('We could not process this tag right now.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="container"><div className="card">Loading scan…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Player sign-in required</h1><p className="p">Sign in before scanning a GlobeTag so we can add the racquet to your bag.</p><Link className="btn" href={`/auth?mode=signin&role=PLAYER&next=${encodeURIComponent(`/scan/${tagId}`)}`}>Sign in to continue</Link></div></main>;
  if (user.user_role !== 'PLAYER') return <main className="container"><div className="card grid"><h1 className="h2">Player scan only</h1><p className="p">This scan flow is available for player accounts. Use a player login to manage racquets in a bag.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Open player sign in</Link></div></main>;

  const health = getRacquetHealth(racquet?.last_string_date);

  return (
    <main className="container shell">
      <section className="card grid strong" style={{ maxWidth: 760 }}>
        <span className="kicker">GlobeTag detected</span>
        <h1 className="h2">Tag ID: {tagId}</h1>
        {message ? <div className="notice warn">{message}</div> : null}

        {!racquet ? (
          <>
            <p className="p">This GlobeTag has not been linked to your bag yet. Save the string setup below to register the racquet.</p>
            <div className="meta-grid">
              <div>
                <label className="label">String type</label>
                <input className="input" value={stringType} onChange={(e) => setStringType(e.target.value)} />
              </div>
              <div>
                <label className="label">Tension</label>
                <input className="input" value={tension} onChange={(e) => setTension(e.target.value)} />
              </div>
            </div>
            <button className="btn" onClick={() => void handlePrimaryAction()} disabled={submitting}>{submitting ? 'Adding to bag…' : 'Add racquet to bag'}</button>
          </>
        ) : (
          <>
            <div className="row between wrap">
              <div>
                <div className="small">Racquet already in your bag</div>
                <h3 className="h3">{racquet.tag_id}</h3>
              </div>
              <div className={`badge ${health.tone}`}>{health.statusLabel}</div>
            </div>
            <div className="meta-grid">
              <div className="meta-item"><strong>String type</strong>{racquet.string_type}</div>
              <div className="meta-item"><strong>Tension</strong>{racquet.tension}</div>
            </div>
            <div className="notice">Scanning an existing racquet creates a string job request and instantly notifies the pro shop stringer about the upcoming drop-off.</div>
            <button className="btn" onClick={() => void handlePrimaryAction()} disabled={submitting}>{submitting ? 'Sending request…' : 'Request string job'}</button>
          </>
        )}
      </section>
    </main>
  );
}

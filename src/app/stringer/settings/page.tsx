'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/RoleGate';
import { getShop, updateShop } from '@/lib/firestoreData';

export default function StringerSettingsPage() {
  const { user, loading } = useCurrentUser();
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [laborRate, setLaborRate] = useState('20');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user?.shop_id) return;
    (async () => {
      const shop = await getShop(user.shop_id!);
      setShopName(String(shop?.name || ''));
      setCity(String(shop?.city || ''));
      setLaborRate(String(Number(shop?.labor_rate || 20)));
    })();
  }, [user]);

  if (loading) return <main className="container"><div className="card">Loading settings…</div></main>;
  if (!user || user.user_role !== 'STRINGER') return <main className="container"><div className="card grid"><h1 className="h2">Stringer settings</h1><p className="p">Sign in as a stringer to edit business settings.</p><Link className="btn" href="/auth?mode=signin&role=STRINGER">Sign in</Link></div></main>;

  return (
    <main className="container shell">
      <section className="card grid strong" style={{ maxWidth: 760 }}>
        <div className="section-heading"><span className="kicker">Shop Settings</span><h1 className="h2">Business Profile</h1><p className="p">Low-frequency shop information belongs here, not on the dashboard.</p></div>
        {message ? <div className="notice success">{message}</div> : null}
        <div>
          <label className="label">Shop name</label>
          <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="label">Default stringing price</label>
          <input className="input" type="number" min="0" step="0.01" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} />
        </div>
        <div className="inline-actions">
          <button className="btn small-btn" onClick={async () => { await updateShop(user.shop_id!, { name: shopName, city, labor_rate: Number(laborRate || 20) } as any); setMessage('Shop settings updated.'); }}>Save settings</button>
          <Link className="btn secondary small-btn" href="/stringer">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}

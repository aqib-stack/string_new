'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/components/RoleGate';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [tagId, setTagId] = useState('globetag-001');

  if (loading) return <main className="container"><div className="card">Loading…</div></main>;
  if (!user) return <main className="container"><div className="card grid"><h1 className="h2">Sign in to scan a GlobeTag</h1><p className="p">Use your secure account to add racquets to your bag or open a new string job request.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Sign in</Link></div></main>;

  return (
    <main className="container shell">
      <section className="hero">
        <div className="hero-media" style={{ backgroundImage: 'url(/hero-racquet.svg)' }} />
        <div className="hero-inner">
          <span className="kicker">GlobeTag scan</span>
          <h1 className="h1">Add a racquet or request service in one scan.</h1>
          <p className="p">If the tag is new, the racquet is added to your bag. If it already belongs to you, the scan starts a new string job request.</p>
        </div>
      </section>

      <section className="card grid strong" style={{ maxWidth: 640 }}>
        <div className="section-heading">
          <h2 className="h2">Scan or enter GlobeTag</h2>
          <p className="p">For the current build, enter the tag manually to simulate an NFC or QR scan.</p>
        </div>
        <div>
          <label className="label">GlobeTag ID</label>
          <input className="input" value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="globe-tag-001" />
        </div>
        <button className="btn" onClick={() => router.push(`/scan/${encodeURIComponent(tagId.trim())}`)}>Continue to scan result</button>
      </section>
    </main>
  );
}

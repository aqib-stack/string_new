'use client';

import Link from 'next/link';
import { ArrowRight, ScanLine, Sparkles, Workflow } from 'lucide-react';
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
    <main className="container shell premium-shell">
      <section className="hero hero-premium scan-hero">
        <div className="hero-inner premium-hero-inner">
          <span className="kicker">GlobeTag scan</span>
          <h1 className="h1">Add a racquet or request service in one premium flow.</h1>
          <p className="p lead">This streamlined scan experience is designed around three moments: tag detection, setup confirmation, and handoff into the restring queue.</p>
          <div className="scan-steps-preview">
            <div className="scan-step-card"><ScanLine size={18} /><strong>Scan</strong><span>Enter the GlobeTag or simulate the NFC scan.</span></div>
            <div className="scan-step-card"><Sparkles size={18} /><strong>Confirm</strong><span>Review saved string setup or register a brand-new racquet.</span></div>
            <div className="scan-step-card"><Workflow size={18} /><strong>Request</strong><span>Existing racquets move directly into the live service queue.</span></div>
          </div>
        </div>
      </section>

      <section className="card grid strong section-card scan-shell-card" style={{ maxWidth: 760 }}>
        <div className="section-heading">
          <span className="kicker">Step 1</span>
          <h2 className="h2">Scan or enter GlobeTag</h2>
          <p className="p">For the current build, enter the tag manually to simulate an NFC or QR scan.</p>
        </div>
        <div>
          <label className="label">GlobeTag ID</label>
          <input className="input" value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="globe-tag-001" />
        </div>
        <div className="inline-actions">
          <button className="btn small-btn" onClick={() => router.push(`/scan/${encodeURIComponent(tagId.trim())}`)}>Continue to scan result <ArrowRight size={16} /></button>
          <Link className="btn secondary small-btn" href="/player">Back to player portal</Link>
        </div>
      </section>
    </main>
  );
}

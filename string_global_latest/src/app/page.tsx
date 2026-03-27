'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container shell">
      <section className="hero hero-light">
        <div className="hero-orb hero-orb-a" />
        <div className="hero-orb hero-orb-b" />
        <div className="hero-visual-card">
          <Image src="/hero-real-racquet.svg" alt="Premium tennis racquet" width={420} height={320} className="hero-racquet hero-racquet-photo" priority />
        </div>
        <div className="hero-inner light-copy">
          <Image src="/stringglobe-logo.svg" alt="StringGlobe" width={252} height={52} className="brand-logo" />
          <h1 className="h1">Your racquets, beautifully organized from bag to pickup.</h1>
          <p className="p lead">
            Add racquets with a GlobeTag scan, request string service when needed, and keep players and stringers in sync through one polished workflow.
          </p>
          <div className="inline-actions">
            <Link className="btn small-btn" href="/auth?mode=signup&role=PLAYER">Create player account</Link>
            <Link className="btn secondary small-btn" href="/auth?mode=signup&role=STRINGER">Create stringer account</Link>
          </div>
          <div className="stats premium-stats">
            <div className="stat light-stat">
              <span className="small">First scan</span>
              <strong>Add to bag</strong>
            </div>
            <div className="stat light-stat">
              <span className="small">Later scan</span>
              <strong>Request service</strong>
            </div>
            <div className="stat light-stat">
              <span className="small">Drop-off</span>
              <strong>Stringer notified</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-grid">
        <div className="card col-7 grid strong light-card">
          <span className="kicker">How it works</span>
          <div className="section-heading">
            <h2 className="h2">A premium player experience for modern pro shops</h2>
            <p className="p">
              Clean onboarding for players, fast queue management for stringers, and a polished status journey from bag to payment.
            </p>
          </div>
          <div className="list">
            <div className="meta-item light-meta"><strong>Step 01</strong>Players sign up and scan their GlobeTag to add a racquet to their bag.</div>
            <div className="meta-item light-meta"><strong>Step 02</strong>When a restring is needed, the player scans again or requests service from the racquet screen.</div>
            <div className="meta-item light-meta"><strong>Step 03</strong>Stringers receive the request, confirm drop-off, complete the job, and release pickup after payment.</div>
          </div>
        </div>

        <div className="card col-5 grid light-card">
          <span className="kicker">Access</span>
          <h2 className="h2">Account access for every role</h2>
          <p className="p">Create a player or stringer account, create a player or stringer account and enter the right portal with no demo shortcuts.</p>
          <div className="action-grid">
            <Link className="btn" href="/auth?mode=signup&role=PLAYER">Player sign up</Link>
            <Link className="btn secondary" href="/auth?mode=signup&role=STRINGER">Stringer sign up</Link>
            <Link className="btn secondary" href="/auth?mode=signin&role=PLAYER">Player login</Link>
            <Link className="btn secondary" href="/auth?mode=signin&role=STRINGER">Stringer login</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

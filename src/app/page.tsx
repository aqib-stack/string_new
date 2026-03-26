'use client';

import Link from 'next/link';
import { clearDemoData, seedDemoUser } from '@/lib/demoData';
import { clearDemoUser, loginAsDemoPlayer, loginAsDemoStringer, DEMO_PLAYER, DEMO_STRINGER } from '@/lib/demoAuth';

export default function HomePage() {
  function resetDemo() {
    clearDemoUser();
    clearDemoData();
    window.location.reload();
  }

  function startPlayerFlow() {
    seedDemoUser(DEMO_PLAYER);
    loginAsDemoPlayer();
    window.location.href = '/scan/demo-tag-001';
  }

  function openStringerPortal() {
    seedDemoUser(DEMO_STRINGER);
    loginAsDemoStringer();
    window.location.href = '/stringer';
  }

  return (
    <main className="container">
      <div className="card grid">
        <span className="kicker">Client Demo Ready</span>
        <h1 className="h1">StringGlobe</h1>
        <p className="p">
          Scan tag. Drop racquet. Inspect. Pay. Withdraw. Use the demo flow below for a smooth client presentation.
        </p>
        <div className="grid">
          <button className="btn" onClick={startPlayerFlow}>Start player scan flow</button>
          <button className="btn secondary" onClick={openStringerPortal}>Open stringer dashboard</button>
          <Link className="btn secondary" href="/auth">Open demo login</Link>
          <button className="btn ghost" onClick={resetDemo}>Reset demo data</button>
        </div>
      </div>
    </main>
  );
}

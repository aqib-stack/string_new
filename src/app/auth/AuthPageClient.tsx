'use client';

import { DEMO_PLAYER, DEMO_STRINGER, DEMO_USER_KEY } from '@/lib/demoAuth';
import { seedDemoUser } from '@/lib/demoData';
import type { AppUser } from '@/types';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function AuthPageClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<'PLAYER' | 'STRINGER' | null>(null);
  const [error, setError] = useState('');

  function continueAs(user: AppUser) {
    try {
      setError('');
      setLoading(user.user_role);
      window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
      seedDemoUser(user);
      const next = searchParams.get('next');
      const destination = next || (user.user_role === 'STRINGER' ? '/stringer' : '/player');
      window.location.replace(destination);
    } catch (err) {
      console.error(err);
      setError('Demo login failed. Please try again.');
      setLoading(null);
    }
  }

  return (
    <main className="container">
      <div className="card grid">
        <span className="kicker">Login</span>
        <h1 className="h2">Demo access</h1>
        <p className="p">OTP is skipped for MVP testing. Pick a demo role and continue the full client flow instantly.</p>

        <button className="btn" onClick={() => continueAs(DEMO_PLAYER)} disabled={loading !== null}>
          {loading === 'PLAYER' ? 'Entering player app...' : 'Continue as Demo Player'}
        </button>

        <button className="btn secondary" onClick={() => continueAs(DEMO_STRINGER)} disabled={loading !== null}>
          {loading === 'STRINGER' ? 'Entering stringer portal...' : 'Continue as Demo Stringer'}
        </button>

        {error ? <p className="small" style={{ color: '#fca5a5' }}>{error}</p> : null}
      </div>
    </main>
  );
}

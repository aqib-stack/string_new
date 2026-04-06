'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/components/RoleGate';
import { requestEmailUpdate, requestPasswordReset } from '@/lib/authHelpers';

export default function PlayerSettingsPage() {
  const { user, loading } = useCurrentUser();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setEmail(user?.email || '');
  }, [user?.email]);

  if (loading) return <main className="container"><div className="card">Loading settings…</div></main>;
  if (!user || user.user_role !== 'PLAYER') return <main className="container"><div className="card grid"><h1 className="h2">Player settings</h1><p className="p">Sign in as a player to manage account settings.</p><Link className="btn" href="/auth?mode=signin&role=PLAYER">Sign in</Link></div></main>;

  return (
    <main className="container shell">
      <section className="card grid strong" style={{ maxWidth: 760 }}>
        <div className="section-heading"><span className="kicker">Account</span><h1 className="h2">Settings</h1><p className="p">Basic settings every app needs.</p></div>
        {message ? <div className="notice success">{message}</div> : null}
        {error ? <div className="notice warn">{error}</div> : null}
        <div>
          <label className="label">Email address</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="inline-actions">
          <button className="btn small-btn" onClick={async () => {
            try {
              setError('');
              await requestEmailUpdate(email);
              setMessage('Verification email sent. Confirm the change from your inbox.');
            } catch (err: any) {
              setError(err?.message || 'Could not update email.');
            }
          }}>Update email</button>
          <button className="btn secondary small-btn" onClick={async () => {
            try {
              setError('');
              await requestPasswordReset(user.email || email);
              setMessage('Password reset email sent.');
            } catch (err: any) {
              setError(err?.message || 'Could not send password reset email.');
            }
          }}>Send password reset</button>
          <Link className="btn secondary small-btn" href="/player">Back to player portal</Link>
        </div>
      </section>
    </main>
  );
}

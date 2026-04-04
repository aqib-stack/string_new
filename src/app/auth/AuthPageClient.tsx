'use client';

import Image from 'next/image';
import Link from 'next/link';
import { signInWithPassword, signUpWithPassword } from '@/lib/authHelpers';
import type { UserRole } from '@/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function AuthPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'signup' | 'signin'>((searchParams.get('mode') as 'signup' | 'signin') || 'signup');
  const [role, setRole] = useState<UserRole>((searchParams.get('role') as UserRole) || 'PLAYER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const nextTarget = useMemo(() => searchParams.get('next'), [searchParams]);

  useEffect(() => {
    setMode((searchParams.get('mode') as 'signup' | 'signin') || 'signup');
    setRole((searchParams.get('role') as UserRole) || 'PLAYER');
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'signup') {
        if (!firstName.trim()) throw new Error('Please enter a first name.');
        if (!lastName.trim()) throw new Error('Please enter a last name.');
        if (role === 'STRINGER' && !businessName.trim()) throw new Error('Please enter a business name.');
        if (!password) throw new Error('Please enter a password.');
        if (password.length < 6) throw new Error('Password should be at least 6 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const appUser = await signUpWithPassword({ firstName, lastName, businessName, email, password, role });
        setMessage('Account created successfully. Redirecting now…');
        const destination = nextTarget || (appUser.user_role === 'STRINGER' ? '/stringer' : '/player');
        router.replace(destination);
        return;
      }

      const appUser = await signInWithPassword({ email, password, role });
      setMessage('Signed in successfully. Redirecting now…');
      const destination = nextTarget || (appUser.user_role === 'STRINGER' ? '/stringer' : '/player');
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not complete sign in right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-wrap light-auth-bg">
      <div className="auth-shell auth-shell-light">
        <section className="auth-hero auth-hero-light">
          <div className="hero-orb hero-orb-a" />
          <div className="hero-orb hero-orb-b" />
          <div className="auth-copy light-copy">
            <Image src="/stringglobe-logo.svg" alt="StringGlobe" width={220} height={46} className="brand-logo auth-logo" />
            <h1 className="h1">Join StringGlobe with secure account access.</h1>
            <p className="p">Create a player or stringer account with clean profile details, business identity, and a backend join timestamp for future lifecycle tracking.</p>
          </div>
        </section>

        <section className="card auth-form grid strong light-card elevated-card">
          <div className="topbar">
            <div className="brand">
              <div className="brand-mark brand-mark-light">SG</div>
              <div>
                <strong>{mode === 'signup' ? 'Create your account' : 'Sign in'}</strong>
              </div>
            </div>
            <Link className="small" href="/">Back home</Link>
          </div>

          <div className="role-picker">
            <button type="button" className={`role-option light-option ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>
              <strong>Create account</strong>
            </button>
            <button type="button" className={`role-option light-option ${mode === 'signin' ? 'active' : ''}`} onClick={() => setMode('signin')}>
              <strong>Sign in</strong>
            </button>
          </div>

          <div>
            <label className="label">I am continuing as</label>
            <div className="role-picker">
              <button type="button" className={`role-option light-option ${role === 'PLAYER' ? 'active' : ''}`} onClick={() => setRole('PLAYER')}>
                <strong>Player</strong>
                <div className="small">Owns racquet history</div>
              </button>
              <button type="button" className={`role-option light-option ${role === 'STRINGER' ? 'active' : ''}`} onClick={() => setRole('STRINGER')}>
                <strong>Stringer</strong>
                <div className="small">Owns workflow</div>
              </button>
            </div>
          </div>

          <form className="grid" onSubmit={handleSubmit}>
            {mode === 'signup' ? (
              <>
                <div className="meta-grid">
                  <div>
                    <label className="label">First name</label>
                    <input className="input input-light" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                  </div>
                  <div>
                    <label className="label">Last name</label>
                    <input className="input input-light" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                  </div>
                </div>
                {role === 'STRINGER' ? (
                  <div>
                    <label className="label">Business name</label>
                    <input className="input input-light" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ace Tennis Studio" />
                    <div className="small">You can use your personal name if that is how players know you.</div>
                  </div>
                ) : null}
              </>
            ) : null}

            <div>
              <label className="label">Email address</label>
              <input className="input input-light" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
            </div>

            <div>
              <label className="label">Password</label>
              <input className="input input-light" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'} required />
            </div>

            {mode === 'signup' ? (
              <div>
                <label className="label">Confirm password</label>
                <input className="input input-light" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required />
              </div>
            ) : null}

            <button className="btn" disabled={submitting}>{submitting ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Create account' : 'Sign in')}</button>
          </form>

          {message ? <div className="notice success">{message}</div> : null}
          {error ? <div className="notice warn">{error}</div> : null}
        </section>
      </div>
    </main>
  );
}

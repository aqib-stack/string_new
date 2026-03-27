'use client';

import { useState } from 'react';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '@/lib/firebase';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export function PhoneOtpForm({ onVerified }: { onVerified: (uid: string, phone: string) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getRecaptcha() {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
      });
    }
    return window.recaptchaVerifier;
  }

  async function handleSendOtp() {
    try {
      setLoading(true);
      setError('');
      const verifier = getRecaptcha();
      const result = await signInWithPhoneNumber(auth, phone, verifier);
      setConfirmation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!confirmation) return;
    try {
      setLoading(true);
      setError('');
      const credential = await confirmation.confirm(code);
      onVerified(credential.user.uid, credential.user.phoneNumber || phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid">
      <div>
        <label className="label">Phone number</label>
        <input
          className="input"
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      {!confirmation ? (
        <button className="btn" onClick={handleSendOtp} disabled={loading}>
          {loading ? 'Sending OTP...' : 'Send OTP'}
        </button>
      ) : (
        <>
          <div>
            <label className="label">Enter OTP</label>
            <input
              className="input"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button className="btn" onClick={handleVerify} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify code'}
          </button>
        </>
      )}

      {error ? <p className="small" style={{ color: '#ff8a8a' }}>{error}</p> : null}
      <div id="recaptcha-container" />
    </div>
  );
}
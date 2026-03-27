'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StripePaymentForm } from '@/components/StripePaymentForm';
import { formatJobCode, getJob, getStringerNetForJob, markJobPaid } from '@/lib/demoData';

export default function PaymentPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [jobId, setJobId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [jobTotal, setJobTotal] = useState(30);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const stripePromise = useMemo(() => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''), []);

  useEffect(() => {
    params.then(async ({ jobId }) => {
      setJobId(jobId);
      const localJob = getJob(jobId);
      if (localJob?.amount_total) setJobTotal(localJob.amount_total);
      if (localJob?.status === 'PAID') {
        setAlreadyPaid(true);
        setLoadingIntent(false);
        return;
      }
      try {
        const res = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        });
        if (!res.ok) throw new Error('Sandbox payment only');
        const data = await res.json();
        if (data.clientSecret) setClientSecret(data.clientSecret);
      } catch {
        setClientSecret('');
      } finally {
        setLoadingIntent(false);
      }
    });
  }, [params]);

  function completeSandboxPayment() {
    if (!jobId) return;
    markJobPaid(jobId);
    window.location.href = `/player?paid=${jobId}`;
  }

  return (
    <main className="container shell">
      <section className="hero">
        <div className="hero-media" style={{ backgroundImage: 'url(/hero-racquet.svg)' }} />
        <div className="hero-inner">
          <span className="kicker">Pickup payment</span>
          <h1 className="h1">Complete payment for {formatJobCode(jobId || 'job')}</h1>
          <p className="p">Finish payment to release pickup and transfer the net amount into the stringer wallet.</p>
        </div>
      </section>

      <section className="panel-grid">
        <div className="card col-5 grid strong">
          <span className="kicker">Payment summary</span>
          <div className="meta-grid">
            <div className="meta-item"><strong>Player pays</strong>${Number(jobTotal).toFixed(2)}</div>
            <div className="meta-item"><strong>Platform fee</strong>$0.35</div>
            <div className="meta-item"><strong>Stringer receives</strong>${getStringerNetForJob({ amount_total: jobTotal }).toFixed(2)}</div>
            <div className="meta-item"><strong>Status</strong>{alreadyPaid ? 'Paid' : 'Awaiting payment'}</div>
          </div>
          <Link className="btn secondary" href="/player">Back to player portal</Link>
        </div>

        <div className="card col-7 grid">
          <span className="kicker">Payment sheet</span>
          <h2 className="h2">Secure checkout</h2>
          {alreadyPaid ? (
            <div className="notice success">Payment was already completed for this job. Your racquet is ready for pickup.</div>
          ) : clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripePaymentForm jobId={jobId} />
            </Elements>
          ) : loadingIntent ? (
            <p className="p">Preparing secure payment…</p>
          ) : (
            <div className="grid">
              <div className="notice">Live Stripe keys are not connected in this environment yet, so you can complete the sandbox payment below.</div>
              <button className="btn" onClick={completeSandboxPayment}>Complete sandbox payment</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

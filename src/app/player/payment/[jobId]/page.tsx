'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
        if (!res.ok) throw new Error('Payment intent unavailable in demo mode');
        const data = await res.json();
        if (data.clientSecret) setClientSecret(data.clientSecret);
      } catch {
        setClientSecret('');
      } finally {
        setLoadingIntent(false);
      }
    });
  }, [params]);

  function completeDemoPayment() {
    if (!jobId) return;
    markJobPaid(jobId);
    window.location.href = `/player?paid=${jobId}`;
  }

  return (
    <main className="container">
      <div className="card grid">
        <span className="kicker">Pickup payment</span>
        <h1 className="h2">Complete payment for job {formatJobCode(jobId || 'job')}</h1>
        <div className="card grid">
          <div className="row between"><span className="small">Player pays</span><strong>${Number(jobTotal).toFixed(2)}</strong></div>
          <div className="row between"><span className="small">Platform fee</span><strong>$0.35</strong></div>
          <div className="row between"><span className="small">Stringer receives</span><strong>${getStringerNetForJob({ amount_total: jobTotal }).toFixed(2)}</strong></div>
        </div>

        {alreadyPaid ? (
          <div className="notice success">Payment was already completed for this job. 🎉 Racquet ready for pickup.</div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripePaymentForm jobId={jobId} />
          </Elements>
        ) : loadingIntent ? (
          <p className="p">Preparing secure payment sheet...</p>
        ) : (
          <div className="grid">
            <div className="notice">Stripe is not configured in this demo environment, so you can use the demo payment button below.</div>
            <button className="btn" onClick={completeDemoPayment}>Complete demo payment</button>
          </div>
        )}

        <Link className="btn secondary" href="/player">Back to player portal</Link>
      </div>
    </main>
  );
}

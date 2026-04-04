'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { CreditCard, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StripePaymentForm } from '@/components/StripePaymentForm';
import { formatJobCode, getJob, getStringerNetForJob, markJobPaid } from '@/lib/firestoreData';

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function PaymentPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [jobId, setJobId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [jobTotal, setJobTotal] = useState(30);
  const [laborCost, setLaborCost] = useState(20);
  const [stringCost, setStringCost] = useState(10);
  const [customerProvided, setCustomerProvided] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const stripePromise = useMemo(() => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''), []);

  useEffect(() => {
    params.then(async ({ jobId }) => {
      setJobId(jobId);
      const localJob = await getJob(jobId);
      if (localJob) {
        setJobTotal(Number(localJob.amount_total || 30));
        setLaborCost(Number(localJob.labor_cost || 20));
        setStringCost(Number(localJob.string_cost || 0));
        setCustomerProvided(Boolean(localJob.customer_provided_string));
      }
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
    void markJobPaid(jobId);
    window.location.href = `/player?paid=${jobId}`;
  }

  return (
    <main className="container shell premium-shell">
      <section className="hero hero-premium payment-hero">
        <div className="hero-inner premium-hero-inner">
          <span className="kicker">Pickup payment</span>
          <h1 className="h1">Complete payment for {formatJobCode(jobId || 'job')}</h1>
          <p className="p lead">The stringer has already priced this job for you. Review the breakdown and complete payment on one screen.</p>
          <div className="hero-summary-grid payment-summary-hero">
            <div className="summary-card glass-card"><span className="small">Player pays</span><strong>{formatMoney(jobTotal)}</strong><span className="summary-meta">Full amount requested by the stringer</span></div>
            <div className="summary-card glass-card"><span className="small">Platform fee</span><strong>$0.35</strong><span className="summary-meta">StringGlobe transaction fee</span></div>
            <div className="summary-card glass-card"><span className="small">Stringer receives</span><strong>{formatMoney(getStringerNetForJob({ amount_total: jobTotal }))}</strong><span className="summary-meta">Net amount routed into the wallet</span></div>
          </div>
        </div>
      </section>

      <section className="panel-grid">
        <div className="card col-5 grid strong section-card">
          <span className="kicker">Payment summary</span>
          <h2 className="h2">What you are paying for</h2>
          <div className="meta-grid">
            <div className="meta-item"><strong>Labor</strong>{formatMoney(laborCost)}</div>
            <div className="meta-item"><strong>String cost</strong>{customerProvided ? '$0.00' : formatMoney(stringCost)}</div>
            <div className="meta-item"><strong>String source</strong>{customerProvided ? 'Customer provided string' : 'Stringer supplied string'}</div>
            <div className="meta-item"><strong>Total</strong>{formatMoney(jobTotal)}</div>
          </div>
          <div className="workflow-stack compact-stack">
            <div className="workflow-item"><CreditCard size={18} /><div><strong>Player checkout</strong><span>Completing payment marks the job paid and updates the player portal instantly.</span></div></div>
            <div className="workflow-item"><ShieldCheck size={18} /><div><strong>Protected release</strong><span>Pickup stays locked until the finished job is paid.</span></div></div>
            <div className="workflow-item"><Wallet size={18} /><div><strong>Stringer payout</strong><span>The net amount moves into the stringer wallet after payment lands.</span></div></div>
          </div>
          <Link className="btn secondary" href="/player">Back to player portal</Link>
        </div>

        <div className="card col-7 grid strong section-card section-card-large">
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
            <div className="grid payment-fallback-grid">
              <div className="notice">Live Stripe keys are not connected in this environment yet, so you can complete the sandbox payment below.</div>
              <button className="btn" onClick={completeSandboxPayment}>Complete sandbox payment for {formatMoney(jobTotal)}</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

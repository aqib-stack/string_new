'use client';

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useState } from 'react';

export function StripePaymentForm({ jobId }: { jobId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/player?paid=${jobId}`,
      },
    });
    if (error) setMessage(error.message || 'Payment failed');
    setLoading(false);
  }

  return (
    <form className="grid" onSubmit={handleSubmit}>
      <PaymentElement />
      <button className="btn" disabled={loading || !stripe}>{loading ? 'Processing...' : 'Pay with Apple Pay / Google Pay'}</button>
      {message ? <p className="small">{message}</p> : null}
    </form>
  );
}

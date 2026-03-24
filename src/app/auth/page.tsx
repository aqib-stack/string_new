import { Suspense } from 'react';
import AuthPageClient from './AuthPageClient';

export const dynamic = 'force-dynamic';

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="container"><div className="card grid"><p className="p">Loading...</p></div></main>}>
      <AuthPageClient />
    </Suspense>
  );
}
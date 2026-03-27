'use client';

import { useEffect } from 'react';
import { hydrateSharedDemoState } from '@/lib/sharedDemoSync';

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void hydrateSharedDemoState();

    const interval = window.setInterval(() => {
      void hydrateSharedDemoState();
    }, 1200);

    const onFocus = () => {
      void hydrateSharedDemoState();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('stringglobe:force-sync', onFocus as EventListener);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('stringglobe:force-sync', onFocus as EventListener);
    };
  }, []);

  return <>{children}</>;
}

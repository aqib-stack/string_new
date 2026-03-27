'use client';

import { getSessionUser } from '@/lib/authHelpers';
import { useEffect, useState } from 'react';
import type { AppUser } from '@/types';

export function useCurrentUser() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const sync = () => {
      setUser(getSessionUser());
      setLoading(false);
    };

    sync();
    window.addEventListener('storage', sync);
    const timer = window.setInterval(sync, 1000);
    return () => {
      window.removeEventListener('storage', sync);
      window.clearInterval(timer);
    };
  }, []);

  return { loading, user };
}

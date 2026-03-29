'use client';

import { auth, db } from '@/lib/firebase';
import type { AppUser } from '@/types';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export function useCurrentUser() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          setUser(snap.data() as AppUser);
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return { loading, user };
}

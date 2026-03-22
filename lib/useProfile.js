'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to get + keep fresh profile data from DB.
 * Reads session from localStorage and calls /api/profile on mount.
 * Returns { session, profile, refreshProfile, logout }
 */
export function useProfile() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  const refreshProfile = useCallback(async (s) => {
    const active = s || session;
    if (!active?.access_token) return;
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${active.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        // Keep localStorage in sync
        const stored = localStorage.getItem('dn_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem('dn_session', JSON.stringify({ ...parsed, profile: data.profile }));
        }
      }
    } catch {}
  }, [session]);

  useEffect(() => {
    const stored = localStorage.getItem('dn_session');
    if (!stored) { setReady(true); return; }
    const parsed = JSON.parse(stored);
    setSession(parsed);
    // Set cached profile immediately (no flicker), then refresh from DB
    setProfile(parsed.profile || null);
    refreshProfile(parsed).finally(() => setReady(true));
  }, []);

  const logout = () => {
    localStorage.removeItem('dn_session');
    setSession(null);
    setProfile(null);
  };

  return { session, profile, refreshProfile: () => refreshProfile(session), logout, ready };
}

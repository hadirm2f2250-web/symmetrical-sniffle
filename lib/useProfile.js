'use client';
import { useState, useEffect, useCallback } from 'react';

/** Helper: baca sesi dari localStorage dulu, fallback ke sessionStorage */
function readSession() {
  try {
    const local = localStorage.getItem('dn_session');
    if (local) return { data: JSON.parse(local), storage: 'local' };
    const sess = sessionStorage.getItem('dn_session');
    if (sess) return { data: JSON.parse(sess), storage: 'session' };
  } catch {}
  return null;
}

/** Helper: tulis sesi ke storage yang sama saat pertama kali dibaca */
function writeSession(data, storage) {
  const json = JSON.stringify(data);
  if (storage === 'local') {
    localStorage.setItem('dn_session', json);
  } else {
    sessionStorage.setItem('dn_session', json);
  }
}

/**
 * Hook to get + keep fresh profile data from DB.
 * Reads session from localStorage (ingat saya) or sessionStorage (tidak diingat).
 * Returns { session, profile, refreshProfile, logout }
 */
export function useProfile() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [storageType, setStorageType] = useState('local');

  const refreshProfile = useCallback(async (s, sType) => {
    const active = s || session;
    if (!active?.access_token) return;
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${active.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        // Keep storage in sync
        writeSession({ ...active, profile: data.profile }, sType || storageType);
      }
    } catch {}
  }, [session, storageType]);

  useEffect(() => {
    const found = readSession();
    if (!found) { setReady(true); return; }
    const { data: parsed, storage } = found;
    setSession(parsed);
    setStorageType(storage);
    setProfile(parsed.profile || null);
    refreshProfile(parsed, storage).finally(() => setReady(true));
  }, []);

  const logout = () => {
    localStorage.removeItem('dn_session');
    sessionStorage.removeItem('dn_session');
    setSession(null);
    setProfile(null);
  };

  return { session, profile, refreshProfile: () => refreshProfile(session, storageType), logout, ready };
}


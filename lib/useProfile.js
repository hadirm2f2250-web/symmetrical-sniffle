'use client';
import { useState, useEffect, useRef } from 'react';

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

  // Refs agar tidak ada stale closure
  const sessionRef = useRef(null);
  const storageRef = useRef('local');

  const doRefreshProfile = async (activeSession, storage) => {
    if (!activeSession?.access_token) return;
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        writeSession({ ...activeSession, profile: data.profile }, storage);
      }
    } catch {}
  };

  useEffect(() => {
    const found = readSession();
    if (!found) { setReady(true); return; }
    const { data: parsed, storage } = found;
    sessionRef.current = parsed;
    storageRef.current = storage;
    setSession(parsed);
    setProfile(parsed.profile || null);
    doRefreshProfile(parsed, storage).finally(() => setReady(true));
  }, []);

  const refreshProfile = () => doRefreshProfile(sessionRef.current, storageRef.current);

  const logout = () => {
    localStorage.removeItem('dn_session');
    sessionStorage.removeItem('dn_session');
    sessionRef.current = null;
    setSession(null);
    setProfile(null);
  };

  return { session, profile, refreshProfile, logout, ready };
}

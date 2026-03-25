'use client';
import { useState, useEffect, useRef } from 'react';

/** Helper: cek apakah JWT token sudah expired */
function isTokenExpired(token) {
  try {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Pad with = so it's a multiple of 4
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonPayload);
    // Beri buffer 60 detik sebelum expired
    return payload.exp && payload.exp < Math.floor(Date.now() / 1000) + 60;
  } catch {
    return true;
  }
}

/** Helper: baca sesi dari localStorage dulu, fallback ke sessionStorage */
function readSession() {
  try {
    const local = localStorage.getItem('dn_session');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.access_token && isTokenExpired(parsed.access_token)) {
        localStorage.removeItem('dn_session');
        return null;
      }
      return { data: parsed, storage: 'local' };
    }
    const sess = sessionStorage.getItem('dn_session');
    if (sess) {
      const parsed = JSON.parse(sess);
      if (parsed.access_token && isTokenExpired(parsed.access_token)) {
        sessionStorage.removeItem('dn_session');
        return null;
      }
      return { data: parsed, storage: 'session' };
    }
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
    // Cek ulang expiry sebelum fetch
    if (isTokenExpired(activeSession.access_token)) {
      localStorage.removeItem('dn_session');
      sessionStorage.removeItem('dn_session');
      sessionRef.current = null;
      setSession(null);
      setProfile(null);
      return;
    }
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

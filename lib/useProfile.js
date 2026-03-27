'use client';
import { useState, useEffect, useRef } from 'react';

/** Helper: decode JWT payload */
function decodeJwt(token) {
  try {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/** Helper: cek apakah JWT token sudah expired */
function isTokenExpired(token) {
  const payload = decodeJwt(token);
  if (!payload) return true;
  // Beri buffer 60 detik sebelum expired
  return payload.exp && payload.exp < Math.floor(Date.now() / 1000) + 60;
}

/** Helper: cek apakah token perlu di-refresh (5 menit sebelum expired) */
function shouldRefreshToken(token) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return false;
  // Refresh 5 menit sebelum expired
  return payload.exp < Math.floor(Date.now() / 1000) + 300;
}

/** Helper: baca sesi dari localStorage dulu, fallback ke sessionStorage */
function readSession() {
  try {
    const local = localStorage.getItem('dn_session');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.access_token && isTokenExpired(parsed.access_token)) {
        // Token expired — tapi masih punya refresh_token? Jangan hapus dulu, biar auto-refresh
        if (parsed.refresh_token) {
          return { data: parsed, storage: 'local', needsRefresh: true };
        }
        localStorage.removeItem('dn_session');
        return null;
      }
      return { data: parsed, storage: 'local' };
    }
    const sess = sessionStorage.getItem('dn_session');
    if (sess) {
      const parsed = JSON.parse(sess);
      if (parsed.access_token && isTokenExpired(parsed.access_token)) {
        if (parsed.refresh_token) {
          return { data: parsed, storage: 'session', needsRefresh: true };
        }
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
 * Auto-refreshes token before expiry using refresh_token.
 * Returns { session, profile, refreshProfile, logout, ready }
 */
export function useProfile() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  // Refs agar tidak ada stale closure
  const sessionRef = useRef(null);
  const storageRef = useRef('local');
  const refreshingRef = useRef(false);

  /** Refresh the access_token using refresh_token */
  const doRefreshToken = async (activeSession, storage) => {
    if (!activeSession?.refresh_token || refreshingRef.current) return false;
    refreshingRef.current = true;

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: activeSession.refresh_token }),
      });
      const data = await res.json();

      if (data.success && data.session) {
        const updated = {
          ...activeSession,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        };
        sessionRef.current = updated;
        setSession(updated);
        writeSession(updated, storage);
        refreshingRef.current = false;
        return true;
      }
    } catch {}

    // Refresh failed — clear session
    refreshingRef.current = false;
    return false;
  };

  const doRefreshProfile = async (activeSession, storage) => {
    if (!activeSession?.access_token) return;
    // Cek ulang expiry sebelum fetch — coba refresh dulu kalau perlu
    if (isTokenExpired(activeSession.access_token)) {
      const refreshed = await doRefreshToken(activeSession, storage);
      if (!refreshed) {
        localStorage.removeItem('dn_session');
        sessionStorage.removeItem('dn_session');
        sessionRef.current = null;
        setSession(null);
        setProfile(null);
        return;
      }
      activeSession = sessionRef.current;
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
    const init = async () => {
      const found = readSession();
      if (!found) { setReady(true); return; }

      const { data: parsed, storage, needsRefresh } = found;
      sessionRef.current = parsed;
      storageRef.current = storage;

      // Token expired tapi punya refresh_token → refresh dulu
      if (needsRefresh) {
        const refreshed = await doRefreshToken(parsed, storage);
        if (!refreshed) {
          localStorage.removeItem('dn_session');
          sessionStorage.removeItem('dn_session');
          setReady(true);
          return;
        }
      }

      const activeSession = sessionRef.current;
      setSession(activeSession);
      setProfile(activeSession.profile || null);
      await doRefreshProfile(activeSession, storage);
      setReady(true);
    };
    init();
  }, []);

  // Auto-refresh token setiap 4 menit (sebelum 5 menit buffer)
  useEffect(() => {
    const interval = setInterval(async () => {
      const s = sessionRef.current;
      if (!s?.access_token || !s?.refresh_token) return;
      if (shouldRefreshToken(s.access_token)) {
        await doRefreshToken(s, storageRef.current);
      }
    }, 4 * 60 * 1000); // setiap 4 menit
    return () => clearInterval(interval);
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

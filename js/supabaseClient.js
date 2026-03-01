// js/supabaseClient.js
// Supabase REST client (no external libraries).
// IMPORTANT: Only api.js should import from this file.



export const SUPABASE_URL = "https://jeddtvfwupaljovfjbsh.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZGR0dmZ3dXBhbGpvdmZqYnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTczNDcsImV4cCI6MjA4Nzg3MzM0N30.OmoqpNKeiLvgFdf0qzrcr9dqR1rLA3jEbuN2kWvC0qQ";

// Local session cache (minimal). Later you can swap to supabase-js without changing api.js signatures.
const STORAGE_KEY = "hk_supabase_session_v1";

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.access_token || !s?.refresh_token) return null;
    return s;
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

async function supaFetch(path, { method = "GET", headers = {}, body } = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      json?.msg ||
      json?.message ||
      json?.error_description ||
      json?.error ||
      "Request failed.";
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

async function refreshSessionIfNeeded(session) {
  if (!session?.expires_at) return session;
  const buffer = 30; // seconds
  if (session.expires_at > nowSec() + buffer) return session;

  const refreshed = await supaFetch(`/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    body: { refresh_token: session.refresh_token },
  });

  const next = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    token_type: refreshed.token_type,
    expires_in: refreshed.expires_in,
    expires_at: nowSec() + (refreshed.expires_in || 0),
    user: refreshed.user,
  };

  saveSession(next);
  return next;
}

export const supabase = {
  auth: {
    async signUp({ email, password, options }) {
      const payload = { email, password, data: options?.data || {} };
      const out = await supaFetch(`/auth/v1/signup`, { method: "POST", body: payload });

      // If session exists, store it.
      if (out?.access_token && out?.refresh_token) {
        const session = {
          access_token: out.access_token,
          refresh_token: out.refresh_token,
          token_type: out.token_type,
          expires_in: out.expires_in,
          expires_at: nowSec() + (out.expires_in || 0),
          user: out.user,
        };
        saveSession(session);
        return { data: { user: out.user, session }, error: null };
      }

      return { data: { user: out?.user || null, session: null }, error: null };
    },

    async signInWithPassword({ email, password }) {
      const out = await supaFetch(`/auth/v1/token?grant_type=password`, {
        method: "POST",
        body: { email, password },
      });

      const session = {
        access_token: out.access_token,
        refresh_token: out.refresh_token,
        token_type: out.token_type,
        expires_in: out.expires_in,
        expires_at: nowSec() + (out.expires_in || 0),
        user: out.user,
      };
      saveSession(session);

      return { data: { user: out.user, session }, error: null };
    },

    async signOut() {
      const s = loadStoredSession();
      if (!s?.access_token) {
        clearSession();
        return { error: null };
      }

      try {
        await supaFetch(`/auth/v1/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${s.access_token}` },
          body: {},
        });
      } finally {
        clearSession();
      }

      return { error: null };
    },

    async getSession() {
      const s = loadStoredSession();
      if (!s) return { data: { session: null }, error: null };
      const next = await refreshSessionIfNeeded(s);
      return { data: { session: next }, error: null };
    },
  },
};






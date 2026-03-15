// js/supabaseClient.js
// Supabase REST client (no external libraries).
// IMPORTANT: Only api.js should import from this file.

export const SUPABASE_URL = "https://jeddtvfwupaljovfjbsh.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZGR0dmZ3dXBhbGpvdmZqYnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTczNDcsImV4cCI6MjA4Nzg3MzM0N30.OmoqpNKeiLvgFdf0qzrcr9dqR1rLA3jEbuN2kWvC0qQ";

// ─── Storage keys ──────────────────────────────────────────
const STORAGE_KEY      = "hk_supabase_session_v1";
const OAUTH_INTENT_KEY = "hk_oauth_intent";

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ─── Session helpers ───────────────────────────────────────
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

// ─── OAuth intent helpers ──────────────────────────────────
// Saved to localStorage (NOT sessionStorage) because the OAuth
// flow involves a cross-origin redirect through Google and Supabase
// which clears sessionStorage in some browsers.
//
// isRegister = true  → user clicked Google on the REGISTER page
// isRegister = false → user clicked Google on the LOGIN page
//
// callback.html reads this to decide whether to show the role picker.
export function saveOAuthIntent(isRegister = false) {
  localStorage.setItem(
    OAUTH_INTENT_KEY,
    JSON.stringify({ isRegister, ts: nowSec() })
  );
}

export function loadOAuthIntent() {
  try {
    const raw = localStorage.getItem(OAUTH_INTENT_KEY);
    if (!raw) return { isRegister: false };
    const parsed = JSON.parse(raw);
    // Expire after 10 minutes in case something went wrong
    if (nowSec() - (parsed.ts || 0) > 600) {
      localStorage.removeItem(OAUTH_INTENT_KEY);
      return { isRegister: false };
    }
    return parsed;
  } catch {
    return { isRegister: false };
  }
}

export function clearOAuthIntent() {
  localStorage.removeItem(OAUTH_INTENT_KEY);
}

// ─── Base fetch helper ─────────────────────────────────────
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
    err.status  = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}

// ─── Auto-refresh session when close to expiry ─────────────
async function refreshSessionIfNeeded(session) {
  if (!session?.expires_at) return session;
  const buffer = 30;
  if (session.expires_at > nowSec() + buffer) return session;

  const refreshed = await supaFetch(`/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    body: { refresh_token: session.refresh_token },
  });

  const next = {
    access_token:  refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    token_type:    refreshed.token_type,
    expires_in:    refreshed.expires_in,
    expires_at:    nowSec() + (refreshed.expires_in || 0),
    user:          refreshed.user,
  };

  saveSession(next);
  return next;
}

// ─── Parse OAuth tokens from URL hash ─────────────────────
function parseSessionFromUrl() {
  try {
    const hash   = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    let accessToken  = params.get("access_token");
    let refreshToken = params.get("refresh_token");
    let expiresIn    = parseInt(params.get("expires_in") || "3600", 10);
    let tokenType    = params.get("token_type") || "bearer";

    if (!accessToken) {
      const qParams = new URLSearchParams(window.location.search);
      accessToken  = qParams.get("access_token");
      refreshToken = qParams.get("refresh_token");
      expiresIn    = parseInt(qParams.get("expires_in") || "3600", 10);
      tokenType    = qParams.get("token_type") || "bearer";
    }

    if (!accessToken) return null;

    return {
      access_token:  accessToken,
      refresh_token: refreshToken || "",
      token_type:    tokenType,
      expires_in:    expiresIn,
      expires_at:    nowSec() + expiresIn,
      user:          null,
    };
  } catch {
    return null;
  }
}

// ─── Exchange PKCE code for session ───────────────────────
async function exchangeCodeForSession(code) {
  const out = await supaFetch(`/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    body: { auth_code: code },
  });

  const session = {
    access_token:  out.access_token,
    refresh_token: out.refresh_token || "",
    token_type:    out.token_type    || "bearer",
    expires_in:    out.expires_in    || 3600,
    expires_at:    nowSec() + (out.expires_in || 3600),
    user:          out.user || null,
  };

  saveSession(session);
  return { data: { session }, error: null };
}

// ─── Fetch user from access token ─────────────────────────
async function getUser(accessToken) {
  try {
    return await supaFetch(`/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════
//  EXPORTED CLIENT
// ══════════════════════════════════════════════════════════
export const supabase = {
  auth: {

    async signUp({ email, password, options }) {
      const payload = { email, password, data: options?.data || {} };
      const out     = await supaFetch(`/auth/v1/signup`, { method: "POST", body: payload });

      if (out?.access_token && out?.refresh_token) {
        const session = {
          access_token:  out.access_token,
          refresh_token: out.refresh_token,
          token_type:    out.token_type,
          expires_in:    out.expires_in,
          expires_at:    nowSec() + (out.expires_in || 0),
          user:          out.user,
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
        access_token:  out.access_token,
        refresh_token: out.refresh_token,
        token_type:    out.token_type,
        expires_in:    out.expires_in,
        expires_at:    nowSec() + (out.expires_in || 0),
        user:          out.user,
      };
      saveSession(session);

      return { data: { user: out.user, session }, error: null };
    },

    // ── Google OAuth ───────────────────────────────────────
    // Pass isRegister: true when calling from the register page.
    // This flag is saved to localStorage so callback.html can read it
    // after the full cross-origin Google → Supabase → your app redirect.
    async signInWithOAuth({ provider, options = {}, isRegister = false }) {
      try {
        // Save intent to localStorage BEFORE navigating away
        saveOAuthIntent(isRegister);

        const redirectTo = options.redirectTo ||
          new URL("../auth/callback.html", window.location.href).toString();

        const params = new URLSearchParams({
          provider:    provider,
          redirect_to: redirectTo,
        });

        window.location.href = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;

        return { data: {}, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },

    // ── Handle OAuth callback ──────────────────────────────
    async handleOAuthCallback() {
      try {
        const qParams = new URLSearchParams(window.location.search);
        const code    = qParams.get("code");

        if (code) {
          return await exchangeCodeForSession(code);
        }

        const fromUrl = parseSessionFromUrl();
        if (fromUrl) {
          const user    = await getUser(fromUrl.access_token);
          const session = { ...fromUrl, user };
          saveSession(session);
          return { data: { session }, error: null };
        }

        return {
          data:  { session: null },
          error: new Error("No OAuth tokens found in URL."),
        };
      } catch (err) {
        return { data: { session: null }, error: err };
      }
    },

    // ── Request password reset email ──────────────────────
    // Sends a reset link to the user's email.
    // redirectTo must point to update-password.html.
    async resetPasswordForEmail(email, redirectTo) {
      try {
        await supaFetch(`/auth/v1/recover`, {
          method: "POST",
          body: {
            email:       String(email || "").trim(),
            redirect_to: redirectTo,
          },
        });
        return { error: null };
      } catch (err) {
        return { error: err };
      }
    },

    // ── Handle password reset callback ────────────────────
    async handlePasswordResetCallback() {
      try {
        // Method 1 — token_hash in query string (from custom email template)
        const qParams    = new URLSearchParams(window.location.search);
        const tokenHash  = qParams.get("token_hash");
        const type       = qParams.get("type");

        if (tokenHash && type === "recovery") {
          // Verify the token hash with Supabase
          const out = await supaFetch(`/auth/v1/verify`, {
            method: "POST",
            body: {
              token_hash: tokenHash,
              type:       "recovery",
            },
          });

          if (!out?.access_token) {
            return { data: null, error: new Error("Invalid or expired reset link.") };
          }

          const session = {
            access_token:  out.access_token,
            refresh_token: out.refresh_token || "",
            token_type:    out.token_type    || "bearer",
            expires_in:    out.expires_in    || 3600,
            expires_at:    nowSec() + (out.expires_in || 3600),
            user:          out.user || null,
          };

          saveSession(session);
          return { data: { session }, error: null };
        }

        // Method 2 — access_token in URL hash (Supabase default flow)
        const hash       = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const hashType   = hashParams.get("type");
        const accessToken= hashParams.get("access_token");
        const refreshToken=hashParams.get("refresh_token") || "";
        const expiresIn  = parseInt(hashParams.get("expires_in") || "3600", 10);

        if (hashType === "recovery" && accessToken) {
          const user    = await getUser(accessToken);
          const session = {
            access_token:  accessToken,
            refresh_token: refreshToken,
            token_type:    "bearer",
            expires_in:    expiresIn,
            expires_at:    nowSec() + expiresIn,
            user,
          };
          saveSession(session);
          return { data: { session }, error: null };
        }

        return { data: null, error: new Error("Invalid or expired reset link.") };
      } catch (err) {
        return { data: null, error: err };
      }
    },

    async signOut() {
      const s = loadStoredSession();
      if (!s?.access_token) {
        clearSession();
        return { error: null };
      }
      try {
        await supaFetch(`/auth/v1/logout`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${s.access_token}` },
          body:    {},
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
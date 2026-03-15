// js/api.js
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

/* ===============================
   INTERNAL HELPERS
================================= */
function toUserSafeError(err) {
  const raw = err && (err.message || err.msg) ? String(err.message || err.msg) : "";
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("user already registered"))   return "This email is already registered.";
  if (msg.includes("password"))                  return "Password does not meet requirements.";
  if (msg.includes("email"))                     return "Please enter a valid email address.";
  if (msg.includes("network"))                   return "Network issue. Please try again.";

  return raw || "Something went wrong. Please try again.";
}

async function fetchProfileByUserId(userId, accessToken) {
  const endpoint =
    `${SUPABASE_URL}/rest/v1/profiles?select=*` +
    `&id=eq.${encodeURIComponent(userId)}` +
    `&limit=1`;

  const res = await fetch(endpoint, {
    headers: {
      apikey:        SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept:        "application/json",
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || "Unable to load profile.");
  }

  return Array.isArray(json) ? json[0] || null : null;
}

/* Helper: get current session or throw */
async function getActiveSession() {
  const s       = await api.auth.getSession();
  const session = s?.data?.session || null;
  if (!session?.user?.id || !session?.access_token) {
    throw new Error("No active session.");
  }
  return session;
}

/* Helper: generic REST fetch against Supabase PostgREST */
async function restFetch(path, options = {}) {
  const session  = await getActiveSession();
  const url      = `${SUPABASE_URL}/rest/v1/${path}`;
  const method   = options.method || "GET";

  const res = await fetch(url, {
    method,
    headers: {
      apikey:        SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      Accept:        "application/json",
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status}).`);

  return json;
}

/* ===============================
   API OBJECT
================================= */
export const api = {

  /* ===========================
     AUTH
     =========================== */
  auth: {
    async signUp({ full_name, email, password, role }) {
      try {
        const { data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name, role } },
        });
        return { ok: true, data };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    async signIn({ email, password }) {
      try {
        const { data } = await supabase.auth.signInWithPassword({ email, password });
        return { ok: true, data };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    async signOut() {
      try {
        await supabase.auth.signOut();
        return { ok: true };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    async getSession() {
      try {
        const { data } = await supabase.auth.getSession();
        return { ok: true, data };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    /* Fixed: now properly inside api.auth */
    async updatePassword({ new_password }) {
      try {
        const s       = await api.auth.getSession();
        const session = s?.data?.session || null;
        if (!session?.access_token) throw new Error("No active session.");

        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "PUT",
          headers: {
            apikey:          SUPABASE_ANON_KEY,
            Authorization:   `Bearer ${session.access_token}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({ password: String(new_password || "") }),
        });

        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }

        if (!res.ok) throw new Error(json?.message || "Failed to update password.");
        return { ok: true, data: json };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },
  },

  /* ===========================
     PROFILE
     =========================== */
  profile: {
    async getMyProfile() {
      try {
        const s       = await api.auth.getSession();
        const session = s?.data?.session || null;

        if (!session?.user?.id || !session?.access_token) {
          return { ok: true, data: null };
        }

        const profile = await fetchProfileByUserId(
          session.user.id,
          session.access_token
        );

        return { ok: true, data: profile };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    async updateMyProfile(payload) {
      try {
        const s       = await api.auth.getSession();
        const session = s?.data?.session || null;
        if (!session?.user?.id || !session?.access_token) return { ok: false, data: null };

        const endpoint = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            apikey:         SUPABASE_ANON_KEY,
            Authorization:  `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            Prefer:         "return=representation",
          },
          body: JSON.stringify(payload || {}),
        });

        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }

        if (!res.ok) throw new Error(json?.message || "Failed to update profile.");
        return { ok: true, data: Array.isArray(json) ? (json[0] || null) : json };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },
  },

  /* ===========================
     INVESTMENTS
     =========================== */
  investments: {
    /* List all investments belonging to the logged-in investor */
    async listMyInvestments() {
      try {
        const session = await getActiveSession();
        const data    = await restFetch(
          `investments?select=*&investor_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc`
        );
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    /* Get a single investment by its ID */
    async getInvestmentById(investmentId) {
      try {
        const data = await restFetch(
          `investments?select=*&id=eq.${encodeURIComponent(investmentId)}&limit=1`
        );
        const record = Array.isArray(data) ? data[0] || null : null;
        return { ok: true, data: record };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    /* List updates — optionally scoped to a specific investment */
    async listUpdates(investmentId = null) {
      try {
        const filter = investmentId
          ? `&investment_id=eq.${encodeURIComponent(investmentId)}`
          : "";
        const data = await restFetch(
          `investment_updates?select=*${filter}&order=created_at.desc`
        );
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    /* List transactions — optionally scoped to a specific investment */
    async listTransactions(investmentId = null) {
      try {
        const session = await getActiveSession();
        const investorFilter = `&investor_id=eq.${encodeURIComponent(session.user.id)}`;
        const investmentFilter = investmentId
          ? `&investment_id=eq.${encodeURIComponent(investmentId)}`
          : "";
        const data = await restFetch(
          `transactions?select=*${investorFilter}${investmentFilter}&order=created_at.desc`
        );
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    /* List documents — optionally scoped to a specific investment */
    async listDocuments(investmentId = null) {
      try {
        const session = await getActiveSession();
        const investorFilter = `&investor_id=eq.${encodeURIComponent(session.user.id)}`;
        const investmentFilter = investmentId
          ? `&investment_id=eq.${encodeURIComponent(investmentId)}`
          : "";
        const data = await restFetch(
          `documents?select=*${investorFilter}${investmentFilter}&order=created_at.desc`
        );
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },
  },

  /* ===========================
     NOTIFICATIONS
     =========================== */
  notifications: {
    /* List notifications for the logged-in user —
       includes broadcast (all), role-targeted, and user-specific */
    async listMyNotifications() {
      try {
        const session = await getActiveSession();

        // Get role from profile (more reliable than metadata)
        let role = "investor";
        try {
          const p = await restFetch(
            `profiles?id=eq.${encodeURIComponent(session.user.id)}&select=role&limit=1`
          );
          role = Array.isArray(p) && p[0]?.role ? p[0].role : "investor";
        } catch { /* fallback to investor */ }

        // Fetch all notification types in parallel
        const [allNotis, roleNotis, userNotis] = await Promise.all([
          restFetch("notifications?select=*&target_type=eq.all&order=created_at.desc"),
          restFetch(`notifications?select=*&target_type=eq.role&target_role=eq.${encodeURIComponent(role)}&order=created_at.desc`),
          restFetch(`notifications?select=*&target_type=eq.user&target_user=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc`),
        ]);

        // Merge, deduplicate by id, sort newest first
        const merged = [
          ...(Array.isArray(allNotis)  ? allNotis  : []),
          ...(Array.isArray(roleNotis) ? roleNotis : []),
          ...(Array.isArray(userNotis) ? userNotis : []),
        ];

        const seen   = new Set();
        const unique = merged.filter(n => {
          if (seen.has(n.id)) return false;
          seen.add(n.id);
          return true;
        });

        unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return { ok: true, data: unique };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    /* Mark all notifications as read for this user */
    async markAllRead() {
      try {
        const session = await getActiveSession();

        // Mark user-specific notifications as read
        await restFetch(
          `notifications?target_type=eq.user&target_user=eq.${encodeURIComponent(session.user.id)}&is_read=eq.false`,
          { method: "PATCH", body: { is_read: true } }
        );

        return { ok: true };
      } catch {
        // Non-critical — don't throw
        return { ok: false };
      }
    },
  },

  /* ===========================
     SUPPORT
     =========================== */
  support: {
    /* Create a new support ticket */
    async createTicket({ subject, category, message }) {
      try {
        const session = await getActiveSession();
        const data    = await restFetch("support_tickets", {
          method: "POST",
          prefer: "return=representation",
          body: {
            investor_id: session.user.id,
            subject:     subject  || "",
            category:    category || "general",
            message:     message  || "",
            status:      "open",
          },
        });
        const record = Array.isArray(data) ? data[0] || null : data;
        return { ok: true, data: record };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },

    /* List support tickets for the logged-in investor */
    async listTickets() {
      try {
        const session = await getActiveSession();
        const data    = await restFetch(
          `support_tickets?select=*&investor_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc`
        );
        return { ok: true, data: Array.isArray(data) ? data : [] };
      } catch (err) {
        throw new Error(toUserSafeError(err));
      }
    },
  },
};
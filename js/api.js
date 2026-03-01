// js/api.js
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

function toUserSafeError(err) {
  const raw = err && (err.message || err.msg) ? String(err.message || err.msg) : "";
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("user already registered")) return "This email is already registered.";
  if (msg.includes("password")) return "Password does not meet requirements.";
  if (msg.includes("email")) return "Please enter a valid email address.";
  if (msg.includes("network")) return "Network issue. Please try again.";

  return raw || "Something went wrong. Please try again.";
}

async function fetchProfileByUserId(userId, accessToken) {
  const endpoint =
    `${SUPABASE_URL}/rest/v1/profiles?select=*` +
    `&id=eq.${encodeURIComponent(userId)}` +
    `&limit=1`;

  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || "Unable to load profile.");
  }

  return Array.isArray(json) ? json[0] || null : null;
}

export const api = {
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
  },


  async updatePassword({ new_password }) {
  try {
    const s = await api.auth.getSession();
    const session = s?.data?.session || null;
    if (!session?.access_token) throw new Error("No active session.");

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./supabaseClient.js");

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
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

  profile: {
    async getMyProfile() {
      try {
        const s = await api.auth.getSession();
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
    const s = await api.auth.getSession();
    const session = s?.data?.session || null;
    if (!session?.user?.id || !session?.access_token) return { ok: false, data: null };

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./supabaseClient.js");

    const endpoint = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}`;
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
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
}
  },
};
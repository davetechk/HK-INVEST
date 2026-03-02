// js/auth.js
import { api } from "./api.js";

const DASHBOARD_PATHS = {
  investor: "../dashboard/investor.html",
  farmer: "../dashboard/farmer.html",
  agent: "../dashboard/agent.html",
};

function normalizeRole(role) {
  const r = String(role || "").toLowerCase().trim();
  if (r === "investor" || r === "farmer" || r === "agent") return r;
  return "investor";
}

function safeNavigate(path) {
  window.location.href = new URL(path, window.location.href).toString();
}

/* =========================
   REGISTER
========================= */

export async function register({ full_name, email, password, role }) {
  const res = await api.auth.signUp({
    full_name: String(full_name || "").trim(),
    email: String(email || "").trim(),
    password: String(password || ""),
    role: normalizeRole(role),
  });

  return res;
}

/* =========================
   LOGIN
========================= */

export async function signIn({ email, password }) {
  const res = await api.auth.signIn({
    email: String(email || "").trim(),
    password: String(password || ""),
  });

  return res;
}

/* =========================
   REDIRECT GATE (Shared)
========================= */

export async function loadProfileAndRedirect(opts = {}) {
  const { onMissingProfile } = opts;

  const s = await api.auth.getSession();
  const session = s?.data?.session || null;

  if (!session) {
    safeNavigate("../auth/login.html");
    return { ok: false, reason: "no-session" };
  }

  let profile = null;
  try {
    const p = await api.profile.getMyProfile();
    profile = p?.data || null;
  } catch {
    profile = null;
  }

  if (!profile) {
    if (typeof onMissingProfile === "function") {
      onMissingProfile(
        "Your account profile is not ready yet. Please try again shortly."
      );
      return { ok: false, reason: "missing-profile" };
    }

    safeNavigate("../auth/pending.html");
    return { ok: false, reason: "missing-profile" };
  }

  const status = String(profile.status || "").toLowerCase();
  const role = normalizeRole(profile.role);

  if (status === "pending") {
    safeNavigate("../auth/pending.html");
    return { ok: true, redirected: "pending" };
  }

  if (status === "approved") {
    safeNavigate(DASHBOARD_PATHS[role] || DASHBOARD_PATHS.investor);
    return { ok: true, redirected: "dashboard" };
  }

  safeNavigate("../auth/pending.html");
  return { ok: true, redirected: "pending-default" };
}

/* =========================
   VALIDATION
========================= */

export function validateLoginInputs({ email, password }) {
  const em = String(email || "").trim();
  const pw = String(password || "");

  if (!em) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
    return "Please enter a valid email address.";
  if (!pw) return "Password is required.";

  return null;
}

export function validateRegisterInputs({
  full_name,
  email,
  password,
  role,
}) {
  const name = String(full_name || "").trim();
  const em = String(email || "").trim();
  const pw = String(password || "");
  const rl = normalizeRole(role);

  if (!name) return "Full name is required.";
  if (!em) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
    return "Please enter a valid email address.";
  if (!pw || pw.length < 8)
    return "Password must be at least 8 characters.";
  if (!rl) return "Role is required.";

  return null;
}





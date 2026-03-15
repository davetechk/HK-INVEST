// js/auth.js
import { api } from "./api.js";
import { supabase } from "./supabaseClient.js";
// saveOAuthIntent is called inside signInWithOAuth via isRegister flag

/* ===============================
   CONSTANTS
================================= */
const DASHBOARD_PATHS = {
  investor: "../dashboard/investor.html",
  farmer:   "../dashboard/farmer.html",
  agent:    "../dashboard/agent.html",
};

/* ===============================
   HELPERS
================================= */
function normalizeRole(role) {
  const r = String(role || "").toLowerCase().trim();
  if (r === "investor" || r === "farmer" || r === "agent") return r;
  return "investor";
}

function safeNavigate(path) {
  window.location.href = new URL(path, window.location.href).toString();
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("is-loading", loading);
}

/* ===============================
   GOOGLE OAUTH
================================= */
async function signInWithGoogle(isRegister = false) {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider:    "google",
      isRegister,   // passed through to saveOAuthIntent inside signInWithOAuth
      options: {
        redirectTo: new URL("../auth/callback.html", window.location.href).toString(),
      },
    });
    if (error) throw error;
    // Browser navigates away to Google — nothing else runs here
  } catch (err) {
    const errorId = document.getElementById("loginError") ? "loginError" : "registerError";
    showError(errorId, err.message || "Google sign-in failed. Please try again.");
  }
}

/* ===============================
   REGISTER
================================= */
export async function register({ full_name, email, password, role }) {
  const res = await api.auth.signUp({
    full_name: String(full_name || "").trim(),
    email:     String(email    || "").trim(),
    password:  String(password || ""),
    role:      normalizeRole(role),
  });
  return res;
}

/* ===============================
   LOGIN
================================= */
export async function signIn({ email, password }) {
  const res = await api.auth.signIn({
    email:    String(email    || "").trim(),
    password: String(password || ""),
  });
  return res;
}

/* ===============================
   REDIRECT GATE (Shared)
================================= */
export async function loadProfileAndRedirect(opts = {}) {
  const { onMissingProfile } = opts;

  const s       = await api.auth.getSession();
  const session = s?.data?.session || null;

  if (!session) {
    safeNavigate("../auth/login.html");
    return { ok: false, reason: "no-session" };
  }

  let profile = null;
  try {
    const p = await api.profile.getMyProfile();
    profile  = p?.data || null;
  } catch {
    profile = null;
  }

  if (!profile) {
    if (typeof onMissingProfile === "function") {
      onMissingProfile("Your account profile is not ready yet. Please try again shortly.");
      return { ok: false, reason: "missing-profile" };
    }
    safeNavigate("../auth/pending.html");
    return { ok: false, reason: "missing-profile" };
  }

  const status = String(profile.status || "").toLowerCase();
  const role   = normalizeRole(profile.role);

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

/* ===============================
   VALIDATION
================================= */
export function validateLoginInputs({ email, password }) {
  const em = String(email    || "").trim();
  const pw = String(password || "");

  if (!em) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return "Please enter a valid email address.";
  if (!pw) return "Password is required.";

  return null;
}

export function validateRegisterInputs({ full_name, email, password, role }) {
  const name = String(full_name || "").trim();
  const em   = String(email     || "").trim();
  const pw   = String(password  || "");
  const rl   = normalizeRole(role);

  if (!name) return "Full name is required.";
  if (!em)   return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return "Please enter a valid email address.";
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  if (!rl)   return "Role is required.";

  return null;
}

/* ===============================
   PAGE: LOGIN
================================= */
function initLoginPage() {
  const form          = document.getElementById("loginForm");
  const submitBtn     = document.getElementById("loginSubmit");
  const googleBtn     = document.getElementById("googleSignInBtn");
  const togglePwdBtns = document.querySelectorAll("[data-action='toggle-password']");

  // Password visibility toggle
  togglePwdBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.closest(".hk-inputWrap")?.querySelector("input");
      if (!input) return;
      const isText = input.type === "text";
      input.type = isText ? "password" : "text";
      btn.setAttribute("aria-label", isText ? "Show password" : "Hide password");
    });
  });

  // Google button — LOGIN page (isRegister = false → skip role picker)
  googleBtn?.addEventListener("click", async () => {
    setLoading(googleBtn, true);
    googleBtn.textContent = "Redirecting to Google…";
    await signInWithGoogle(false);
    // If we get here an error occurred (otherwise browser navigated away)
    setLoading(googleBtn, false);
    googleBtn.innerHTML = `
      <svg class="hk-googleIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google
    `;
  });

  // Email/password form submit
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("loginError");

    const email    = form.querySelector('[name="email"]')?.value.trim()    || "";
    const password = form.querySelector('[name="password"]')?.value         || "";

    const validationError = validateLoginInputs({ email, password });
    if (validationError) {
      showError("loginError", validationError);
      return;
    }

    setLoading(submitBtn, true);

    try {
      await signIn({ email, password });
      await loadProfileAndRedirect({
        onMissingProfile: (msg) => showError("loginError", msg),
      });
    } catch (err) {
      showError("loginError", err.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // Reveal animation
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    requestAnimationFrame(() => el.classList.add("is-visible"));
  });
}

/* ===============================
   PAGE: REGISTER
================================= */
function initRegisterPage() {
  const form          = document.getElementById("registerForm");
  const googleBtn     = document.getElementById("googleSignUpBtn");
  const togglePwdBtns = document.querySelectorAll("[data-action='toggle-password']");

  // Password visibility toggle
  togglePwdBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.closest(".hk-inputWrap")?.querySelector("input");
      if (!input) return;
      const isText = input.type === "text";
      input.type = isText ? "password" : "text";
      btn.setAttribute("aria-label", isText ? "Show password" : "Hide password");
    });
  });

  // Google button — REGISTER page (isRegister = true → show role picker)
  googleBtn?.addEventListener("click", async () => {
    setLoading(googleBtn, true);
    googleBtn.textContent = "Redirecting to Google…";
    await signInWithGoogle(true);
    setLoading(googleBtn, false);
    googleBtn.innerHTML = `
      <svg class="hk-googleIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google
    `;
  });

  // Registration form submit
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("registerError");

    const full_name = form.querySelector('[name="full_name"]')?.value.trim() || "";
    const email     = form.querySelector('[name="email"]')?.value.trim()     || "";
    const password  = form.querySelector('[name="password"]')?.value          || "";
    const role      = form.querySelector('[name="role"]')?.value              || "investor";

    const validationError = validateRegisterInputs({ full_name, email, password, role });
    if (validationError) {
      showError("registerError", validationError);
      return;
    }

    const submitBtn = form.querySelector('[data-action="register"]');
    setLoading(submitBtn, true);

    try {
      await register({ full_name, email, password, role });

      const normalRole = normalizeRole(role);

      if (normalRole === "investor") {
        // Investors are auto-approved — sign them in and go straight to dashboard
        await signIn({ email, password });
        await loadProfileAndRedirect({
          onMissingProfile: (msg) => showError("registerError", msg),
        });
      } else {
        // Farmers and agents need manual approval
        safeNavigate("../auth/pending.html");
      }
    } catch (err) {
      showError("registerError", err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // Reveal animation
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    requestAnimationFrame(() => el.classList.add("is-visible"));
  });
}

/* ===============================
   PAGE: RESET PASSWORD
================================= */
function initResetPasswordPage() {
  const form     = document.getElementById("resetRequestForm");
  const submitBtn= document.getElementById("sendResetBtn");
  const resendBtn= document.getElementById("resendBtn");

  let lastEmail = "";

  async function sendReset(email) {
    // Hardcoded absolute path — update this if your port changes
    const origin     = window.location.origin;                  // e.g. http://127.0.0.1:5502
    const redirectTo = origin + "/auth/update-password.html";   // e.g. http://127.0.0.1:5502/auth/update-password.html

    console.log("Sending reset with redirect_to:", redirectTo); // check this in DevTools

    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo);
    if (error) throw error;
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("requestError");

    const email = document.getElementById("resetEmail")?.value.trim() || "";

    if (!email) {
      showError("requestError", "Email address is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("requestError", "Please enter a valid email address.");
      return;
    }

    setLoading(submitBtn, true);

    try {
      await sendReset(email);
      lastEmail = email;

      // Show success view
      document.getElementById("viewRequest").style.display = "none";
      document.getElementById("viewSuccess").style.display = "";
      document.getElementById("sentToEmail").textContent   = email;
    } catch (err) {
      showError("requestError", err.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // Resend button
  resendBtn?.addEventListener("click", async () => {
    if (!lastEmail) return;
    resendBtn.disabled   = true;
    resendBtn.textContent= "Sending…";
    try {
      await sendReset(lastEmail);
      resendBtn.textContent= "Sent! Check your inbox.";
      setTimeout(() => {
        resendBtn.textContent= "Resend email";
        resendBtn.disabled   = false;
      }, 4000);
    } catch {
      resendBtn.textContent= "Failed — try again";
      resendBtn.disabled   = false;
    }
  });

  // Reveal animation
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    requestAnimationFrame(() => el.classList.add("is-visible"));
  });
}

/* ===============================
   PAGE: UPDATE PASSWORD
================================= */
function initUpdatePasswordPage() {
  const form        = document.getElementById("updatePasswordForm");
  const submitBtn   = document.getElementById("updatePasswordBtn");
  const newPwdInput = document.getElementById("newPassword");
  const strengthWrap= document.getElementById("strengthWrap");

  // Password toggle buttons
  document.querySelectorAll("[data-action='toggle-password']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input    = document.getElementById(targetId);
      if (!input) return;
      const isText = input.type === "text";
      input.type   = isText ? "password" : "text";
      btn.setAttribute("aria-label", isText ? "Show password" : "Hide password");
    });
  });

  // Password strength checker
  function getStrength(pw) {
    let score = 0;
    if (pw.length >= 8)                    score++;
    if (pw.length >= 12)                   score++;
    if (/[0-9]/.test(pw))                  score++;
    if (/[^a-zA-Z0-9]/.test(pw))          score++;
    return score; // 0–4
  }

  const strengthColors = ["#E2E8F0", "#DC2626", "#D97706", "#2563EB", "#2E7D32"];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

  newPwdInput?.addEventListener("input", () => {
    const pw     = newPwdInput.value;
    const score  = getStrength(pw);

    if (pw.length === 0) {
      if (strengthWrap) strengthWrap.style.display = "none";
      return;
    }

    if (strengthWrap) strengthWrap.style.display = "";

    const bars  = document.querySelectorAll(".strength-bar");
    const color = strengthColors[score] || "#E2E8F0";
    bars.forEach((bar, i) => {
      bar.style.background = i < score ? color : "#E2E8F0";
    });

    const label = document.getElementById("strengthLabel");
    if (label) {
      label.textContent = strengthLabels[score] || "";
      label.style.color = color;
    }
  });

  // Validate the reset token from URL on page load
  async function init() {
    const { data, error } = await supabase.auth.handlePasswordResetCallback();

    if (error || !data?.session) {
      // Invalid or expired link
      document.getElementById("viewForm").style.display    = "none";
      document.getElementById("viewInvalid").style.display = "";
      return;
    }

    // Token valid — show the form
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      requestAnimationFrame(() => el.classList.add("is-visible"));
    });
  }

  // Submit new password
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError("updateError");

    const newPassword     = document.getElementById("newPassword")?.value     || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

    if (newPassword.length < 8) {
      showError("updateError", "Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("updateError", "Passwords do not match.");
      return;
    }

    setLoading(submitBtn, true);

    try {
      // Use the existing updatePassword in api.auth
      await api.auth.updatePassword({ new_password: newPassword });

      // Show success, clear session so they sign in fresh
      await supabase.auth.signOut();
      document.getElementById("viewForm").style.display   = "none";
      document.getElementById("viewSuccess").style.display= "";
    } catch (err) {
      showError("updateError", err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(submitBtn, false);
    }
  });

  init();
}

/* ===============================
   BOOT — detect which page we're on
================================= */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "login")           initLoginPage();
  if (page === "register")        initRegisterPage();
  if (page === "reset-password")  initResetPasswordPage();
  if (page === "update-password") initUpdatePasswordPage();
});
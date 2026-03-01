


// js/app.js
import {
  register,
  signIn,
  loadProfileAndRedirect,
  validateRegisterInputs,
  validateLoginInputs,
} from "./auth.js";

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function setError(el, message) {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.hidden = false;
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);
  btn.setAttribute("aria-busy", isLoading ? "true" : "false");
}

/**
 * Reveal elements on load.
 * NOTE: Your CSS must not hide the entire UI permanently if JS fails.
 */
function revealOnLoad() {
  const nodes = document.querySelectorAll("[data-reveal], [data-auth='card']");
  nodes.forEach((n) => n.classList.add("is-visible"));
}

function bindPasswordToggle(root) {
  const toggle = qs('[data-action="toggle-password"]', root);
  const input = qs("#password", root) || qs('input[name="password"]', root);
  if (!toggle || !input) return;

  toggle.addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", isHidden ? "true" : "false");
  });
}

/* =========================
   REGISTER PAGE
========================= */
function bindRegisterPage() {
  const root = qs("#authRegister");
  const form = qs("#registerForm");
  const errorEl = qs("#registerError");
  const submitBtn = qs("#registerSubmit") || qs('[data-action="register"]');

  if (!root || !form) return;

  bindPasswordToggle(root);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError(errorEl, "");

    const fd = new FormData(form);
    const payload = {
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      password: fd.get("password"),
      role: fd.get("role"), // make sure your <select name="role"> exists
    };

    const validationMsg = validateRegisterInputs(payload);
    if (validationMsg) {
      setError(errorEl, validationMsg);
      return;
    }

    try {
      setLoading(submitBtn, true);

      await register(payload);

      // After signup: try redirect gate. If session doesn't exist (email confirm),
      // this will send user to login.
      await loadProfileAndRedirect({
        onMissingProfile: (msg) => setError(errorEl, msg),
      });
    } catch (err) {
      setError(errorEl, err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* =========================
   LOGIN PAGE
========================= */
function bindLoginPage() {
  const root = qs("#authLogin");
  const form = qs("#loginForm");
  const errorEl = qs("#loginError");
  const submitBtn = qs("#loginSubmit");

  if (!root || !form) return;

  bindPasswordToggle(root);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError(errorEl, "");

    const email = qs("#email", form)?.value || "";
    const password = qs("#password", form)?.value || "";

    const validationMsg = validateLoginInputs({ email, password });
    if (validationMsg) {
      setError(errorEl, validationMsg);
      return;
    }

    try {
      setLoading(submitBtn, true);
      await signIn({ email, password });

      await loadProfileAndRedirect({
        onMissingProfile: (msg) => setError(errorEl, msg),
      });
    } catch (err) {
      setError(errorEl, err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  revealOnLoad();

  const page = document.body?.dataset?.page || "";
  if (page === "register") bindRegisterPage();
  if (page === "login") bindLoginPage();
});




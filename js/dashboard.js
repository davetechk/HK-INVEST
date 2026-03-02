// js/dashboard.js
import { api } from "./api.js";

/* ===============================
   STATE
================================= */
let currentUser = null;
let currentProfile = null;
let currentRoute = "overview";

/* ===============================
   UI HELPERS
================================= */
function showLoading() {
  const el = document.getElementById("contentLoading");
  if (el) el.style.display = "flex";
}
function hideLoading() {
  const el = document.getElementById("contentLoading");
  if (el) el.style.display = "none";
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `
    <div class="toast-content">${message}</div>
  `;
  container.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function formatCurrency(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NGN",
  }).format(n);
}

/* ===============================
   INIT
================================= */
export async function initDashboard() {
  try {
    showLoading();

    const s = await api.auth.getSession();
    const session = s?.data?.session || null;

    if (!session?.user?.id) {
      window.location.href = "../auth/login.html";
      return;
    }

    currentUser = session.user;

    const p = await api.profile.getMyProfile();
    currentProfile = p?.data || null;

    if (!currentProfile) {
      window.location.href = "../auth/pending.html";
      return;
    }

    if (currentProfile.status === "pending") {
      window.location.href = "../auth/pending.html";
      return;
    }

    updateUserUI();
    setupListeners();

    await loadRoute("overview");
  } catch (err) {
    console.error(err);
    window.location.href = "../auth/login.html";
  } finally {
    hideLoading();
  }
}

/* ===============================
   USER UI
================================= */
function updateUserUI() {
  const name = currentProfile.full_name || "User";

  const sidebarName = document.getElementById("sidebarUserName");
  if (sidebarName) sidebarName.textContent = name;

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const avatar = document.getElementById("userAvatar");
  if (avatar) avatar.innerHTML = `<span>${initials}</span>`;
}

/* ===============================
   NAVIGATION
================================= */
function setupListeners() {
  document.querySelectorAll("[data-route]").forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      await loadRoute(item.dataset.route);
    });
  });

  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
}

async function loadRoute(route) {
  const content = document.getElementById("contentArea");
  if (!content) return;

  currentRoute = route;
  showLoading();

  try {
    switch (route) {
      case "overview":
        content.innerHTML = renderOverview();
        break;

      case "profile":
        content.innerHTML = renderProfile();
        bindProfileActions();
        break;

      default:
        content.innerHTML = `<div class="empty-state">Coming soon</div>`;
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state">Error loading page</div>`;
  } finally {
    hideLoading();
  }
}

/* ===============================
   OVERVIEW
================================= */
function renderOverview() {
  return `
    <div class="dashboard-card">
      <h2>Welcome, ${currentProfile.full_name}</h2>
      <p>Your investment journey starts here.</p>
      <p>Total Investments: ${formatCurrency(0)}</p>
      <p>No active investments yet.</p>
    </div>
  `;
}

/* ===============================
   PROFILE
================================= */
function renderProfile() {
  return `
    <div class="dashboard-card">
      <h2>Profile & Security</h2>

      <form id="profileForm">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="profileFullName" value="${currentProfile.full_name || ""}" required />
        </div>

        <button type="submit" class="btn btn-primary">Update Profile</button>
      </form>

      <hr />

      <form id="passwordForm">
        <div class="form-group">
          <label>Current Password</label>
          <input type="password" id="currentPassword" required />
        </div>

        <div class="form-group">
          <label>New Password</label>
          <input type="password" id="newPassword" required />
        </div>

        <div class="form-group">
          <label>Confirm New Password</label>
          <input type="password" id="confirmPassword" required />
        </div>

        <button type="submit" class="btn btn-primary">Change Password</button>
      </form>
    </div>
  `;
}

function bindProfileActions() {
  document.getElementById("profileForm")?.addEventListener("submit", handleProfileUpdate);
  document.getElementById("passwordForm")?.addEventListener("submit", handlePasswordChange);
}

async function handleProfileUpdate(e) {
  e.preventDefault();

  const fullName = document.getElementById("profileFullName").value.trim();

  if (!fullName) {
    showToast("Full name required", "error");
    return;
  }

  try {
    await api.profile.updateMyProfile({ full_name: fullName });
    currentProfile.full_name = fullName;
    updateUserUI();
    showToast("Profile updated successfully", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword.length < 8) {
    showToast("Password must be at least 8 characters", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("Passwords do not match", "error");
    return;
  }

  try {
    // verify old password
    await api.auth.signIn({
      email: currentUser.email,
      password: currentPassword,
    });

    // update password
    await api.auth.updatePassword({
      new_password: newPassword,
    });

    showToast("Password changed successfully", "success");
    e.target.reset();
  } catch (err) {
    showToast("Incorrect current password", "error");
  }
}

/* ===============================
   LOGOUT
================================= */
async function handleLogout(e) {
  if (e) e.preventDefault();
  await api.auth.signOut();
  window.location.href = "./auth/login.html";
}

document.addEventListener("DOMContentLoaded", initDashboard);
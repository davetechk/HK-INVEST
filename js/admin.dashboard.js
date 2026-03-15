// js/admin.dashboard.js
import { api } from "./api.js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

/* ============================================================
   STATE
   ============================================================ */
let currentAdmin  = null;
let currentProfile= null;
let currentPerms  = null;
let currentRoute  = "overview";

/* ============================================================
   HELPERS
   ============================================================ */
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
  const icons = { success: "fa-check-circle", error: "fa-times-circle", info: "fa-info-circle", warning: "fa-exclamation-circle" };
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(node);
  setTimeout(() => { if (node.parentElement) node.remove(); }, 4000);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(amount || 0));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return dateStr; }
}

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
}

function badge(status) {
  const map = {
    approved: "badge-approved", active: "badge-active",
    pending: "badge-pending", pending_verification: "badge-pending",
    rejected: "badge-rejected",
    suspended: "badge-suspended",
    draft: "badge-draft",
    completed: "badge-completed",
    open: "badge-open", closed: "badge-closed",
    "in progress": "badge-pending",
  };
  const key = (status || "").toLowerCase().replace(/_/g, " ");
  return `<span class="badge ${map[key] || "badge-draft"}">${status || "Unknown"}</span>`;
}

function emptyState(icon, title, subtitle) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i class="fas ${icon}"></i></div>
      <h3>${title}</h3>
      <p>${subtitle}</p>
    </div>
  `;
}

function errorState(msg = "Unable to load data. Please refresh.") {
  return `<div class="inline-error"><i class="fas fa-exclamation-triangle"></i> ${msg}</div>`;
}

function skeletonGrid(count = 4) {
  return `<div class="stats-grid">${Array(count).fill(`<div class="skeleton skeleton-card"></div>`).join("")}</div>`;
}

function skeletonRows(count = 5) {
  return `<div style="padding:1rem">${Array(count).fill(`<div class="skeleton skeleton-row" style="margin-bottom:2px"></div>`).join("")}</div>`;
}

/* ============================================================
   SUPABASE REST HELPER
   ============================================================ */
async function adminFetch(path, options = {}) {
  const { data: sd } = await supabase.auth.getSession();
  const token = sd?.session?.access_token;
  if (!token) throw new Error("No session.");

  const url    = `${SUPABASE_URL}/rest/v1/${path}`;
  const method = options.method || "GET";

  const res = await fetch(url, {
    method,
    headers: {
      apikey:         SUPABASE_ANON_KEY,
      Authorization:  `Bearer ${token}`,
      Accept:         "application/json",
      "Content-Type": "application/json",
      Prefer:         options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json;
}

/* ============================================================
   AUDIT LOG WRITER
   ============================================================ */
async function writeAuditLog({ action, targetType, targetId, targetLabel, oldValue, newValue, notes }) {
  try {
    await adminFetch("audit_logs", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        admin_id:     currentAdmin?.id,
        admin_name:   currentProfile?.full_name || "Admin",
        action,
        target_type:  targetType,
        target_id:    targetId,
        target_label: targetLabel,
        old_value:    oldValue  || null,
        new_value:    newValue  || null,
        notes:        notes     || null,
      },
    });
  } catch (err) {
    console.warn("Audit log failed:", err.message);
  }
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  showLoading();
  try {
    // Session check
    const { data: sd } = await supabase.auth.getSession();
    const session = sd?.session || null;
    if (!session?.user?.id) return goToLogin();

    currentAdmin = session.user;

    // Profile check
    const pRes  = await api.profile.getMyProfile();
    currentProfile = pRes?.data || null;
    if (!currentProfile) return goToLogin();
    if (currentProfile.role !== "admin") return goToLogin();
    if (currentProfile.status !== "approved") return goToLogin();

    // Permissions check
    const permsData = await adminFetch(
      `admin_permissions?user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`
    );
    currentPerms = Array.isArray(permsData) ? permsData[0] : null;
    if (!currentPerms || !currentPerms.is_active) return goToLogin();

    // Update UI
    updateAdminUI();
    setupListeners();
    applyPermissionVisibility();

    await loadRoute("overview");
  } catch (err) {
    console.error("Admin init error:", err);
    goToLogin();
  } finally {
    hideLoading();
  }
}

function goToLogin() {
  window.location.href = new URL("login.html", window.location.href).toString();
}

/* ============================================================
   UI SETUP
   ============================================================ */
function updateAdminUI() {
  const name     = currentProfile?.full_name || "Admin";
  const initials = name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const type     = currentPerms?.admin_type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Admin";
  const email    = currentAdmin?.email || "";

  const el = id => document.getElementById(id);
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  const setHtml = (id, val) => { const e = el(id); if (e) e.textContent = val; };

  set("sidebarName",   name);
  set("sidebarType",   type);
  set("topbarName",    name);
  set("topbarRole",    type);
  set("dropdownName",  name);
  set("dropdownEmail", email);

  ["sidebarAvatar", "topbarAvatar"].forEach(id => {
    const e = el(id);
    if (e) e.textContent = initials;
  });
}

function applyPermissionVisibility() {
  document.querySelectorAll("[data-permission]").forEach(item => {
    const perm = item.dataset.permission;
    if (!currentPerms?.[perm]) item.classList.add("disabled");
  });
}

function setupListeners() {
  // Sidebar nav
  document.querySelectorAll(".nav-item[data-route]").forEach(item => {
    item.addEventListener("click", async e => {
      e.preventDefault();
      if (item.classList.contains("disabled")) return;
      await loadRoute(item.dataset.route);
    });
  });

  // Logout buttons
  ["logoutBtn", "dropdownLogout"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", handleLogout);
  });

  // Mobile menu
  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("active");
    document.getElementById("mobileOverlay")?.classList.toggle("active");
  });

  document.getElementById("sidebarClose")?.addEventListener("click", closeMobile);
  document.getElementById("mobileOverlay")?.addEventListener("click", closeMobile);

  // Profile dropdown
  document.getElementById("topbarProfile")?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("profileDropdown")?.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    document.getElementById("profileDropdown")?.classList.remove("active");
  });
}

function closeMobile() {
  document.getElementById("sidebar")?.classList.remove("active");
  document.getElementById("mobileOverlay")?.classList.remove("active");
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.route === route);
  });

  const titles = {
    overview:     "Overview",
    users:        "User Management",
    admins:       "Admin Management",
    farms:        "Farms Management",
    investments:  "Investments Monitoring",
    transactions: "Transactions & Finance",
    updates:      "Updates & Reports",
    documents:    "Documents",
    support:      "Support Tickets",
    notifications:"Notifications",
    audit:        "Audit Logs",
    settings:     "Settings",
  };

  const title = titles[route] || route;
  const el = id => document.getElementById(id);
  const t = el("pageTitle");
  if (t) t.textContent = title;
  const b = el("pageBreadcrumb");
  if (b) b.textContent = `Admin / ${title}`;
}

/* ============================================================
   ROUTER
   ============================================================ */
async function loadRoute(route) {
  const content = document.getElementById("contentArea");
  if (!content) return;

  currentRoute = route;
  setActiveNav(route);
  closeMobile();
  showLoading();

  try {
    switch (route) {
      case "overview":     await renderOverview(content);     break;
      case "users":        await renderUsers(content);        break;
      case "admins":       await renderAdmins(content);       break;
      case "farms":        await renderFarms(content);        break;
      case "investments":  await renderInvestments(content);  break;
      case "transactions": await renderTransactions(content); break;
      case "updates":      await renderUpdates(content);      break;
      case "documents":    await renderDocuments(content);    break;
      case "support":      await renderSupport(content);      break;
      case "notifications":await renderNotifications(content);break;
      case "audit":        await renderAuditLogs(content);    break;
      case "settings":     await renderSettings(content);     break;
      default:
        content.innerHTML = emptyState("fa-tools", "Coming Soon", "This section is under construction.");
    }
  } catch (err) {
    console.error("Route error:", err);
    content.innerHTML = errorState("Error loading page. Please try again.");
  } finally {
    hideLoading();
    bindInnerRoutes(content);
  }
}

function bindInnerRoutes(container) {
  container.querySelectorAll("[data-route]").forEach(item => {
    item.addEventListener("click", async e => {
      e.preventDefault();
      const r = item.dataset.route;
      if (r) await loadRoute(r);
    });
  });
}

/* ============================================================
   OVERVIEW
   ============================================================ */
async function renderOverview(content) {
  content.innerHTML = skeletonGrid(8);

  let users = [], farms = [], investments = [], tickets = [];

  try {
    // Simple queries — no joins, just what we need
    [users, farms, investments, tickets] = await Promise.allSettled([
      adminFetch("profiles?select=id,full_name,role,status,created_at&order=created_at.desc"),
      adminFetch("farms?select=id,status&order=created_at.desc"),
      adminFetch("investments?select=id,status,amount_invested&order=created_at.desc"),
      adminFetch("support_tickets?select=id,status&order=created_at.desc"),
    ]).then(results => results.map(r => r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []));
  } catch { users = []; farms = []; investments = []; tickets = []; }

  const totalUsers    = users.length;
  const investors     = users.filter(u => u.role === "investor").length;
  const farmers       = users.filter(u => u.role === "farmer").length;
  const agents        = users.filter(u => u.role === "agent").length;
  const pending       = users.filter(u => u.status === "pending").length;
  const activeFarms   = farms.filter(f => f.status === "active").length;
  const activeInv     = investments.filter(i => i.status === "active").length;
  const openTickets   = tickets.filter(t => t.status === "open").length;
  const totalInvested = investments.reduce((s, i) => s + Number(i.amount_invested || 0), 0);

  // Update badges
  const pb = document.getElementById("pendingBadge");
  if (pb) { pb.textContent = pending; pb.style.display = pending > 0 ? "" : "none"; }
  const tb = document.getElementById("ticketsBadge");
  if (tb) { tb.textContent = openTickets; tb.style.display = openTickets > 0 ? "" : "none"; }

  // Recent users (last 5)
  const recentUsers = users.slice(0, 5);

  content.innerHTML = `
    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Total Users</div>
          <div class="stat-card-icon gold"><i class="fas fa-users"></i></div>
        </div>
        <div class="stat-card-value">${totalUsers}</div>
        <div class="stat-card-sub">All registered accounts</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Pending Approvals</div>
          <div class="stat-card-icon orange"><i class="fas fa-clock"></i></div>
        </div>
        <div class="stat-card-value">${pending}</div>
        <div class="stat-card-sub">Awaiting review</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Investors</div>
          <div class="stat-card-icon blue"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="stat-card-value">${investors}</div>
        <div class="stat-card-sub">Active investor accounts</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Farmers</div>
          <div class="stat-card-icon green"><i class="fas fa-tractor"></i></div>
        </div>
        <div class="stat-card-value">${farmers}</div>
        <div class="stat-card-sub">Registered farmers</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Agents</div>
          <div class="stat-card-icon gold"><i class="fas fa-handshake"></i></div>
        </div>
        <div class="stat-card-value">${agents}</div>
        <div class="stat-card-sub">Platform agents</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Active Farms</div>
          <div class="stat-card-icon green"><i class="fas fa-seedling"></i></div>
        </div>
        <div class="stat-card-value">${activeFarms}</div>
        <div class="stat-card-sub">Currently in production</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Total Invested</div>
          <div class="stat-card-icon gold"><i class="fas fa-coins"></i></div>
        </div>
        <div class="stat-card-value">${formatCurrency(totalInvested)}</div>
        <div class="stat-card-sub">Across all investments</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div class="stat-card-label">Open Tickets</div>
          <div class="stat-card-icon red"><i class="fas fa-headset"></i></div>
        </div>
        <div class="stat-card-value">${openTickets}</div>
        <div class="stat-card-sub">Unresolved support tickets</div>
      </div>
    </div>

    <!-- Recent signups -->
    <div class="section-card">
      <div class="section-card-header">
        <div>
          <div class="section-card-title">Recent Signups</div>
          <div class="section-card-sub">Latest registered accounts</div>
        </div>
        <button class="btn btn-secondary btn-sm" data-route="users">View All</button>
      </div>
      <div class="table-wrap">
        ${recentUsers.length === 0
          ? emptyState("fa-users", "No users yet", "New signups will appear here.")
          : `<table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${recentUsers.map(u => `
                  <tr>
                    <td>${u.full_name || "—"}</td>
                    <td><span style="text-transform:capitalize">${u.role || "—"}</span></td>
                    <td>${badge(u.status)}</td>
                    <td>${formatDate(u.created_at)}</td>
                    <td>
                      <button class="btn btn-secondary btn-sm view-user-btn" data-id="${u.id}">
                        View
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
        }
      </div>
    </div>

    <!-- Alerts section -->
    ${pending > 0 ? `
    <div class="section-card" style="border-color:rgba(201,168,76,0.3)">
      <div class="section-card-header">
        <div>
          <div class="section-card-title" style="color:var(--accent)">
            <i class="fas fa-exclamation-circle" style="margin-right:0.5rem"></i>
            Action Required
          </div>
          <div class="section-card-sub">${pending} account(s) waiting for approval</div>
        </div>
        <button class="btn btn-primary btn-sm" data-route="users">Review Now</button>
      </div>
    </div>` : ""}
  `;

  // Bind view user buttons
  content.querySelectorAll(".view-user-btn").forEach(btn => {
    btn.addEventListener("click", () => loadRoute("users"));
  });
}

/* ============================================================
   USER MANAGEMENT
   ============================================================ */
async function renderUsers(content) {
  content.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Role</label>
        <select class="filter-select" id="filterRole">
          <option value="">All Roles</option>
          <option value="investor">Investor</option>
          <option value="farmer">Farmer</option>
          <option value="agent">Agent</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="filter-select" id="filterStatus">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Search</label>
        <input type="text" class="filter-input" id="filterSearch" placeholder="Name or email...">
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <div>
          <div class="section-card-title">All Users</div>
          <div class="section-card-sub" id="userCount">Loading...</div>
        </div>
      </div>
      <div id="usersTableArea">${skeletonRows()}</div>
    </div>
  `;

  let users = [];
  try {
    // Fetch profiles — email column should now be synced from auth.users
    users = await adminFetch(
      "profiles?select=id,full_name,email,role,status,created_at,last_login_at,phone&order=created_at.desc"
    );
    if (!Array.isArray(users)) users = [];

    // If email is still missing on some profiles, try to fill from auth.users
    // by calling a second query for any user where email is null
    const missingEmail = users.filter(u => !u.email);
    if (missingEmail.length > 0) {
      // Fetch auth users to get emails - admin has access via service role patterns
      try {
        const { data: sd } = await supabase.auth.getSession();
        const token = sd?.session?.access_token;
        // Use Supabase auth admin API to get user list
        const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
          headers: {
            apikey:        SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          const authUsers = authData?.users || [];
          // Merge emails into profiles
          const emailMap = {};
          authUsers.forEach(u => { emailMap[u.id] = u.email; });
          users = users.map(u => ({ ...u, email: u.email || emailMap[u.id] || "—" }));
        }
      } catch { /* ignore — email just shows — */ }
    }

  } catch {
    document.getElementById("usersTableArea").innerHTML = errorState();
    return;
  }

  function renderTable(list) {
    const area    = document.getElementById("usersTableArea");
    const countEl = document.getElementById("userCount");
    if (!area) return;

    if (countEl) countEl.textContent = `${list.length} user${list.length !== 1 ? "s" : ""}`;

    if (list.length === 0) {
      area.innerHTML = emptyState("fa-users", "No users found", "No accounts match your filters.");
      return;
    }

    area.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(u => {
              // Never show action buttons on admin accounts
              // Super admins are fully protected
              const isAdmin      = u.role === "admin";
              const isSelf       = u.id   === currentAdmin?.id;
              const isProtected  = isAdmin || isSelf;

              return `
              <tr>
                <td><strong>${u.full_name || "—"}</strong></td>
                <td style="font-family:var(--mono);font-size:0.75rem;color:var(--muted)">${u.email || "—"}</td>
                <td>
                  <span style="text-transform:capitalize">${u.role || "—"}</span>
                  ${isAdmin ? '<span class="badge badge-pending" style="margin-left:0.4rem;font-size:0.55rem">Admin</span>' : ""}
                </td>
                <td>${badge(u.status)}</td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                  <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
                    ${isProtected
                      ? `<span style="font-size:0.72rem;color:var(--faint)">${isSelf ? "You" : "Protected"}</span>`
                      : `
                        ${u.status === "pending" ? `
                          <button class="btn btn-success btn-sm approve-btn" data-id="${u.id}" data-name="${u.full_name || "User"}">Approve</button>
                          <button class="btn btn-danger btn-sm reject-btn" data-id="${u.id}" data-name="${u.full_name || "User"}">Reject</button>
                        ` : ""}
                        ${u.status === "approved" ? `
                          <button class="btn btn-secondary btn-sm suspend-btn" data-id="${u.id}" data-name="${u.full_name || "User"}">Suspend</button>
                        ` : ""}
                        ${u.status === "suspended" ? `
                          <button class="btn btn-success btn-sm reactivate-btn" data-id="${u.id}" data-name="${u.full_name || "User"}">Reactivate</button>
                        ` : ""}
                        ${u.status === "rejected" ? `
                          <button class="btn btn-success btn-sm approve-btn" data-id="${u.id}" data-name="${u.full_name || "User"}">Approve</button>
                        ` : ""}
                      `
                    }
                  </div>
                </td>
              </tr>
            `}).join("")}
          </tbody>
        </table>
      </div>
    `;

    bindUserActions(area, users);
  }

  renderTable(users);

  // Filters
  function applyFilters() {
    const role   = document.getElementById("filterRole")?.value   || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const search = (document.getElementById("filterSearch")?.value || "").toLowerCase();
    renderTable(users.filter(u =>
      (!role   || u.role   === role)   &&
      (!status || u.status === status) &&
      (!search ||
        (u.full_name || "").toLowerCase().includes(search) ||
        (u.email     || "").toLowerCase().includes(search))
    ));
  }

  document.getElementById("filterRole")?.addEventListener("change",   applyFilters);
  document.getElementById("filterStatus")?.addEventListener("change", applyFilters);
  document.getElementById("filterSearch")?.addEventListener("input",  applyFilters);
}

function bindUserActions(area, users) {
  // Approve
  area.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`Approve ${name}?`)) return;
      await updateUserStatus(id, "approved", name, btn);
    });
  });

  // Reject
  area.querySelectorAll(".reject-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name;
      const reason = prompt(`Reason for rejecting ${name} (optional):`);
      if (reason === null) return;
      await updateUserStatus(id, "rejected", name, btn, reason);
    });
  });

  // Suspend
  area.querySelectorAll(".suspend-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`Suspend ${name}? They will lose dashboard access.`)) return;
      await updateUserStatus(id, "suspended", name, btn);
    });
  });

  // Reactivate
  area.querySelectorAll(".reactivate-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`Reactivate ${name}?`)) return;
      await updateUserStatus(id, "approved", name, btn);
    });
  });
}

async function updateUserStatus(userId, newStatus, userName, btn, reason = null) {
  const row = btn?.closest("tr");
  btn.disabled = true;

  try {
    const oldUser = await adminFetch(`profiles?id=eq.${userId}&select=status&limit=1`);
    const oldStatus = Array.isArray(oldUser) ? oldUser[0]?.status : null;

    const body = { status: newStatus };
    if (reason) body.rejection_reason = reason;
    if (newStatus === "suspended") body.suspended_at = new Date().toISOString();

    await adminFetch(`profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body,
    });

    await writeAuditLog({
      action:      `user_${newStatus}`,
      targetType:  "user",
      targetId:    userId,
      targetLabel: userName,
      oldValue:    { status: oldStatus },
      newValue:    { status: newStatus },
      notes:       reason || null,
    });

    showToast(`${userName} has been ${newStatus}.`, "success");

    // Refresh table
    await renderUsers(document.getElementById("contentArea"));
  } catch (err) {
    showToast(err.message || "Action failed.", "error");
    btn.disabled = false;
  }
}

/* ============================================================
   ADMIN MANAGEMENT
   ============================================================ */
async function renderAdmins(content) {

  // Only block non-super-admins from this page
  // Super admin always gets in regardless of can_manage_admins flag
  const isSuperAdmin = currentPerms?.admin_type === "super_admin";
  if (!isSuperAdmin && !currentPerms?.can_manage_admins) {
    content.innerHTML = emptyState("fa-lock", "Access Restricted", "Only Super Admins can manage admin accounts.");
    return;
  }

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:1.25rem">
      <button class="btn btn-primary" id="addAdminBtn">
        <i class="fas fa-plus"></i> Add Admin
      </button>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">Admin Accounts</div>
      </div>
      <div id="adminsArea">${skeletonRows()}</div>
    </div>
  `;

  // Bind Add Admin button immediately after HTML is set
  document.getElementById("addAdminBtn")?.addEventListener("click", () => showAddAdminModal());

  let admins    = [];
  let allProfiles = [];

  try {
    // Fetch permissions and profiles separately — avoid join issues
    [admins, allProfiles] = await Promise.all([
      adminFetch("admin_permissions?select=*&order=created_at.desc"),
      adminFetch("profiles?select=id,full_name,email,status&order=created_at.desc"),
    ]);

    if (!Array.isArray(admins))     admins     = [];
    if (!Array.isArray(allProfiles)) allProfiles = [];

    // Merge profile data into admins manually
    const profileMap = {};
    allProfiles.forEach(p => { profileMap[p.id] = p; });
    admins = admins.map(a => ({
      ...a,
      profile: profileMap[a.user_id] || null,
    }));

  } catch (err) {
    document.getElementById("adminsArea").innerHTML = errorState(err.message || "Failed to load admins.");
    return;
  }

  const area = document.getElementById("adminsArea");
  if (!area) return;

  if (admins.length === 0) {
    area.innerHTML = emptyState("fa-user-shield", "No admins yet", "Add your first admin account.");
    return;
  }

  area.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Admin Type</th>
            <th>Status</th>
            <th>Added</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${admins.map(a => `
            <tr>
              <td><strong>${a.profile?.full_name || "—"}</strong></td>
              <td style="font-family:var(--mono);font-size:0.75rem;color:var(--muted)">
                ${a.profile?.email || "—"}
              </td>
              <td>
                <span class="badge badge-pending" style="text-transform:capitalize">
                  ${(a.admin_type || "").replace(/_/g, " ")}
                </span>
              </td>
              <td>
                ${a.is_active
                  ? '<span class="badge badge-approved">Active</span>'
                  : '<span class="badge badge-rejected">Inactive</span>'
                }
              </td>
              <td>${formatDate(a.created_at)}</td>
              <td>
                ${a.user_id !== currentAdmin?.id
                  ? `<button class="btn btn-danger btn-sm deactivate-admin-btn"
                       data-id="${a.user_id}"
                       data-active="${a.is_active}"
                       data-name="${a.profile?.full_name || ""}">
                       ${a.is_active ? "Deactivate" : "Reactivate"}
                     </button>`
                  : '<span style="font-size:0.75rem;color:var(--faint)">You</span>'
                }
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Deactivate / Reactivate
  area.querySelectorAll(".deactivate-admin-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id       = btn.dataset.id;
      const name     = btn.dataset.name;
      const isActive = btn.dataset.active === "true";
      const action   = isActive ? "deactivate" : "reactivate";
      if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} admin: ${name}?`)) return;
      btn.disabled = true;
      try {
        await adminFetch(`admin_permissions?user_id=eq.${id}`, {
          method: "PATCH", prefer: "return=minimal",
          body: { is_active: !isActive },
        });
        await writeAuditLog({ action: `admin_${action}d`, targetType: "admin", targetId: id, targetLabel: name });
        showToast(`${name} has been ${action}d.`, "success");
        await renderAdmins(document.getElementById("contentArea"));
      } catch (err) {
        showToast(err.message || "Action failed.", "error");
        btn.disabled = false;
      }
    });
  });
}

function showAddAdminModal() {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Add New Admin</div>
        <button class="modal-close" id="closeModal">×</button>
      </div>
      <div class="modal-body">
        <p style="font-size:0.825rem;color:var(--muted);margin-bottom:1.25rem;line-height:1.6">
          The user must already have an account. Enter their email to find them and assign admin access.
        </p>
        <div id="addAdminError" class="inline-error" style="display:none"></div>
        <div class="form-group" style="margin-bottom:1rem">
          <label class="form-label">User Email</label>
          <input type="email" class="form-input" id="newAdminEmail" placeholder="user@hkinvest.com">
        </div>
        <div class="form-group" style="margin-bottom:1rem">
          <label class="form-label">Admin Type</label>
          <select class="form-select" id="newAdminType">
            <option value="operations">Operations Admin</option>
            <option value="finance">Finance Admin</option>
            <option value="support">Support Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelModal">Cancel</button>
        <button class="btn btn-primary" id="confirmAddAdmin">Add Admin</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#closeModal")?.addEventListener("click", close);
  modal.querySelector("#cancelModal")?.addEventListener("click", close);

  modal.querySelector("#confirmAddAdmin")?.addEventListener("click", async () => {
    const email = modal.querySelector("#newAdminEmail")?.value.trim().toLowerCase();
    const type  = modal.querySelector("#newAdminType")?.value;
    const errEl = modal.querySelector("#addAdminError");
    const btn   = modal.querySelector("#confirmAddAdmin");

    if (!email) {
      errEl.textContent    = "Email is required.";
      errEl.style.display  = "flex";
      return;
    }

    btn.disabled    = true;
    btn.textContent = "Searching...";
    errEl.style.display = "none";

    try {
      // Search profiles by email (synced from auth.users via our trigger)
      const found = await adminFetch(
        `profiles?email=ilike.${encodeURIComponent(email)}&select=id,full_name,role,email&limit=1`
      );
      const user = Array.isArray(found) && found.length > 0 ? found[0] : null;

      if (!user) {
        throw new Error(
          `No account found for "${email}". ` +
          `Make sure the user has signed up and their email is synced. ` +
          `Try running fix_users_and_tickets.sql again if needed.`
        );
      }

      if (user.role === "admin") {
        throw new Error(`${user.full_name || email} is already an admin.`);
      }

      btn.textContent = "Adding...";

      // Permission presets
      const presets = {
        super_admin: {
          can_manage_admins: true, can_manage_users: true, can_manage_farms: true,
          can_manage_finance: true, can_manage_support: true, can_manage_notifications: true,
          can_view_logs: true, can_manage_settings: true,
        },
        operations: {
          can_manage_admins: false, can_manage_users: true, can_manage_farms: true,
          can_manage_finance: false, can_manage_support: true, can_manage_notifications: false,
          can_view_logs: false, can_manage_settings: false,
        },
        finance: {
          can_manage_admins: false, can_manage_users: false, can_manage_farms: false,
          can_manage_finance: true, can_manage_support: false, can_manage_notifications: false,
          can_view_logs: false, can_manage_settings: false,
        },
        support: {
          can_manage_admins: false, can_manage_users: false, can_manage_farms: false,
          can_manage_finance: false, can_manage_support: true, can_manage_notifications: true,
          can_view_logs: false, can_manage_settings: false,
        },
      };

      // Step 1: Update profile role and status
      await adminFetch(`profiles?id=eq.${user.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { role: "admin", status: "approved" },
      });

      // Step 2: Check if permissions record already exists
      const existingPerms = await adminFetch(
        `admin_permissions?user_id=eq.${user.id}&select=id&limit=1`
      );
      const permExists = Array.isArray(existingPerms) && existingPerms.length > 0;

      const permPayload = {
        admin_type: type,
        ...presets[type] || presets.support,
        is_active: true,
      };

      if (permExists) {
        await adminFetch(`admin_permissions?user_id=eq.${user.id}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: permPayload,
        });
      } else {
        await adminFetch("admin_permissions", {
          method: "POST",
          prefer: "return=minimal",
          body: { user_id: user.id, created_by: currentAdmin.id, ...permPayload },
        });
      }

      // Step 3: Audit log
      await writeAuditLog({
        action:      "admin_added",
        targetType:  "admin",
        targetId:    user.id,
        targetLabel: user.full_name || email,
        newValue:    { admin_type: type, email },
      });

      showToast(`✓ ${user.full_name || email} added as ${type.replace(/_/g, " ")}.`, "success");
      close();
      await loadRoute("admins");

    } catch (err) {
      errEl.textContent   = err.message || "Failed to add admin. Please try again.";
      errEl.style.display = "flex";
      btn.disabled        = false;
      btn.textContent     = "Add Admin";
    }
  });
}

/* ============================================================
   FARMS MANAGEMENT
   ============================================================ */
async function renderFarms(content) {
  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:1.25rem">
      <button class="btn btn-primary" id="addFarmBtn"><i class="fas fa-plus"></i> Add Farm</button>
    </div>
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="filter-select" id="farmFilterStatus">
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Search</label>
        <input type="text" class="filter-input" id="farmSearch" placeholder="Farm name, crop, location...">
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">All Farms</div>
      </div>
      <div id="farmsArea">${skeletonRows()}</div>
    </div>
  `;

  let farms = [];
  try {
    farms = await adminFetch("farms?select=*&order=created_at.desc");
    if (!Array.isArray(farms)) farms = [];
  } catch {
    document.getElementById("farmsArea").innerHTML = errorState();
    return;
  }

  function renderFarmsTable(list) {
    const area = document.getElementById("farmsArea");
    if (!area) return;

    if (list.length === 0) {
      area.innerHTML = emptyState("fa-tractor", "No farms yet", "Create your first farm project.");
      return;
    }

    area.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Farm Title</th>
              <th>Crop</th>
              <th>ROI %</th>
              <th>Duration</th>
              <th>Funding Goal</th>
              <th>Raised</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(f => `
              <tr>
                <td><strong>${f.title || "—"}</strong></td>
                <td>${f.crop_type || "—"}</td>
                <td>${f.roi_percent || 0}%</td>
                <td>${f.duration_days ? f.duration_days + " days" : "—"}</td>
                <td>${formatCurrency(f.funding_goal)}</td>
                <td>${formatCurrency(f.funding_raised)}</td>
                <td>${f.risk_level || "—"}</td>
                <td>${badge(f.status)}</td>
                <td>
                  ${f.status !== "active"
                    ? `<button class="btn btn-success btn-sm activate-farm-btn" data-id="${f.id}" data-name="${f.title}">Activate</button>`
                    : `<button class="btn btn-danger btn-sm suspend-farm-btn" data-id="${f.id}" data-name="${f.title}" style="margin-left:0.3rem">Suspend</button>`
                  }
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    // Activate
    area.querySelectorAll(".activate-farm-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(`Activate farm: ${btn.dataset.name}?`)) return;
        btn.disabled = true;
        try {
          await adminFetch(`farms?id=eq.${btn.dataset.id}`, { method: "PATCH", prefer: "return=minimal", body: { status: "active" } });
          await writeAuditLog({ action: "farm_activated", targetType: "farm", targetId: btn.dataset.id, targetLabel: btn.dataset.name, newValue: { status: "active" } });
          showToast(`${btn.dataset.name} activated.`, "success");
          await renderFarms(document.getElementById("contentArea"));
        } catch (err) { showToast(err.message, "error"); btn.disabled = false; }
      });
    });

    // Suspend
    area.querySelectorAll(".suspend-farm-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(`Suspend farm: ${btn.dataset.name}?`)) return;
        btn.disabled = true;
        try {
          await adminFetch(`farms?id=eq.${btn.dataset.id}`, { method: "PATCH", prefer: "return=minimal", body: { status: "suspended" } });
          await writeAuditLog({ action: "farm_suspended", targetType: "farm", targetId: btn.dataset.id, targetLabel: btn.dataset.name, newValue: { status: "suspended" } });
          showToast(`${btn.dataset.name} suspended.`, "warning");
          await renderFarms(document.getElementById("contentArea"));
        } catch (err) { showToast(err.message, "error"); btn.disabled = false; }
      });
    });
  }

  renderFarmsTable(farms);

  // Filters
  document.getElementById("farmFilterStatus")?.addEventListener("change", () => {
    const s = document.getElementById("farmFilterStatus").value;
    const q = (document.getElementById("farmSearch")?.value || "").toLowerCase();
    renderFarmsTable(farms.filter(f =>
      (!s || f.status === s) &&
      (!q || (f.title || "").toLowerCase().includes(q) || (f.crop_type || "").toLowerCase().includes(q))
    ));
  });

  document.getElementById("farmSearch")?.addEventListener("input", () => {
    const s = document.getElementById("farmFilterStatus")?.value || "";
    const q = (document.getElementById("farmSearch").value || "").toLowerCase();
    renderFarmsTable(farms.filter(f =>
      (!s || f.status === s) &&
      (!q || (f.title || "").toLowerCase().includes(q) || (f.crop_type || "").toLowerCase().includes(q))
    ));
  });

  document.getElementById("addFarmBtn")?.addEventListener("click", () => showAddFarmModal());
}

function showAddFarmModal() {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Add New Farm</div>
        <button class="modal-close" id="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div id="addFarmError" class="inline-error" style="display:none"></div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Farm Title *</label>
            <input type="text" class="form-input" id="farmTitle" placeholder="GreenHarvest Maize Farm">
          </div>
          <div class="form-group">
            <label class="form-label">Crop Type</label>
            <input type="text" class="form-input" id="farmCrop" placeholder="Maize, Rice, Cassava...">
          </div>
          <div class="form-group">
            <label class="form-label">ROI % (Expected)</label>
            <input type="number" class="form-input" id="farmRoi" placeholder="18">
          </div>
          <div class="form-group">
            <label class="form-label">Duration (Days)</label>
            <input type="number" class="form-input" id="farmDuration" placeholder="180">
          </div>
          <div class="form-group">
            <label class="form-label">Funding Goal (₦)</label>
            <input type="number" class="form-input" id="farmGoal" placeholder="5000000">
          </div>
          <div class="form-group">
            <label class="form-label">Risk Level</label>
            <select class="form-select" id="farmRisk">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelModal">Cancel</button>
        <button class="btn btn-primary" id="confirmAddFarm">Create Farm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#closeModal")?.addEventListener("click", close);
  modal.querySelector("#cancelModal")?.addEventListener("click", close);

  modal.querySelector("#confirmAddFarm")?.addEventListener("click", async () => {
    const title  = modal.querySelector("#farmTitle")?.value.trim();
    const errEl  = modal.querySelector("#addFarmError");
    const btn    = modal.querySelector("#confirmAddFarm");

    if (!title) { errEl.textContent = "Farm title is required."; errEl.style.display = "flex"; return; }

    btn.disabled = true; btn.textContent = "Creating...";

    try {
      const created = await adminFetch("farms", {
        method: "POST",
        body: {
          title,
          crop_type:     modal.querySelector("#farmCrop")?.value.trim()     || null,
          roi_percent:   Number(modal.querySelector("#farmRoi")?.value)      || 0,
          duration_days: Number(modal.querySelector("#farmDuration")?.value) || null,
          funding_goal:  Number(modal.querySelector("#farmGoal")?.value)     || 0,
          funding_raised: 0,
          risk_level:    modal.querySelector("#farmRisk")?.value             || "medium",
          status:        "draft",
        },
      });

      const farmId = Array.isArray(created) ? created[0]?.id : created?.id;
      await writeAuditLog({ action: "farm_created", targetType: "farm", targetId: farmId, targetLabel: title, newValue: { title } });
      showToast(`Farm "${title}" created.`, "success");
      close();
      await renderFarms(document.getElementById("contentArea"));
    } catch (err) {
      errEl.textContent = err.message || "Failed to create farm.";
      errEl.style.display = "flex";
      btn.disabled = false; btn.textContent = "Create Farm";
    }
  });
}

/* ============================================================
   INVESTMENTS MONITORING
   ============================================================ */
async function renderInvestments(content) {
  content.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="filter-select" id="invFilterStatus">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Search</label>
        <input type="text" class="filter-input" id="invSearch" placeholder="Investor name...">
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">All Investments</div>
      </div>
      <div id="invArea">${skeletonRows()}</div>
    </div>
  `;

  let investments = [];
  let invProfilesMap = {};
  let invFarmsMap = {};

  try {
    // Fetch all three separately — no joins needed
    const [invRes, profilesRes, farmsRes] = await Promise.all([
      adminFetch("investments?select=*&order=created_at.desc"),
      adminFetch("profiles?select=id,full_name,email"),
      adminFetch("farms?select=id,title"),
    ]);

    investments = Array.isArray(invRes) ? invRes : [];
    if (Array.isArray(profilesRes)) profilesRes.forEach(p => { invProfilesMap[p.id] = p; });
    if (Array.isArray(farmsRes))    farmsRes.forEach(f => { invFarmsMap[f.id] = f.title; });

  } catch (err) {
    document.getElementById("invArea").innerHTML = errorState(err.message);
    return;
  }

  const area = document.getElementById("invArea");

  if (investments.length === 0) {
    area.innerHTML = emptyState("fa-chart-line", "No investments yet", "Investments will appear here once investors fund a farm.");
    return;
  }

  area.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Investor</th><th>Farm</th><th>Amount</th><th>Expected ROI</th><th>Status</th><th>Payout Status</th><th>Date</th></tr>
        </thead>
        <tbody>
          ${investments.map(i => {
            const profile = invProfilesMap[i.investor_id] || {};
            const farmTitle = invFarmsMap[i.farm_id] || i.farm_name || "—";
            return `
              <tr>
                <td>
                  <strong>${profile.full_name || "—"}</strong><br>
                  <span style="font-size:0.72rem;color:var(--muted)">${profile.email || ""}</span>
                </td>
                <td>${farmTitle}</td>
                <td>${formatCurrency(i.amount_invested)}</td>
                <td>${formatCurrency(i.expected_return)}</td>
                <td>${badge(i.status)}</td>
                <td>${badge(i.payout_status || "pending")}</td>
                <td>${formatDate(i.created_at)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================================
   TRANSACTIONS
   ============================================================ */
async function renderTransactions(content) {
  content.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Type</label>
        <select class="filter-select" id="txnType">
          <option value="">All</option>
          <option value="deposit">Deposit</option>
          <option value="payout">Payout</option>
          <option value="refund">Refund</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="filter-select" id="txnStatus">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">All Transactions</div>
      </div>
      <div id="txnArea">${skeletonRows()}</div>
    </div>
  `;

  let txns = [];
  try {
    txns = await adminFetch("transactions?select=*,profiles(full_name,email)&order=created_at.desc");
    if (!Array.isArray(txns)) txns = [];
  } catch {
    document.getElementById("txnArea").innerHTML = errorState();
    return;
  }

  function renderTxnTable(list) {
    const area = document.getElementById("txnArea");
    if (!area) return;
    if (list.length === 0) { area.innerHTML = emptyState("fa-exchange-alt", "No transactions yet", "Transactions will appear here."); return; }

    area.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Investor</th><th>Type</th><th>Amount</th><th>Reference</th><th>Status</th><th>Payout State</th><th>Date</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${list.map(t => `
              <tr>
                <td><strong>${t.profiles?.full_name || "—"}</strong></td>
                <td style="text-transform:capitalize">${t.type || "—"}</td>
                <td>${formatCurrency(t.amount)}</td>
                <td style="font-family:var(--mono);font-size:0.7rem">${t.reference || "—"}</td>
                <td>${badge(t.status)}</td>
                <td>${badge(t.payout_state || "n/a")}</td>
                <td>${formatDate(t.created_at)}</td>
                <td>
                  ${t.status === "pending" ? `<button class="btn btn-success btn-sm confirm-txn-btn" data-id="${t.id}">Confirm</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    area.querySelectorAll(".confirm-txn-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await adminFetch(`transactions?id=eq.${btn.dataset.id}`, {
            method: "PATCH", prefer: "return=minimal",
            body: { status: "completed", confirmed_by: currentAdmin.id, confirmed_at: new Date().toISOString() },
          });
          await writeAuditLog({ action: "transaction_confirmed", targetType: "transaction", targetId: btn.dataset.id, newValue: { status: "completed" } });
          showToast("Transaction confirmed.", "success");
          await renderTransactions(document.getElementById("contentArea"));
        } catch (err) { showToast(err.message, "error"); btn.disabled = false; }
      });
    });
  }

  renderTxnTable(txns);

  document.getElementById("txnType")?.addEventListener("change", () => {
    const t = document.getElementById("txnType").value;
    const s = document.getElementById("txnStatus")?.value || "";
    renderTxnTable(txns.filter(x => (!t || x.type === t) && (!s || x.status === s)));
  });

  document.getElementById("txnStatus")?.addEventListener("change", () => {
    const t = document.getElementById("txnType")?.value || "";
    const s = document.getElementById("txnStatus").value;
    renderTxnTable(txns.filter(x => (!t || x.type === t) && (!s || x.status === s)));
  });
}

/* ============================================================
   UPDATES & REPORTS
   ============================================================ */
async function renderUpdates(content) {
  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:1.25rem">
      <button class="btn btn-primary" id="addUpdateBtn">
        <i class="fas fa-plus"></i> New Update
      </button>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">Farm Updates</div>
      </div>
      <div id="updatesArea">${skeletonRows()}</div>
    </div>
  `;

  document.getElementById("addUpdateBtn")?.addEventListener("click", () => showAddUpdateModal());

  let updates = [];
  let farmsMap = {};

  try {
    // Fetch updates and farms separately to avoid join issues
    const [updatesRes, farmsRes] = await Promise.all([
      adminFetch("farm_updates?select=id,farm_id,title,body,update_type,review_status,is_pinned,created_at&order=created_at.desc"),
      adminFetch("farms?select=id,title"),
    ]);

    updates = Array.isArray(updatesRes) ? updatesRes : [];

    // Build farm name map
    if (Array.isArray(farmsRes)) {
      farmsRes.forEach(f => { farmsMap[f.id] = f.title; });
    }
  } catch (err) {
    document.getElementById("updatesArea").innerHTML = errorState(err.message || "Unable to load updates.");
    return;
  }

  const area = document.getElementById("updatesArea");
  if (!area) return;

  if (updates.length === 0) {
    area.innerHTML = emptyState("fa-newspaper", "No updates yet", "Farm updates will appear here once agents or admins post them.");
    return;
  }

  area.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Farm</th>
            <th>Type</th>
            <th>Status</th>
            <th>Pinned</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${updates.map(u => `
            <tr>
              <td><strong>${u.title || "—"}</strong></td>
              <td>${farmsMap[u.farm_id] || "—"}</td>
              <td style="text-transform:capitalize">${u.update_type || "general"}</td>
              <td>${badge(u.review_status)}</td>
              <td>${u.is_pinned ? '<span class="badge badge-approved">Pinned</span>' : "—"}</td>
              <td>${formatDate(u.created_at)}</td>
              <td style="display:flex;gap:0.4rem">
                ${u.review_status !== "published"
                  ? `<button class="btn btn-success btn-sm publish-btn" data-id="${u.id}" data-title="${(u.title || "").replace(/"/g, "&quot;")}">Publish</button>`
                  : `<button class="btn btn-secondary btn-sm unpublish-btn" data-id="${u.id}">Unpublish</button>`
                }
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  area.querySelectorAll(".publish-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Publish "${btn.dataset.title}"?`)) return;
      btn.disabled = true;
      try {
        await adminFetch(`farm_updates?id=eq.${btn.dataset.id}`, {
          method: "PATCH", prefer: "return=minimal",
          body: { review_status: "published", reviewed_by: currentAdmin.id, published_at: new Date().toISOString() },
        });
        showToast(`"${btn.dataset.title}" published.`, "success");
        await renderUpdates(document.getElementById("contentArea"));
      } catch (err) { showToast(err.message || "Failed to publish.", "error"); btn.disabled = false; }
    });
  });

  area.querySelectorAll(".unpublish-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Unpublish this update?")) return;
      btn.disabled = true;
      try {
        await adminFetch(`farm_updates?id=eq.${btn.dataset.id}`, {
          method: "PATCH", prefer: "return=minimal",
          body: { review_status: "draft" },
        });
        showToast("Update unpublished.", "warning");
        await renderUpdates(document.getElementById("contentArea"));
      } catch (err) { showToast(err.message || "Failed to unpublish.", "error"); btn.disabled = false; }
    });
  });
}

function showAddUpdateModal() {
  // We need farms list for the dropdown
  adminFetch("farms?select=id,title,status&order=created_at.desc").then(farms => {
    if (!Array.isArray(farms)) farms = [];

    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">New Farm Update</div>
          <button class="modal-close" id="closeUpdateModal">×</button>
        </div>
        <div class="modal-body">
          <div id="updateErr" class="inline-error" style="display:none"></div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Farm</label>
            <select class="form-select" id="updateFarm">
              <option value="">Select a farm...</option>
              ${farms.map(f => `<option value="${f.id}">${f.title} ${f.status !== "active" ? `(${f.status})` : ""}</option>`).join("")}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Title *</label>
            <input type="text" class="form-input" id="updateTitle" placeholder="Update title">
          </div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Type</label>
            <select class="form-select" id="updateType">
              <option value="general">General</option>
              <option value="growth">Growth</option>
              <option value="harvest">Harvest</option>
              <option value="financial">Financial</option>
              <option value="issue">Issue</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Body</label>
            <textarea class="form-textarea" id="updateBody" placeholder="Update content..."></textarea>
          </div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Status</label>
            <select class="form-select" id="updateStatus">
              <option value="draft">Save as Draft</option>
              <option value="published">Publish Immediately</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelUpdateModal">Cancel</button>
          <button class="btn btn-primary" id="saveUpdateBtn">Save Update</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector("#closeUpdateModal")?.addEventListener("click", close);
    modal.querySelector("#cancelUpdateModal")?.addEventListener("click", close);

    modal.querySelector("#saveUpdateBtn")?.addEventListener("click", async () => {
      const title   = modal.querySelector("#updateTitle")?.value.trim();
      const farmId  = modal.querySelector("#updateFarm")?.value;
      const body    = modal.querySelector("#updateBody")?.value.trim();
      const type    = modal.querySelector("#updateType")?.value;
      const status  = modal.querySelector("#updateStatus")?.value;
      const errEl   = modal.querySelector("#updateErr");
      const saveBtn = modal.querySelector("#saveUpdateBtn");

      if (!title) { errEl.textContent = "Title is required."; errEl.style.display = "flex"; return; }

      saveBtn.disabled = true; saveBtn.textContent = "Saving...";

      try {
        await adminFetch("farm_updates", {
          method: "POST", prefer: "return=minimal",
          body: {
            title,
            body:          body || null,
            farm_id:       farmId || null,
            update_type:   type,
            review_status: status,
            author_id:     currentAdmin.id,
            published_at:  status === "published" ? new Date().toISOString() : null,
            reviewed_by:   status === "published" ? currentAdmin.id : null,
          },
        });
        showToast(`Update "${title}" saved.`, "success");
        close();
        await renderUpdates(document.getElementById("contentArea"));
      } catch (err) {
        errEl.textContent = err.message || "Failed to save update.";
        errEl.style.display = "flex";
        saveBtn.disabled = false; saveBtn.textContent = "Save Update";
      }
    });
  }).catch(() => showToast("Could not load farms list.", "error"));
}

/* ============================================================
   DOCUMENTS
   ============================================================ */
async function renderDocuments(content) {
  content.innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">Documents</div>
      </div>
      <div id="docsArea">${skeletonRows()}</div>
    </div>
  `;

  let docs = [];
  try {
    docs = await adminFetch("documents?select=*,profiles(full_name)&order=created_at.desc");
    if (!Array.isArray(docs)) docs = [];
  } catch {
    document.getElementById("docsArea").innerHTML = errorState();
    return;
  }

  const area = document.getElementById("docsArea");

  if (docs.length === 0) {
    area.innerHTML = emptyState("fa-folder-open", "No documents yet", "Uploaded documents will appear here.");
    return;
  }

  area.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Uploaded</th><th>Action</th></tr></thead>
        <tbody>
          ${docs.map(d => `
            <tr>
              <td><strong>${d.name || d.file_name || "—"}</strong></td>
              <td>${d.type || "—"}</td>
              <td>${d.profiles?.full_name || "—"}</td>
              <td>${formatDate(d.created_at)}</td>
              <td>${d.url ? `<a href="${d.url}" target="_blank" class="btn btn-secondary btn-sm">View</a>` : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================================
   SUPPORT TICKETS
   ============================================================ */
async function renderSupport(content) {
  content.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="filter-select" id="ticketStatusFilter">
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="in progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Priority</label>
        <select class="filter-select" id="ticketPriorityFilter">
          <option value="">All</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">Support Tickets</div>
      </div>
      <div id="ticketsArea">${skeletonRows()}</div>
    </div>
  `;

  let tickets = [];
  try {
    tickets = await adminFetch("support_tickets?select=*,profiles(full_name,email)&order=created_at.desc");
    if (!Array.isArray(tickets)) tickets = [];
  } catch {
    document.getElementById("ticketsArea").innerHTML = errorState();
    return;
  }

  function renderTickets(list) {
    const area = document.getElementById("ticketsArea");
    if (!area) return;
    if (list.length === 0) { area.innerHTML = emptyState("fa-headset", "No tickets yet", "Support tickets will appear here."); return; }

    area.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Subject</th><th>User</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${list.map(t => `
              <tr>
                <td><strong>${t.subject || "—"}</strong></td>
                <td>${t.profiles?.full_name || "—"}</td>
                <td style="text-transform:capitalize">${t.category || "general"}</td>
                <td><span class="badge ${t.priority === "urgent" ? "badge-rejected" : t.priority === "high" ? "badge-suspended" : "badge-draft"}">${t.priority || "normal"}</span></td>
                <td>${badge(t.status)}</td>
                <td>${formatDate(t.created_at)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm view-ticket-btn" data-id="${t.id}">View</button>
                  ${t.status === "open" || t.status === "in progress" ? `<button class="btn btn-success btn-sm close-ticket-btn" data-id="${t.id}" data-subject="${(t.subject || "").replace(/"/g, "&quot;")}" style="margin-left:0.3rem">Close</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    area.querySelectorAll(".close-ticket-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Close this ticket?")) return;
        btn.disabled = true;
        try {
          // Use 'closed' as the status value
          await adminFetch(`support_tickets?id=eq.${btn.dataset.id}`, {
            method:  "PATCH",
            prefer:  "return=minimal",
            body: {
              status:      "closed",
              resolved_at: new Date().toISOString(),
              resolved_by: currentAdmin.id,
            },
          });
          await writeAuditLog({
            action:      "ticket_closed",
            targetType:  "ticket",
            targetId:    btn.dataset.id,
            targetLabel: btn.dataset.subject || "Support Ticket",
            newValue:    { status: "closed" },
          });
          showToast("Ticket closed successfully.", "success");
          await renderSupport(document.getElementById("contentArea"));
        } catch (err) {
          showToast(err.message || "Failed to close ticket.", "error");
          btn.disabled = false;
        }
      });
    });
  }

  renderTickets(tickets);
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
async function renderNotifications(content) {
  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 360px;gap:1.5rem;align-items:start">
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-card-title">Sent Notifications</div>
        </div>
        <div id="notiArea">${skeletonRows(4)}</div>
      </div>
      <div class="section-card">
        <div class="section-card-header">
          <div class="section-card-title">Send Notification</div>
        </div>
        <div style="padding:1.5rem">
          <div id="sendNotiError" class="inline-error" style="display:none"></div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Title</label>
            <input type="text" class="form-input" id="notiTitle" placeholder="Notification title">
          </div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Message</label>
            <textarea class="form-textarea" id="notiBody" placeholder="Notification message..." style="min-height:80px"></textarea>
          </div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Target</label>
            <select class="form-select" id="notiTarget">
              <option value="all">All Users</option>
              <option value="role">By Role</option>
            </select>
          </div>
          <div class="form-group" id="notiRoleGroup" style="margin-bottom:1rem;display:none">
            <label class="form-label">Role</label>
            <select class="form-select" id="notiRole">
              <option value="investor">Investors</option>
              <option value="farmer">Farmers</option>
              <option value="agent">Agents</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:1.25rem">
            <label class="form-label">Priority</label>
            <select class="form-select" id="notiPriority">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <button class="btn btn-primary" id="sendNotiBtn" style="width:100%">
            <i class="fas fa-paper-plane"></i> Send Notification
          </button>
        </div>
      </div>
    </div>
  `;

  // Show/hide role group
  document.getElementById("notiTarget")?.addEventListener("change", e => {
    document.getElementById("notiRoleGroup").style.display = e.target.value === "role" ? "" : "none";
  });

  // Load notifications
  let notis = [];
  try {
    notis = await adminFetch("notifications?select=*&order=created_at.desc&limit=20");
    if (!Array.isArray(notis)) notis = [];
  } catch {}

  const area = document.getElementById("notiArea");
  if (notis.length === 0) {
    area.innerHTML = emptyState("fa-bell", "No notifications sent", "Send your first notification.");
  } else {
    area.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Title</th><th>Target</th><th>Priority</th><th>Sent</th></tr></thead>
          <tbody>
            ${notis.map(n => `
              <tr>
                <td><strong>${n.title}</strong><br><span style="font-size:0.72rem;color:var(--muted)">${(n.body || "").substring(0, 50)}${n.body?.length > 50 ? "…" : ""}</span></td>
                <td style="text-transform:capitalize">${n.target_type === "role" ? n.target_role : n.target_type}</td>
                <td><span class="badge ${n.priority === "urgent" ? "badge-rejected" : n.priority === "high" ? "badge-suspended" : "badge-draft"}">${n.priority}</span></td>
                <td>${formatDateTime(n.created_at)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // Send notification
  document.getElementById("sendNotiBtn")?.addEventListener("click", async () => {
    const title    = document.getElementById("notiTitle")?.value.trim();
    const body     = document.getElementById("notiBody")?.value.trim();
    const target   = document.getElementById("notiTarget")?.value;
    const role     = document.getElementById("notiRole")?.value;
    const priority = document.getElementById("notiPriority")?.value;
    const errEl    = document.getElementById("sendNotiError");
    const btn      = document.getElementById("sendNotiBtn");

    if (!title || !body) { errEl.textContent = "Title and message are required."; errEl.style.display = "flex"; return; }

    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      await adminFetch("notifications", {
        method: "POST", prefer: "return=minimal",
        body: { title, body, target_type: target, target_role: target === "role" ? role : null, sent_by: currentAdmin.id, priority },
      });
      showToast("Notification sent.", "success");
      document.getElementById("notiTitle").value = "";
      document.getElementById("notiBody").value  = "";
      await renderNotifications(document.getElementById("contentArea"));
    } catch (err) {
      errEl.textContent = err.message || "Failed to send.";
      errEl.style.display = "flex";
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Notification';
    }
  });
}

/* ============================================================
   AUDIT LOGS
   ============================================================ */
async function renderAuditLogs(content) {
  if (!currentPerms?.can_view_logs) {
    content.innerHTML = emptyState("fa-lock", "Access Restricted", "You don't have permission to view audit logs.");
    return;
  }

  content.innerHTML = `
    <div class="section-card">
      <div class="section-card-header">
        <div class="section-card-title">Audit Logs</div>
        <div class="section-card-sub">Append-only record of all admin actions</div>
      </div>
      <div id="auditArea">${skeletonRows(8)}</div>
    </div>
  `;

  let logs = [];
  try {
    logs = await adminFetch("audit_logs?select=*&order=created_at.desc&limit=100");
    if (!Array.isArray(logs)) logs = [];
  } catch {
    document.getElementById("auditArea").innerHTML = errorState();
    return;
  }

  const area = document.getElementById("auditArea");

  if (logs.length === 0) {
    area.innerHTML = emptyState("fa-clipboard-list", "No logs yet", "Admin actions will be logged here.");
    return;
  }

  area.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>Record</th><th>Notes</th><th>Time</th></tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td><strong>${l.admin_name || "—"}</strong></td>
              <td><code style="font-family:var(--mono);font-size:0.7rem;background:var(--surface2);padding:0.2rem 0.4rem;border-radius:4px">${l.action || "—"}</code></td>
              <td style="text-transform:capitalize">${l.target_type || "—"}</td>
              <td style="font-family:var(--mono);font-size:0.7rem;color:var(--muted)">${l.target_label || l.target_id?.substring(0, 8) || "—"}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:0.775rem">${l.notes || "—"}</td>
              <td style="font-family:var(--mono);font-size:0.7rem;white-space:nowrap">${formatDateTime(l.created_at)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================================
   SETTINGS
   ============================================================ */
async function renderSettings(content) {
  if (!currentPerms?.can_manage_settings) {
    content.innerHTML = emptyState("fa-lock", "Access Restricted", "Only Super Admins can access settings.");
    return;
  }

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">

      <!-- Change Password -->
      <div class="section-card">
        <div class="section-card-header"><div class="section-card-title">Change Password</div></div>
        <div style="padding:1.5rem">
          <div id="pwdError" class="inline-error" style="display:none"></div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">Current Password</label>
            <input type="password" class="form-input" id="curPwd">
          </div>
          <div class="form-group" style="margin-bottom:1rem">
            <label class="form-label">New Password</label>
            <input type="password" class="form-input" id="newPwd">
          </div>
          <div class="form-group" style="margin-bottom:1.25rem">
            <label class="form-label">Confirm New Password</label>
            <input type="password" class="form-input" id="confPwd">
          </div>
          <button class="btn btn-primary" id="changePwdBtn" style="width:100%">Update Password</button>
        </div>
      </div>

      <!-- Platform Info -->
      <div class="section-card">
        <div class="section-card-header"><div class="section-card-title">Platform Info</div></div>
        <div style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem">
          <div>
            <div class="form-label" style="margin-bottom:0.375rem">Admin Account</div>
            <div style="font-size:0.875rem;color:var(--text)">${currentProfile?.full_name || "—"}</div>
            <div style="font-family:var(--mono);font-size:0.72rem;color:var(--muted)">${currentAdmin?.email || "—"}</div>
          </div>
          <div>
            <div class="form-label" style="margin-bottom:0.375rem">Admin Type</div>
            <div style="font-size:0.875rem;color:var(--accent);text-transform:capitalize">${(currentPerms?.admin_type || "").replace(/_/g, " ")}</div>
          </div>
          <div>
            <div class="form-label" style="margin-bottom:0.375rem">Session User ID</div>
            <div style="font-family:var(--mono);font-size:0.7rem;color:var(--muted)">${currentAdmin?.id || "—"}</div>
          </div>
        </div>
      </div>

    </div>
  `;

  document.getElementById("changePwdBtn")?.addEventListener("click", async () => {
    const cur  = document.getElementById("curPwd")?.value;
    const nw   = document.getElementById("newPwd")?.value;
    const conf = document.getElementById("confPwd")?.value;
    const errEl= document.getElementById("pwdError");
    const btn  = document.getElementById("changePwdBtn");

    if (!cur || !nw || !conf) { errEl.textContent = "All fields required."; errEl.style.display = "flex"; return; }
    if (nw.length < 8) { errEl.textContent = "Password must be at least 8 characters."; errEl.style.display = "flex"; return; }
    if (nw !== conf) { errEl.textContent = "Passwords do not match."; errEl.style.display = "flex"; return; }

    btn.disabled = true; btn.textContent = "Updating...";

    try {
      await supabase.auth.signInWithPassword({ email: currentAdmin.email, password: cur });
      await api.auth.updatePassword({ new_password: nw });
      showToast("Password updated successfully.", "success");
      document.getElementById("curPwd").value = "";
      document.getElementById("newPwd").value  = "";
      document.getElementById("confPwd").value = "";
    } catch (err) {
      errEl.textContent = err.message || "Failed. Check current password.";
      errEl.style.display = "flex";
    } finally {
      btn.disabled = false; btn.textContent = "Update Password";
    }
  });
}

/* ============================================================
   LOGOUT
   ============================================================ */
async function handleLogout(e) {
  if (e) e.preventDefault();
  try {
    await writeAuditLog({ action: "admin_logout", targetType: "admin", targetId: currentAdmin?.id, targetLabel: currentProfile?.full_name || "Admin" });
    await supabase.auth.signOut();
  } catch { /* ignore */ }
  window.location.href = new URL("login.html", window.location.href).toString();
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener("DOMContentLoaded", init);
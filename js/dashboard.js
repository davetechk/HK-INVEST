// js/dashboard.js
import { api } from "./api.js";

/* ===============================
   STATE
================================= */
let currentUser    = null;
let currentProfile = null;
let currentRoute   = "overview";
let selectedInvestmentId = null;
let allInvestments = [];

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
  const icons = {
    success: "fa-check-circle",
    error:   "fa-times-circle",
    info:    "fa-info-circle",
    warning: "fa-exclamation-circle",
  };
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <div class="toast-content">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(node);
  setTimeout(() => { if (node.parentElement) node.remove(); }, 3500);
}

function formatCurrency(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function emptyState({ icon = "fa-seedling", title, subtitle, actionLabel = null, actionRoute = null }) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><i class="fas ${icon}"></i></div>
      <h3>${title}</h3>
      <p>${subtitle}</p>
      ${actionLabel ? `<button class="btn btn-primary" data-route="${actionRoute}"><i class="fas fa-arrow-right"></i> ${actionLabel}</button>` : ""}
    </div>
  `;
}

function errorState(msg = "Unable to load data. Please refresh or try again.") {
  return `
    <div class="inline-error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>${msg}</span>
    </div>
  `;
}

function skeletonRows(count = 4) {
  return `<div class="skeleton-rows">${Array(count).fill('<div class="skeleton skeleton-row"></div>').join("")}</div>`;
}

function skeletonCards(count = 4) {
  return `<div class="overview-cards">${Array(count).fill('<div class="skeleton skeleton-card"></div>').join("")}</div>`;
}

async function checkNotificationCount() {
  try {
    const res    = await api.notifications.listMyNotifications();
    const notis  = Array.isArray(res?.data) ? res.data : [];
    const unread = notis.filter(n => !n.is_read).length;

    const dot   = document.getElementById("notificationDot");
    const badge = document.getElementById("notificationBadge");

    if (unread > 0) {
      if (dot)   dot.style.display   = "";
      if (badge) {
        badge.style.display = "";
        badge.textContent   = unread > 9 ? "9+" : String(unread);
      }
    } else {
      if (dot)   dot.style.display   = "none";
      if (badge) badge.style.display = "none";
    }
  } catch {
    // Silently fail — notifications are non-critical
  }
}

function statusBadge(status) {
  const map = {
    active:         "badge-active",
    completed:      "badge-completed",
    pending:        "badge-pending",
    "under review": "badge-review",
    cancelled:      "badge-cancelled",
  };
  const key = (status || "").toLowerCase();
  return `<span class="inv-status-badge ${map[key] || "badge-pending"}">${status || "Pending"}</span>`;
}

/* ===============================
   INIT
================================= */
export async function initDashboard() {
  try {
    showLoading();

    const s       = await api.auth.getSession();
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

    // Check for unread notifications and show badge
    checkNotificationCount();
  } catch (err) {
    console.error("Dashboard init error:", err);
    window.location.href = "../auth/login.html";
  } finally {
    hideLoading();
  }
}

/* ===============================
   USER UI
================================= */
function updateUserUI() {
  const name = currentProfile?.full_name || "User";

  const el = (id) => document.getElementById(id);

  if (el("sidebarUserName"))  el("sidebarUserName").textContent  = name;
  if (el("profileName"))      el("profileName").textContent      = name;

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  if (el("userAvatar"))      el("userAvatar").innerHTML      = `<span>${initials}</span>`;
  if (el("profileInitials")) el("profileInitials").textContent = initials;

  const statusEl = el("userStatusBadge");
  if (statusEl) {
    const s = currentProfile?.status || "pending";
    statusEl.textContent  = s.charAt(0).toUpperCase() + s.slice(1);
    statusEl.className    = `status-badge status-${s}`;
  }
}

/* ===============================
   NAVIGATION
================================= */
function setupListeners() {
  // Sidebar nav items
  document.querySelectorAll(".nav-item[data-route]").forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      await loadRoute(item.dataset.route);
    });
  });

  // Logout buttons
  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
  document.getElementById("dropdownLogout")?.addEventListener("click", handleLogout);

  // Mobile menu
  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("active");
    document.getElementById("mobileOverlay")?.classList.toggle("active");
  });

  document.getElementById("sidebarClose")?.addEventListener("click", closeMobileMenu);
  document.getElementById("mobileOverlay")?.addEventListener("click", closeMobileMenu);

  // Profile dropdown toggle
  document.getElementById("profileMenu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("profileDropdown")?.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    document.getElementById("profileDropdown")?.classList.remove("active");
  });

  // Error boundary dismiss
  document.getElementById("errorDismiss")?.addEventListener("click", () => {
    const el = document.getElementById("errorBoundary");
    if (el) el.hidden = true;
  });

  // Notification bell → go to notifications
  document.getElementById("notificationBell")?.addEventListener("click", () => {
    loadRoute("notifications");
  });
}

function closeMobileMenu() {
  document.getElementById("sidebar")?.classList.remove("active");
  document.getElementById("mobileOverlay")?.classList.remove("active");
}

function setActiveNav(route) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.route === route);
  });

  const titles = {
    overview:            "Overview",
    investments:         "My Investments",
    "investment-details":"Investment Details",
    updates:             "Updates",
    transactions:        "Transactions",
    documents:           "Documents",
    notifications:       "Notifications",
    support:             "Support",
    profile:             "Profile & Security",
  };

  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = titles[route] || route;
}

/* Re-bind data-route links inside dynamically injected HTML */
function bindInnerRoutes(container) {
  container.querySelectorAll("[data-route]").forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      const r = item.dataset.route;
      if (r) await loadRoute(r);
    });
  });
}

async function loadRoute(route) {
  const content = document.getElementById("contentArea");
  if (!content) return;

  currentRoute = route;
  setActiveNav(route);
  closeMobileMenu();
  showLoading();

  try {
    switch (route) {
      case "overview":           await renderOverview(content);          break;
      case "investments":        await renderInvestments(content);       break;
      case "investment-details": await renderInvestmentDetails(content); break;
      case "updates":            await renderUpdates(content);           break;
      case "transactions":       await renderTransactions(content);      break;
      case "documents":          await renderDocuments(content);         break;
      case "notifications":           renderNotifications(content);      break;
      case "support":            await renderSupport(content);           break;
      case "profile":                 renderProfile(content);
                                      bindProfileActions();              break;
      default:
        content.innerHTML = emptyState({
          icon:     "fa-tools",
          title:    "Coming Soon",
          subtitle: "This section is under construction.",
        });
    }
  } catch (err) {
    console.error("Route error:", err);
    content.innerHTML = errorState("Error loading page. Please try again.");
  } finally {
    hideLoading();
    bindInnerRoutes(content);
  }
}

/* ===============================
   OVERVIEW
================================= */
async function renderOverview(content) {
  // Skeleton while loading
  content.innerHTML = skeletonCards(4) + `
    <div class="section-header" style="margin-top:0.5rem">
      <h2>Recent Investments</h2>
    </div>
  ` + `<div class="table-container">${skeletonRows(4)}</div>`;

  let investments = [];
  try {
    const res  = await api.investments.listMyInvestments();
    investments = Array.isArray(res?.data) ? res.data : [];
    allInvestments = investments; // cache
  } catch {
    investments = [];
  }

  // Compute stats
  let totalInvested  = 0;
  let activeCount    = 0;
  let expectedReturn = 0;
  let realizedReturn = 0;

  investments.forEach((inv) => {
    totalInvested  += Number(inv.amount_invested || 0);
    expectedReturn += Number(inv.expected_return  || 0);
    realizedReturn += Number(inv.realized_return  || 0);
    if ((inv.status || "").toLowerCase() === "active") activeCount++;
  });

  // Stats cards
  const statsHTML = `
    <div class="overview-cards">
      <div class="stat-card">
        <div class="stat-header">
          <h3>Total Invested</h3>
          <div class="stat-icon"><i class="fas fa-coins"></i></div>
        </div>
        <div class="stat-value">${formatCurrency(totalInvested)}</div>
        <div class="stat-trend positive"><i class="fas fa-seedling"></i> Across all farms</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <h3>Active Investments</h3>
          <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="stat-value">${activeCount}</div>
        <div class="stat-trend positive"><i class="fas fa-circle"></i> Currently in production</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <h3>Expected Returns</h3>
          <div class="stat-icon"><i class="fas fa-hand-holding-usd"></i></div>
        </div>
        <div class="stat-value">${formatCurrency(expectedReturn)}</div>
        <div class="stat-trend positive"><i class="fas fa-calendar-alt"></i> Projected payout</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <h3>Realized Returns</h3>
          <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="stat-value">${formatCurrency(realizedReturn)}</div>
        <div class="stat-trend positive"><i class="fas fa-arrow-up"></i> Successfully paid out</div>
      </div>
    </div>
  `;

  // Recent investments table / empty state
  let tableHTML = "";
  if (investments.length === 0) {
    tableHTML = `
      <div class="table-container">
        ${emptyState({
          icon:        "fa-seedling",
          title:       "No investments yet",
          subtitle:    "Your portfolio will appear here after your first investment.",
          actionLabel: "Explore Farms",
          actionRoute: "investments",
        })}
      </div>
    `;
  } else {
    const rows = investments.slice(0, 5).map((inv) => `
      <tr>
        <td>
          <strong>${inv.farm_name || inv.name || "—"}</strong><br>
          <small style="color:#94A3B8">${inv.crop_type || inv.location || ""}</small>
        </td>
        <td>${formatCurrency(inv.amount_invested)}</td>
        <td>${inv.duration || "—"}</td>
        <td>${formatDate(inv.start_date)}</td>
        <td>${statusBadge(inv.status)}</td>
        <td>
          <button class="btn btn-secondary btn-sm view-details-btn" data-id="${inv.id}">
            View Details
          </button>
        </td>
      </tr>
    `).join("");

    tableHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Farm / Crop</th>
              <th>Amount Invested</th>
              <th>Duration</th>
              <th>Start Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  content.innerHTML = statsHTML + `
    <div class="section-header" style="margin-top:0.5rem">
      <h2>Recent Investments</h2>
      <a href="#" class="section-link" data-route="investments">View all <i class="fas fa-arrow-right"></i></a>
    </div>
  ` + tableHTML;

  // Bind view-details buttons
  content.querySelectorAll(".view-details-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedInvestmentId = btn.dataset.id;
      loadRoute("investment-details");
    });
  });
}

/* ===============================
   MY INVESTMENTS
================================= */
async function renderInvestments(content) {
  content.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="filter-select" id="filterStatus">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="under review">Under Review</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Crop Type</label>
        <select class="filter-select" id="filterCrop">
          <option value="">All</option>
          <option value="maize">Maize</option>
          <option value="rice">Rice</option>
          <option value="cassava">Cassava</option>
          <option value="soybean">Soybean</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Search</label>
        <input type="text" class="filter-input" id="filterSearch" placeholder="Search investments...">
      </div>
      <button class="btn btn-secondary" id="exportBtn">
        <i class="fas fa-download"></i> Export Statement
      </button>
    </div>
    <div id="investmentsListArea">${skeletonRows(5)}</div>
  `;

  let investments = [];
  try {
    const res  = await api.investments.listMyInvestments();
    investments = Array.isArray(res?.data) ? res.data : [];
    allInvestments = investments;
  } catch {
    document.getElementById("investmentsListArea").innerHTML = errorState();
    return;
  }

  function renderTable(list) {
    const area = document.getElementById("investmentsListArea");
    if (!area) return;

    if (list.length === 0) {
      area.innerHTML = emptyState({
        icon:     "fa-seedling",
        title:    "No investments yet",
        subtitle: "Explore available farms to start investing.",
      });
      return;
    }

    const rows = list.map((inv) => `
      <tr>
        <td>
          <strong>${inv.farm_name || inv.name || "—"}</strong><br>
          <small style="color:#94A3B8">${inv.crop_type || ""} ${inv.location ? "· " + inv.location : ""}</small>
        </td>
        <td>${formatCurrency(inv.amount_invested)}</td>
        <td>${inv.duration || "—"}</td>
        <td>${formatDate(inv.start_date)}</td>
        <td>${formatDate(inv.end_date)}</td>
        <td>${inv.stage || "—"}</td>
        <td>${formatCurrency(inv.expected_return)}</td>
        <td>${formatCurrency(inv.realized_return)}</td>
        <td>${statusBadge(inv.status)}</td>
        <td>
          <button class="btn btn-secondary btn-sm view-details-btn" data-id="${inv.id}">
            View Details
          </button>
        </td>
      </tr>
    `).join("");

    area.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Amount</th>
              <th>Duration</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Stage</th>
              <th>Expected ROI</th>
              <th>Realized ROI</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="padding:0.75rem 1.5rem;font-size:0.75rem;color:#94A3B8;border-top:1px solid #F1F5F9;margin:0">
          All investments are subject to project structure and agricultural production cycles.
        </p>
      </div>
    `;

    area.querySelectorAll(".view-details-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedInvestmentId = btn.dataset.id;
        loadRoute("investment-details");
      });
    });
  }

  renderTable(investments);

  // Filters
  function applyFilters() {
    const status = document.getElementById("filterStatus")?.value.toLowerCase() || "";
    const crop   = document.getElementById("filterCrop")?.value.toLowerCase() || "";
    const search = document.getElementById("filterSearch")?.value.toLowerCase() || "";

    const filtered = investments.filter((inv) => {
      const matchStatus = !status || (inv.status || "").toLowerCase() === status;
      const matchCrop   = !crop   || (inv.crop_type || "").toLowerCase().includes(crop);
      const matchSearch = !search ||
        (inv.farm_name || inv.name || "").toLowerCase().includes(search) ||
        (inv.crop_type || "").toLowerCase().includes(search) ||
        (inv.location  || "").toLowerCase().includes(search);
      return matchStatus && matchCrop && matchSearch;
    });

    renderTable(filtered);
  }

  document.getElementById("filterStatus")?.addEventListener("change", applyFilters);
  document.getElementById("filterCrop")?.addEventListener("change", applyFilters);
  document.getElementById("filterSearch")?.addEventListener("input", applyFilters);

  document.getElementById("exportBtn")?.addEventListener("click", () => {
    showToast("Export feature coming soon.", "info");
  });
}

/* ===============================
   INVESTMENT DETAILS
================================= */
async function renderInvestmentDetails(content) {
  if (!selectedInvestmentId) {
    content.innerHTML = `
      <div class="table-container">
        ${emptyState({
          icon:        "fa-tree",
          title:       "No Investment Selected",
          subtitle:    "Select an investment to view its details.",
          actionLabel: "Go to My Investments",
          actionRoute: "investments",
        })}
      </div>
    `;
    return;
  }

  content.innerHTML = skeletonRows(6);

  let inv       = null;
  let updates   = [];
  let txns      = [];
  let documents = [];

  try {
    const [invRes, updRes, txnRes, docRes] = await Promise.allSettled([
      api.investments.getInvestmentById(selectedInvestmentId),
      api.investments.listUpdates(selectedInvestmentId),
      api.investments.listTransactions(selectedInvestmentId),
      api.investments.listDocuments(selectedInvestmentId),
    ]);

    inv       = invRes.status      === "fulfilled" ? invRes.value?.data      || null : null;
    updates   = updRes.status      === "fulfilled" ? Array.isArray(updRes.value?.data)   ? updRes.value.data   : [] : [];
    txns      = txnRes.status      === "fulfilled" ? Array.isArray(txnRes.value?.data)   ? txnRes.value.data   : [] : [];
    documents = docRes.status      === "fulfilled" ? Array.isArray(docRes.value?.data)   ? docRes.value.data   : [] : [];
  } catch {
    content.innerHTML = errorState();
    return;
  }

  if (!inv) {
    content.innerHTML = errorState("Investment not found.");
    return;
  }

  // Build tabs
  const updatesHTML = updates.length === 0
    ? emptyState({ icon: "fa-sync-alt", title: "No updates yet", subtitle: "Updates from farm managers will appear here." })
    : `<div class="updates-list">${updates.map((u) => `
        <div class="update-card">
          <div class="update-card-header">
            <div class="update-card-title">${u.title || "Farm Update"}</div>
            <div class="update-card-date">${formatDate(u.created_at)}</div>
          </div>
          <div class="update-card-body">${u.body || u.message || u.content || "—"}</div>
        </div>
      `).join("")}</div>`;

  const txnsHTML = txns.length === 0
    ? emptyState({ icon: "fa-exchange-alt", title: "No transactions yet", subtitle: "Your deposits and payouts will appear here." })
    : `<div class="table-container">
        <table class="data-table">
          <thead><tr><th>Type</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>${txns.map((t) => `
            <tr>
              <td>${t.type || "—"}</td>
              <td>${formatCurrency(t.amount)}</td>
              <td>${formatDate(t.created_at)}</td>
              <td>${statusBadge(t.status)}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>`;

  const docsHTML = documents.length === 0
    ? emptyState({ icon: "fa-file-alt", title: "No documents available", subtitle: "Contracts and reports will appear here." })
    : `<div class="documents-grid">${documents.map((d) => `
        <div class="document-card">
          <div class="document-icon"><i class="fas fa-file-pdf"></i></div>
          <div class="document-name">${d.name || d.file_name || "Document"}</div>
          <div class="document-meta">${formatDate(d.created_at)}</div>
          ${d.url ? `<a href="${d.url}" target="_blank" class="btn btn-secondary btn-sm">Download</a>` : ""}
        </div>
      `).join("")}</div>`;

  content.innerHTML = `
    <!-- Header info -->
    <div style="background:white;border-radius:20px;padding:1.5rem 2rem;border:1px solid rgba(46,125,50,0.08);box-shadow:0 4px 12px rgba(0,0,0,0.02);margin-bottom:1.5rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1.25rem">
        <div>
          <h2 style="font-family:'Playfair Display',serif;font-size:1.5rem;color:#1B5E20;margin:0 0 0.25rem">
            ${inv.farm_name || inv.name || "Investment"}
          </h2>
          <p style="margin:0;font-size:0.875rem;color:#64748B">${inv.crop_type || ""} ${inv.location ? "· " + inv.location : ""}</p>
        </div>
        ${statusBadge(inv.status)}
      </div>
      <div class="detail-info-grid">
        <div class="detail-info-item"><label>Amount Invested</label><span>${formatCurrency(inv.amount_invested)}</span></div>
        <div class="detail-info-item"><label>Duration</label><span>${inv.duration || "—"}</span></div>
        <div class="detail-info-item"><label>Start Date</label><span>${formatDate(inv.start_date)}</span></div>
        <div class="detail-info-item"><label>End Date</label><span>${formatDate(inv.end_date)}</span></div>
        <div class="detail-info-item"><label>Expected ROI</label><span>${formatCurrency(inv.expected_return)}</span></div>
        <div class="detail-info-item"><label>Realized ROI</label><span>${formatCurrency(inv.realized_return)}</span></div>
        <div class="detail-info-item"><label>Stage</label><span>${inv.stage || "—"}</span></div>
        <div class="detail-info-item"><label>Crop Type</label><span>${inv.crop_type || "—"}</span></div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-container">
      <div class="tabs-header">
        <button class="tab-button active" data-tab="updates">Updates</button>
        <button class="tab-button" data-tab="transactions">Transactions</button>
        <button class="tab-button" data-tab="documents">Documents</button>
      </div>
      <div class="tab-panel active" id="tab-updates">${updatesHTML}</div>
      <div class="tab-panel" id="tab-transactions">${txnsHTML}</div>
      <div class="tab-panel" id="tab-documents">${docsHTML}</div>
    </div>
  `;

  // Tab switching
  content.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      content.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
      content.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
    });
  });
}

/* ===============================
   UPDATES
================================= */
async function renderUpdates(content) {
  content.innerHTML = skeletonRows(4);

  let updates = [];
  try {
    const res = await api.investments.listUpdates();
    updates   = Array.isArray(res?.data) ? res.data : [];
  } catch {
    content.innerHTML = errorState();
    return;
  }

  if (updates.length === 0) {
    content.innerHTML = `
      <div class="table-container">
        ${emptyState({
          icon:     "fa-sync-alt",
          title:    "No updates yet",
          subtitle: "Updates from farm managers will appear here.",
        })}
      </div>
    `;
    return;
  }

  content.innerHTML = `
    <div class="updates-list">
      ${updates.map((u) => `
        <div class="update-card">
          <div class="update-card-header">
            <div class="update-card-title">${u.title || "Farm Update"}</div>
            <div class="update-card-date">${formatDate(u.created_at)}</div>
          </div>
          <div class="update-card-body">${u.body || u.message || u.content || "—"}</div>
          ${u.farm_name ? `<div class="update-card-farm"><i class="fas fa-seedling"></i> ${u.farm_name}</div>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

/* ===============================
   TRANSACTIONS
================================= */
async function renderTransactions(content) {
  content.innerHTML = `
    <div class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Type</label>
        <select class="filter-select" id="txnTypeFilter">
          <option value="">All</option>
          <option value="deposit">Deposit</option>
          <option value="payout">Payout</option>
          <option value="refund">Refund</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select class="filter-select" id="txnStatusFilter">
          <option value="">All</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </div>
    <div id="txnArea">${skeletonRows(5)}</div>
  `;

  let txns = [];
  try {
    const res = await api.investments.listTransactions();
    txns      = Array.isArray(res?.data) ? res.data : [];
  } catch {
    document.getElementById("txnArea").innerHTML = errorState();
    return;
  }

  function renderTxns(list) {
    const area = document.getElementById("txnArea");
    if (!area) return;

    if (list.length === 0) {
      area.innerHTML = `
        <div class="table-container">
          ${emptyState({
            icon:     "fa-exchange-alt",
            title:    "No transactions yet",
            subtitle: "Your deposits and payouts will appear here.",
          })}
        </div>
      `;
      return;
    }

    const rows = list.map((t) => `
      <tr>
        <td>${t.reference || t.id?.substring(0, 8) || "—"}</td>
        <td style="text-transform:capitalize">${t.type || "—"}</td>
        <td>${formatCurrency(t.amount)}</td>
        <td>${formatDate(t.created_at)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${t.note || t.description || "—"}</td>
      </tr>
    `).join("");

    area.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderTxns(txns);

  function applyTxnFilters() {
    const type   = document.getElementById("txnTypeFilter")?.value.toLowerCase() || "";
    const status = document.getElementById("txnStatusFilter")?.value.toLowerCase() || "";
    renderTxns(txns.filter((t) => {
      const mType   = !type   || (t.type   || "").toLowerCase() === type;
      const mStatus = !status || (t.status || "").toLowerCase() === status;
      return mType && mStatus;
    }));
  }

  document.getElementById("txnTypeFilter")?.addEventListener("change", applyTxnFilters);
  document.getElementById("txnStatusFilter")?.addEventListener("change", applyTxnFilters);
}

/* ===============================
   DOCUMENTS
================================= */
async function renderDocuments(content) {
  content.innerHTML = skeletonRows(3);

  let documents = [];
  try {
    const res = await api.investments.listDocuments();
    documents  = Array.isArray(res?.data) ? res.data : [];
  } catch {
    content.innerHTML = errorState();
    return;
  }

  if (documents.length === 0) {
    content.innerHTML = `
      <div class="table-container">
        ${emptyState({
          icon:     "fa-file-alt",
          title:    "No documents available",
          subtitle: "Contracts and reports will appear here.",
        })}
      </div>
    `;
    return;
  }

  const iconMap = {
    pdf:  "fa-file-pdf",
    doc:  "fa-file-word",
    docx: "fa-file-word",
    xls:  "fa-file-excel",
    xlsx: "fa-file-excel",
    img:  "fa-file-image",
    png:  "fa-file-image",
    jpg:  "fa-file-image",
  };

  function getIcon(name = "") {
    const ext = name.split(".").pop().toLowerCase();
    return iconMap[ext] || "fa-file-alt";
  }

  content.innerHTML = `
    <div class="documents-grid">
      ${documents.map((d) => `
        <div class="document-card">
          <div class="document-icon"><i class="fas ${getIcon(d.name || d.file_name)}"></i></div>
          <div class="document-name">${d.name || d.file_name || "Document"}</div>
          <div class="document-meta">${d.type || "Document"} · ${formatDate(d.created_at)}</div>
          ${d.url ? `<a href="${d.url}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm"><i class="fas fa-download"></i> Download</a>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

/* ===============================
   NOTIFICATIONS
================================= */
async function renderNotifications(content) {
  // Show loading state
  content.innerHTML = `
    <div class="section-header">
      <h2>Notifications</h2>
    </div>
    <div class="table-container" style="padding:2rem">
      ${skeletonRows(4)}
    </div>
  `;

  let notifications = [];
  try {
    const res = await api.notifications.listMyNotifications();
    notifications = Array.isArray(res?.data) ? res.data : [];
  } catch {
    content.innerHTML = `
      <div class="section-header"><h2>Notifications</h2></div>
      <div class="table-container">${errorState()}</div>
    `;
    return;
  }

  // Hide bell dot and badge after viewing
  const dot   = document.getElementById("notificationDot");
  const badge = document.getElementById("notificationBadge");
  if (dot)   dot.style.display   = "none";
  if (badge) badge.style.display = "none";

  // Mark all as read
  if (notifications.some(n => !n.is_read)) {
    api.notifications.markAllRead().catch(() => {});
  }

  if (notifications.length === 0) {
    content.innerHTML = `
      <div class="section-header"><h2>Notifications</h2></div>
      <div class="table-container">
        ${emptyState({
          icon:     "fa-bell",
          title:    "No notifications",
          subtitle: "You're all caught up.",
        })}
      </div>
    `;
    return;
  }

  const priorityIcon = {
    urgent: "fa-exclamation-circle",
    high:   "fa-arrow-up",
    normal: "fa-bell",
    low:    "fa-bell",
  };

  const priorityColor = {
    urgent: "#e74c3c",
    high:   "#e67e22",
    normal: "#2E7D32",
    low:    "#64748B",
  };

  content.innerHTML = `
    <div class="section-header">
      <h2>Notifications</h2>
      <span style="font-size:0.8rem;color:#64748B">${notifications.length} notification${notifications.length !== 1 ? "s" : ""}</span>
    </div>
    <div class="notifications-list">
      ${notifications.map(n => `
        <div class="notification-item ${n.is_read ? "" : "unread"}">
          <div class="notif-icon" style="color:${priorityColor[n.priority] || priorityColor.normal}">
            <i class="fas ${priorityIcon[n.priority] || priorityIcon.normal}"></i>
          </div>
          <div class="notif-content">
            <div class="notif-title">${n.title || "Notification"}</div>
            <div class="notif-body">${n.body || ""}</div>
            <div class="notif-time">${formatDate(n.sent_at || n.created_at)}</div>
          </div>
          ${!n.is_read ? '<div style="width:8px;height:8px;border-radius:50%;background:#2E7D32;flex-shrink:0;margin-top:4px"></div>' : ""}
        </div>
      `).join("")}
    </div>
  `;
}

/* ===============================
   SUPPORT
================================= */
async function renderSupport(content) {
  content.innerHTML = `
    <div class="support-layout">
      <div>
        <div class="section-header">
          <h2>My Support Tickets</h2>
        </div>
        <div id="ticketsArea">${skeletonRows(3)}</div>
      </div>
      <div>
        <div class="new-ticket-card">
          <h3>Open a New Ticket</h3>
          <form id="supportForm">
            <div class="form-group">
              <label class="form-label">Subject</label>
              <input type="text" class="form-control" id="ticketSubject" placeholder="Brief description of your issue" required>
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-control" id="ticketCategory">
                <option value="general">General Inquiry</option>
                <option value="investment">Investment Issue</option>
                <option value="payment">Payment Issue</option>
                <option value="account">Account Issue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Message</label>
              <textarea class="form-control" id="ticketMessage" rows="5" placeholder="Describe your issue in detail..." required></textarea>
            </div>
            <button type="submit" class="btn btn-primary" id="submitTicketBtn">
              <i class="fas fa-paper-plane"></i> Submit Ticket
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Load tickets
  let tickets = [];
  try {
    const res = await api.support.listTickets();
    tickets   = Array.isArray(res?.data) ? res.data : [];
  } catch {
    document.getElementById("ticketsArea").innerHTML = errorState();
    return;
  }

  const ticketsArea = document.getElementById("ticketsArea");
  if (!ticketsArea) return;

  if (tickets.length === 0) {
    ticketsArea.innerHTML = `
      <div class="table-container">
        ${emptyState({
          icon:     "fa-headset",
          title:    "No support tickets yet",
          subtitle: "Submit a ticket above if you need help.",
        })}
      </div>
    `;
  } else {
    ticketsArea.innerHTML = `
      <div class="support-tickets">
        ${tickets.map((t) => `
          <div class="ticket-card">
            <div class="ticket-header">
              <div>
                <div class="ticket-subject">${t.subject || "Untitled"}</div>
                <div class="ticket-meta">${t.category || "General"} · ${formatDate(t.created_at)}</div>
              </div>
              <span class="inv-status-badge ${t.status === "open" ? "ticket-open badge-active" : "ticket-closed badge-completed"}">
                ${t.status || "Open"}
              </span>
            </div>
            <div class="ticket-body" style="margin-top:0.5rem">${t.message || t.body || "—"}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Submit ticket form
  document.getElementById("supportForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submitTicketBtn");

    const subject  = document.getElementById("ticketSubject")?.value.trim();
    const category = document.getElementById("ticketCategory")?.value;
    const message  = document.getElementById("ticketMessage")?.value.trim();

    if (!subject || !message) {
      showToast("Please fill in all fields.", "error");
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; }

    try {
      await api.support.createTicket({ subject, category, message });
      showToast("Support ticket submitted successfully.", "success");
      e.target.reset();
      // Reload the tickets list
      await renderSupport(content);
    } catch (err) {
      showToast(err?.message || "Failed to submit ticket. Please try again.", "error");
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Ticket'; }
    }
  });
}

/* ===============================
   PROFILE
================================= */
function renderProfile(content) {
  const p = currentProfile || {};

  content.innerHTML = `
    <div class="profile-layout">

      <!-- Profile Info Form -->
      <div class="profile-card">
        <h3><i class="fas fa-user" style="margin-right:0.5rem;font-size:1rem"></i> Personal Information</h3>
        <form id="profileForm">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-control" id="profileFullName" value="${p.full_name || ""}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-control" value="${currentUser?.email || ""}" readonly>
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" class="form-control" id="profilePhone" value="${p.phone || ""}">
          </div>
          <div class="form-group">
            <label class="form-label">Bank Name</label>
            <input type="text" class="form-control" id="profileBank" value="${p.bank_name || ""}">
          </div>
          <div class="form-group">
            <label class="form-label">Account Number</label>
            <input type="text" class="form-control" id="profileAccountNumber" value="${p.account_number || ""}">
          </div>
          <div class="form-group">
            <label class="form-label">Account Name</label>
            <input type="text" class="form-control" id="profileAccountName" value="${p.account_name || ""}">
          </div>
          <button type="submit" class="btn btn-primary" id="saveProfileBtn">
            <i class="fas fa-save"></i> Save Changes
          </button>
        </form>
      </div>

      <!-- Change Password Form -->
      <div class="profile-card">
        <h3><i class="fas fa-lock" style="margin-right:0.5rem;font-size:1rem"></i> Change Password</h3>
        <form id="passwordForm">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input type="password" class="form-control" id="currentPassword" required>
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" class="form-control" id="newPassword" required>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input type="password" class="form-control" id="confirmPassword" required>
          </div>
          <button type="submit" class="btn btn-primary" id="changePassBtn">
            <i class="fas fa-key"></i> Change Password
          </button>
        </form>

        <!-- Account Info -->
        <hr style="border:none;border-top:1px solid #F1F5F9;margin:1.5rem 0">
        <h3 style="margin-bottom:1rem"><i class="fas fa-info-circle" style="margin-right:0.5rem;font-size:1rem"></i> Account Info</h3>
        <div class="detail-info-grid">
          <div class="detail-info-item">
            <label>Account Status</label>
            <span>${statusBadge(p.status)}</span>
          </div>
          <div class="detail-info-item">
            <label>Role</label>
            <span style="text-transform:capitalize">${p.role || "Investor"}</span>
          </div>
          <div class="detail-info-item">
            <label>Member Since</label>
            <span>${formatDate(p.created_at)}</span>
          </div>
        </div>
      </div>

    </div>
  `;
}

function bindProfileActions() {
  document.getElementById("profileForm")?.addEventListener("submit", handleProfileUpdate);
  document.getElementById("passwordForm")?.addEventListener("submit", handlePasswordChange);
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById("saveProfileBtn");

  const fullName      = document.getElementById("profileFullName")?.value.trim();
  const phone         = document.getElementById("profilePhone")?.value.trim();
  const bankName      = document.getElementById("profileBank")?.value.trim();
  const accountNumber = document.getElementById("profileAccountNumber")?.value.trim();
  const accountName   = document.getElementById("profileAccountName")?.value.trim();

  if (!fullName) {
    showToast("Full name is required.", "error");
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

  try {
    await api.profile.updateMyProfile({
      full_name:      fullName,
      phone:          phone,
      bank_name:      bankName,
      account_number: accountNumber,
      account_name:   accountName,
    });

    currentProfile.full_name = fullName;
    updateUserUI();
    showToast("Profile updated successfully.", "success");
  } catch (err) {
    showToast(err?.message || "Failed to update profile.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();
  const btn = document.getElementById("changePassBtn");

  const currentPassword = document.getElementById("currentPassword")?.value;
  const newPassword     = document.getElementById("newPassword")?.value;
  const confirmPassword = document.getElementById("confirmPassword")?.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast("All password fields are required.", "error");
    return;
  }

  if (newPassword.length < 8) {
    showToast("New password must be at least 8 characters.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match.", "error");
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...'; }

  try {
    // Verify current password
    await api.auth.signIn({ email: currentUser.email, password: currentPassword });
    // Update password
    await api.auth.updatePassword({ new_password: newPassword });

    showToast("Password changed successfully.", "success");
    e.target.reset();
  } catch {
    showToast("Incorrect current password.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-key"></i> Change Password'; }
  }
}

/* ===============================
   LOGOUT
================================= */
async function handleLogout(e) {
  if (e) e.preventDefault();
  try {
    await api.auth.signOut();
  } catch { /* ignore */ }
  window.location.href = new URL("../auth/login.html", window.location.href).toString();
}

/* ===============================
   BOOT
================================= */
document.addEventListener("DOMContentLoaded", initDashboard);
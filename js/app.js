// js/app.js

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Footer year
  const y = $("#y");
  if (y) y.textContent = String(new Date().getFullYear());

  // Auth state (mock)
  function isLoggedIn() {
    return Boolean(localStorage.getItem("hk_user"));
  }

  function syncAuthUI() {
    const logged = isLoggedIn();

    const publicBlock = $('[data-auth="public"]');
    const loggedBlock = $('[data-auth="logged"]');
    if (publicBlock) publicBlock.hidden = logged;
    if (loggedBlock) loggedBlock.hidden = !logged;

    const mPublic = $('[data-mobile-auth="public"]');
    const mLogged = $('[data-mobile-auth="logged"]');
    if (mPublic) mPublic.hidden = logged;
    if (mLogged) mLogged.hidden = !logged;
  }

  syncAuthUI();

  // Logout handlers
  function bindLogout() {
    $$('[data-action="logout"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        localStorage.removeItem("hk_user");
        syncAuthUI();
        closeAllDropdowns();
        closeMobile();
      });
    });
  }
  bindLogout();

  // Desktop dropdowns: accessible behavior
  const dropdowns = $$(".dd");

  function openDropdown(dd) {
    if (!dd) return;
    closeAllDropdowns(dd);
    dd.classList.add("is-open");
    const trigger = dd.querySelector('button[aria-haspopup="menu"]');
    const menu = dd.querySelector('[role="menu"]');
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    if (menu) {
      // focus first item for keyboard
      const firstItem = menu.querySelector('[role="menuitem"]');
      if (firstItem) firstItem.focus({ preventScroll: true });
    }
  }

  function closeDropdown(dd) {
    if (!dd) return;
    dd.classList.remove("is-open");
    const trigger = dd.querySelector('button[aria-haspopup="menu"]');
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function closeAllDropdowns(except) {
    dropdowns.forEach((dd) => {
      if (except && dd === except) return;
      closeDropdown(dd);
    });
  }

  // Click triggers
  dropdowns.forEach((dd) => {
    const trigger = dd.querySelector('button[aria-haspopup="menu"]');
    const menu = dd.querySelector('[role="menu"]');
    if (!trigger || !menu) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dd.classList.contains("is-open");
      if (isOpen) closeDropdown(dd);
      else openDropdown(dd);
    });

    // Keyboard: Enter/Space/ArrowDown to open; Esc to close
    trigger.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "Enter" || k === " " || k === "ArrowDown") {
        e.preventDefault();
        openDropdown(dd);
      }
      if (k === "Escape") {
        e.preventDefault();
        closeDropdown(dd);
        trigger.focus();
      }
    });

    menu.addEventListener("keydown", (e) => {
      const items = $$('[role="menuitem"]', menu);
      if (!items.length) return;

      const idx = items.indexOf(document.activeElement);
      const k = e.key;

      if (k === "Escape") {
        e.preventDefault();
        closeDropdown(dd);
        trigger.focus();
        return;
      }

      if (k === "ArrowDown") {
        e.preventDefault();
        const next = items[Math.min(items.length - 1, idx + 1)];
        (next || items[0]).focus();
      }

      if (k === "ArrowUp") {
        e.preventDefault();
        const prev = items[Math.max(0, idx - 1)];
        (prev || items[items.length - 1]).focus();
      }

      if (k === "Home") {
        e.preventDefault();
        items[0].focus();
      }

      if (k === "End") {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    });
  });

  // Close dropdown on outside click
  document.addEventListener("click", () => {
    closeAllDropdowns();
  });

  // Mobile menu
  const mobileRoot = $("#mobile-panel");
  const hamburger = $(".hamburger");
  const mobileCloseBtn = $(".mobile__close");
  const mobileBackdrop = $(".mobile__backdrop");

  function openMobile() {
    if (!mobileRoot || !hamburger) return;
    mobileRoot.classList.add("is-open");
    mobileRoot.setAttribute("aria-hidden", "false");
    hamburger.setAttribute("aria-expanded", "true");
    // focus close button for accessibility
    if (mobileCloseBtn) mobileCloseBtn.focus({ preventScroll: true });
    // lock scroll
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeMobile() {
    if (!mobileRoot || !hamburger) return;
    mobileRoot.classList.remove("is-open");
    mobileRoot.setAttribute("aria-hidden", "true");
    hamburger.setAttribute("aria-expanded", "false");
    // unlock scroll
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  if (hamburger) hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mobileRoot && mobileRoot.classList.contains("is-open")) closeMobile();
    else openMobile();
  });

  if (mobileCloseBtn) mobileCloseBtn.addEventListener("click", closeMobile);
  if (mobileBackdrop) mobileBackdrop.addEventListener("click", closeMobile);

  // Mobile accordions
  const accButtons = $$(".m-acc");
  accButtons.forEach((btn) => {
    const panelId = btn.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    btn.addEventListener("click", () => {
      const isOpen = btn.getAttribute("aria-expanded") === "true";
      // close other accordions
      accButtons.forEach((other) => {
        if (other === btn) return;
        const otherId = other.getAttribute("aria-controls");
        const otherPanel = otherId ? document.getElementById(otherId) : null;
        other.setAttribute("aria-expanded", "false");
        if (otherPanel) otherPanel.classList.remove("is-open");
        const chev = other.querySelector(".m-acc__chev");
        if (chev) chev.style.transform = "rotate(45deg)";
      });

      btn.setAttribute("aria-expanded", String(!isOpen));
      panel.classList.toggle("is-open", !isOpen);

      const chev = btn.querySelector(".m-acc__chev");
      if (chev) chev.style.transform = !isOpen ? "rotate(225deg)" : "rotate(45deg)";
    });
  });

  // Global ESC behavior: closes dropdowns and mobile
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    // close desktop dropdowns
    const anyOpen = dropdowns.some((dd) => dd.classList.contains("is-open"));
    if (anyOpen) {
      closeAllDropdowns();
      return;
    }

    // close mobile
    if (mobileRoot && mobileRoot.classList.contains("is-open")) {
      closeMobile();
      return;
    }
  });

  // Ensure desktop dropdowns close when opening mobile
  function closeAllForMobile() {
    closeAllDropdowns();
  }
  if (hamburger) hamburger.addEventListener("click", closeAllForMobile, { capture: true });

  // Prevent outside click from instantly closing dropdown when clicking inside menu
  $$(".menu").forEach((m) => {
    m.addEventListener("click", (e) => e.stopPropagation());
  });

  // Keep auth UI synced if storage changes in other tabs
  window.addEventListener("storage", (e) => {
    if (e.key === "hk_user") syncAuthUI();
  });
})();




// Category 2 reveal animations
const revealElements = document.querySelectorAll(
  '.platform__inner, .eco__card, .how__inner'
);

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
    }
  });
}, {
  threshold: 0.15
});

revealElements.forEach(el => observer.observe(el));




// ===== Category 3: reveal + chip active (visual only) =====
(function category3Init(){
  const root = document.querySelector(".cat3");
  if (!root) return;

  // Reveal on scroll (premium subtle)
  const revealTargets = root.querySelectorAll(".inv-card, .svc");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-revealed");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.18 });

  revealTargets.forEach((el) => io.observe(el));

  // Chips: active state only (no filtering/data)
  const chips = Array.from(root.querySelectorAll(".cat3-chip"));
  chips.forEach((btn) => {
    btn.addEventListener("click", () => {
      chips.forEach((c) => {
        c.classList.remove("is-active");
        c.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
    });
  });
})();



// ===== Category 4: scroll reveal (UI-only) =====
(function initCategory4Reveal(){
  const root = document.querySelector(".cat4");
  if (!root) return;

  const targets = root.querySelectorAll("[data-cat4-reveal], .cat4-cta__inner");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;

      // About: stagger (title -> cards)
      if (e.target.classList.contains("cat4-about__title")) {
        const title = e.target;
        const cards = root.querySelectorAll(".cat4-card");
        title.classList.add("is-revealed");
        cards.forEach((card, i) => setTimeout(() => card.classList.add("is-revealed"), 90 * (i + 1)));
        io.unobserve(title);
        return;
      }

      // CTA: single reveal
      if (e.target.classList.contains("cat4-cta__inner")) {
        e.target.classList.add("is-revealed");
        io.unobserve(e.target);
        return;
      }
    });
  }, { threshold: 0.18 });

  // Ensure title is observed for stagger trigger
  const title = root.querySelector(".cat4-about__title");
  if (title) io.observe(title);

  // Observe CTA
  const cta = root.querySelector(".cat4-cta__inner");
  if (cta) io.observe(cta);
})();


// ===== Category 5: Footer reveal + mobile accordion =====
(function initFooterCategory5(){
  const footer = document.querySelector("[data-footer]");
  if (!footer) return;

  const shell = footer.querySelector(".hkf__inner");
  const sections = Array.from(footer.querySelectorAll(".hkf-acc"));

  // Reveal on view
  if (shell) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        shell.classList.add("is-revealed");
        io.unobserve(e.target);
      });
    }, { threshold: 0.18 });
    io.observe(shell);
  }

  const mq = window.matchMedia("(max-width: 980px)");

  function closeAll(exceptEl) {
    sections.forEach((s) => {
      if (s === exceptEl) return;
      const btn = s.querySelector(".hkf-acc__btn");
      const panel = s.querySelector(".hkf-acc__panel");
      if (!btn || !panel) return;

      s.dataset.open = "false";
      btn.setAttribute("aria-expanded", "false");
      panel.style.maxHeight = "0px";
    });
  }

  function openSection(s) {
    const btn = s.querySelector(".hkf-acc__btn");
    const panel = s.querySelector(".hkf-acc__panel");
    if (!btn || !panel) return;

    s.dataset.open = "true";
    btn.setAttribute("aria-expanded", "true");
    panel.style.maxHeight = panel.scrollHeight + "px";
  }

  function toggleSection(s) {
    const isOpen = s.dataset.open === "true";
    if (isOpen) {
      const btn = s.querySelector(".hkf-acc__btn");
      const panel = s.querySelector(".hkf-acc__panel");
      if (!btn || !panel) return;

      s.dataset.open = "false";
      btn.setAttribute("aria-expanded", "false");
      panel.style.maxHeight = "0px";
      return;
    }

    // single-open behavior (matches PNG vibe)
    closeAll(s);
    openSection(s);
  }

  function bind() {
    const isMobile = mq.matches;

    sections.forEach((s) => {
      const btn = s.querySelector(".hkf-acc__btn");
      const panel = s.querySelector(".hkf-acc__panel");
      if (!btn || !panel) return;

      // remove old handler safely
      btn.onclick = null;

      if (!isMobile) {
        // Desktop: always expanded, no accordion behavior
        s.dataset.open = "true";
        btn.setAttribute("aria-expanded", "true");
        panel.style.maxHeight = "none";
        return;
      }

      // Mobile: collapsed default
      s.dataset.open = "false";
      btn.setAttribute("aria-expanded", "false");
      panel.style.maxHeight = "0px";

      btn.onclick = () => toggleSection(s);

      // Keyboard support (Enter/Space)
      btn.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleSection(s);
        }
      }, { passive: false });
    });
  }

  // Close panels on resize and re-measure heights
  mq.addEventListener?.("change", bind);
  window.addEventListener("resize", () => {
    if (!mq.matches) return;
    sections.forEach((s) => {
      if (s.dataset.open !== "true") return;
      const panel = s.querySelector(".hkf-acc__panel");
      if (panel) panel.style.maxHeight = panel.scrollHeight + "px";
    });
  });

  bind();
})();







/* js/app.js — ONLY added/updated parts for Invest Category 1 reveal */

(function () {
  const root = document.getElementById('investCat1');
  if (!root) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = Array.from(root.querySelectorAll('.reveal'));

  if (prefersReduced) {
    items.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      });
    },
    { root: null, threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
  );

  items.forEach((el) => io.observe(el));
})();



/* js/app.js — ONLY updated parts (extend reveal observer to Category 2 as well) */

(function () {
  const roots = [
    document.getElementById('investCat1'),
    document.getElementById('investCat2')
  ].filter(Boolean);

  if (roots.length === 0) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = roots.flatMap((r) => Array.from(r.querySelectorAll('.reveal')));

  if (prefersReduced) {
    items.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      });
    },
    { root: null, threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
  );

  items.forEach((el) => io.observe(el));
})();


/* js/app.js — ONLY updated parts (extend reveal observer to Category 3 as well) */

(function () {
  const roots = [
    document.getElementById('investCat1'),
    document.getElementById('investCat2'),
    document.getElementById('investCat3')
  ].filter(Boolean);

  if (roots.length === 0) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = roots.flatMap((r) => Array.from(r.querySelectorAll('.reveal')));

  if (prefersReduced) {
    items.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      });
    },
    { root: null, threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
  );

  items.forEach((el) => io.observe(el));
})();



/* js/app.js — ONLY updated parts (extend reveal observer to Category 4 as well) */

(function () {
  const roots = [
    document.getElementById('investCat1'),
    document.getElementById('investCat2'),
    document.getElementById('investCat3'),
    document.getElementById('investCat4')
  ].filter(Boolean);

  if (roots.length === 0) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = roots.flatMap((r) => Array.from(r.querySelectorAll('.reveal')));

  if (prefersReduced) {
    items.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      });
    },
    { root: null, threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
  );

  items.forEach((el) => io.observe(el));
})();


/* js/app.js — ONLY added/updated parts (ensure Category 5 reveal is observed) */

(function () {
  const roots = [
    document.getElementById('investCat1'),
    document.getElementById('investCat2'),
    document.getElementById('investCat3'),
    document.getElementById('investCat4'),
    document.getElementById('investCat5')
  ].filter(Boolean);

  if (roots.length === 0) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = roots.flatMap((r) => Array.from(r.querySelectorAll('.reveal')));

  if (prefersReduced) {
    items.forEach((el) => el.classList.add('is-inview'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      });
    },
    { root: null, threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
  );

  items.forEach((el) => io.observe(el));
})();


























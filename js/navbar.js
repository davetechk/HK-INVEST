/**
 * Premium Navbar for Agricultural Investment Platform
 * Minimal version - assumes you have theme system in place
 */

// Navbar configuration
const navbarConfig = {
  logo: {
    text: 'HK INVEST',
    icon: '🌱'  // You can replace with your own icon
  },
  navItems: [
    { label: 'Home', href: '#home', type: 'link' },
    {
      label: 'Market',
      type: 'dropdown',
      children: [
        { label: 'Live Prices', href: '#market/prices' },
        { label: 'Commodities', href: '#market/commodities' },
        { label: 'Market Insights', href: '#market/insights' },
        { label: 'Price Alerts', href: '#market/alerts' }
      ]
    },
    {
      label: 'Farm',
      type: 'dropdown',
      children: [
        { label: 'Farmers Hub', href: '#farm/hub' },
        { label: 'Rent Equipment', href: '#farm/equipment' },
        { label: 'Logistics & Storage', href: '#farm/logistics' },
        { label: 'Farm Updates', href: '#farm/updates' }
      ]
    },
    { label: 'Services', href: '#services', type: 'link' },
    { label: 'Invest', href: '#invest', type: 'link' }
  ]
};

class Navbar {
  constructor() {
    this.navbar = document.getElementById('mainNavbar');
    this.navbarRoot = document.getElementById('navbarRoot');
    this.lastScrollY = window.scrollY;
    
    this.init();
  }
  
  init() {
    this.renderNavbar();
    this.bindEvents();
  }
  
  renderNavbar() {
    if (!this.navbarRoot) return;
    
    this.navbarRoot.innerHTML = `
      <a href="#home" class="nav-logo">
        <div class="logo-icon">${navbarConfig.logo.icon}</div>
        <span>${navbarConfig.logo.text}</span>
      </a>
      
      <ul class="nav-links">
        ${navbarConfig.navItems.map((item, index) => this.renderNavItem(item, index)).join('')}
      </ul>
      
      <div class="nav-actions">
        <!-- Your theme toggle will go here - use your existing component -->
        <div id="themeToggleContainer"></div>
        
        <button class="btn btn-login">Login</button>
        <button class="btn btn-register">Create Account</button>
        
        <button class="mobile-toggle">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    `;
    
    // Render mobile menu
    this.renderMobileMenu();
  }
  
  renderNavItem(item, index) {
    if (item.type === 'dropdown') {
      return `
        <li class="nav-item dropdown">
          <a href="#" class="nav-link dropdown-toggle" data-index="${index}">
            ${item.label}
            <span class="dropdown-icon">▼</span>
          </a>
          <div class="dropdown-menu">
            ${item.children.map(child => `
              <a href="${child.href}" class="dropdown-item" data-section="${child.href.substring(1)}">
                ${child.label}
              </a>
            `).join('')}
          </div>
        </li>
      `;
    }
    
    return `
      <li class="nav-item">
        <a href="${item.href}" class="nav-link" data-section="${item.href.substring(1)}">
          ${item.label}
        </a>
      </li>
    `;
  }
  
  renderMobileMenu() {
    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.innerHTML = `
      <div class="mobile-logo" style="margin-bottom: 40px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="logo-icon" style="width: 36px; height: 36px; font-size: 1.2rem;">${navbarConfig.logo.icon}</div>
          <span style="font-weight: 700; font-size: 1.5rem; color: var(--text-primary)">${navbarConfig.logo.text}</span>
        </div>
      </div>
      
      <ul class="mobile-nav-links">
        ${navbarConfig.navItems.map((item, index) => this.renderMobileNavItem(item, index)).join('')}
      </ul>
      
      <div class="mobile-actions" style="margin-top: 30px; padding-top: 30px; border-top: 1px solid var(--border-color)">
        <button class="btn btn-login" style="width: 100%; margin-bottom: 16px;">Login</button>
        <button class="btn btn-register" style="width: 100%;">Create Account</button>
      </div>
    `;
    
    document.body.appendChild(mobileMenu);
  }
  
  renderMobileNavItem(item, index) {
    if (item.type === 'dropdown') {
      return `
        <li class="mobile-nav-item">
          <a href="#" class="mobile-nav-link dropdown-toggle" data-index="${index}">
            ${item.label}
            <span class="dropdown-icon" style="font-size: 10px;">▼</span>
          </a>
          <div class="mobile-dropdown-menu">
            ${item.children.map(child => `
              <a href="${child.href}" class="mobile-dropdown-item" data-section="${child.href.substring(1)}">
                ${child.label}
              </a>
            `).join('')}
          </div>
        </li>
      `;
    }
    
    return `
      <li class="mobile-nav-item">
        <a href="${item.href}" class="mobile-nav-link" data-section="${item.href.substring(1)}">
          ${item.label}
        </a>
      </li>
    `;
  }
  
  bindEvents() {
    // Desktop dropdown hover
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
      dropdown.addEventListener('mouseenter', () => {
        if (window.innerWidth > 992) {
          dropdown.classList.add('active');
        }
      });
      
      dropdown.addEventListener('mouseleave', () => {
        if (window.innerWidth > 992) {
          dropdown.classList.remove('active');
        }
      });
    });
    
    // Mobile menu toggle
    const mobileToggle = document.querySelector('.mobile-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (mobileToggle && mobileMenu) {
      mobileToggle.addEventListener('click', () => {
        mobileToggle.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
      });
    }
    
    // Mobile dropdown toggle
    document.addEventListener('click', (e) => {
      if (e.target.closest('.mobile-nav-link.dropdown-toggle')) {
        e.preventDefault();
        const dropdown = e.target.closest('.mobile-nav-link').nextElementSibling;
        dropdown.classList.toggle('active');
      }
    });
    
    // Scroll effect
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > 100) {
        this.navbar.classList.add('scrolled');
      } else {
        this.navbar.classList.remove('scrolled');
      }
      
      this.lastScrollY = currentScrollY;
    });
  }
}

// Initialize navbar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Navbar();
});
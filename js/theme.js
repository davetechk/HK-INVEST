// js/theme.js - Theme management
console.log('theme.js loaded');

const ThemeManager = {
    current: 'light',
    
    init() {
        // Load saved theme or default to light
        this.current = localStorage.getItem('hk-invest-theme') || 'light';
        this.applyTheme();
        
        // Add theme toggle if button exists
        this.setupThemeToggle();
    },
    
    applyTheme() {
        if (this.current === 'dark') {
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-light');
        } else {
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
        }
    },
    
    toggle() {
        this.current = this.current === 'light' ? 'dark' : 'light';
        localStorage.setItem('hk-invest-theme', this.current);
        this.applyTheme();
        return this.current;
    },
    
    setupThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const newTheme = this.toggle();
                toggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            });
            
            // Set initial icon
            toggleBtn.textContent = this.current === 'dark' ? '☀️' : '🌙';
        }
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
    ThemeManager.init();
}

// Export for use in other files
window.ThemeManager = ThemeManager;
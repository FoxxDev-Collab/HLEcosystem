/**
 * Theme Toggle Functionality
 * Handles light/dark mode switching with localStorage persistence
 */

const ThemeToggle = (function () {
    const STORAGE_KEY = 'theme-preference';
    const DARK_CLASS = 'dark';
    
    // Get initial theme from localStorage or system preference
    function getInitialTheme() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return stored;
        }
        
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        
        return 'light';
    }
    
    // Apply theme to document
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add(DARK_CLASS);
        } else {
            document.documentElement.classList.remove(DARK_CLASS);
        }
        
        // Store preference
        localStorage.setItem(STORAGE_KEY, theme);
        
        // Dispatch custom event for other components to react
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }
    
    // Toggle between light and dark
    function toggle() {
        const currentTheme = document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        return newTheme;
    }
    
    // Get current theme
    function getCurrentTheme() {
        return document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
    }
    
    // Initialize theme on page load
    function init() {
        const theme = getInitialTheme();
        applyTheme(theme);
        
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                // Only auto-switch if user hasn't set a preference
                if (!localStorage.getItem(STORAGE_KEY)) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }
    
    // Public API
    return {
        init,
        toggle,
        getCurrentTheme,
        setTheme: applyTheme
    };
})();

// Initialize theme as early as possible to prevent flash
ThemeToggle.init();

// Make ThemeToggle available globally
window.ThemeToggle = ThemeToggle;

// Add toggle button when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if toggle button already exists
    if (document.getElementById('theme-toggle-btn')) {
        return;
    }
    
    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'theme-toggle-btn';
    toggleBtn.className = 'theme-toggle';
    toggleBtn.setAttribute('aria-label', 'Toggle theme');
    toggleBtn.setAttribute('title', 'Toggle dark/light mode');
    
    // Set initial icon
    updateToggleIcon(toggleBtn);
    
    // Add click handler
    toggleBtn.addEventListener('click', function() {
        ThemeToggle.toggle();
        updateToggleIcon(toggleBtn);
    });
    
    // Add to page
    document.body.appendChild(toggleBtn);
    
    // Listen for theme changes
    window.addEventListener('themechange', function() {
        updateToggleIcon(toggleBtn);
    });
});

// Update toggle button icon
function updateToggleIcon(button) {
    const isDark = ThemeToggle.getCurrentTheme() === 'dark';
    
    // Sun icon for dark mode (click to go light)
    const sunIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
    `;
    
    // Moon icon for light mode (click to go dark)
    const moonIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
    `;
    
    button.innerHTML = isDark ? sunIcon : moonIcon;
    button.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

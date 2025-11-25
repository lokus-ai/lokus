// Documentation Navigation and Search Script

class DocumentationApp {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.sidebarClose = document.getElementById('sidebar-close');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.searchInput = document.getElementById('search-input');
        this.navLinks = document.querySelectorAll('.nav-link');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.setupSearch();
        this.updateActiveNavigation();
        this.setupKeyboardShortcuts();
    }

    setupEventListeners() {
        // Sidebar toggle functionality
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        if (this.sidebarClose) {
            this.sidebarClose.addEventListener('click', () => this.closeSidebar());
        }

        if (this.sidebarOverlay) {
            this.sidebarOverlay.addEventListener('click', () => this.closeSidebar());
        }

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSidebar();
            }
        });

        // Handle clicks outside sidebar on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const isClickInsideSidebar = this.sidebar.contains(e.target);
                const isToggleButton = this.sidebarToggle.contains(e.target);
                
                if (!isClickInsideSidebar && !isToggleButton && this.isSidebarOpen()) {
                    this.closeSidebar();
                }
            }
        });
    }

    setupNavigation() {
        // Add click handlers for navigation links
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Update active state
                this.setActiveNavLink(link);
                
                // Close sidebar on mobile after navigation
                if (window.innerWidth <= 768) {
                    setTimeout(() => this.closeSidebar(), 100);
                }
            });
        });

        // Setup smooth scrolling for hash links
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // Update URL
                    history.pushState(null, null, link.getAttribute('href'));
                }
            });
        });
    }

    setupSearch() {
        if (!this.searchInput) return;

        let searchTimeout;
        
        this.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });

        // Search keyboard shortcuts
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSearch();
            } else if (e.key === 'Enter') {
                this.navigateToFirstResult();
            }
        });
    }

    performSearch(query) {
        const normalizedQuery = query.toLowerCase().trim();
        
        if (!normalizedQuery) {
            this.clearSearch();
            return;
        }

        // Hide all navigation sections first
        document.querySelectorAll('.nav-section').forEach(section => {
            section.style.display = 'none';
        });

        // Show matching links
        let hasResults = false;
        this.navLinks.forEach(link => {
            const text = link.textContent.toLowerCase();
            const section = link.closest('.nav-section');
            
            if (text.includes(normalizedQuery)) {
                link.style.display = 'block';
                section.style.display = 'block';
                this.highlightSearchTerm(link, normalizedQuery);
                hasResults = true;
            } else {
                link.style.display = 'none';
                this.removeHighlight(link);
            }
        });

        // Show "no results" message if needed
        this.showNoResultsMessage(!hasResults);
    }

    highlightSearchTerm(element, term) {
        const text = element.textContent;
        const regex = new RegExp(`(${term})`, 'gi');
        const highlightedText = text.replace(regex, '<mark>$1</mark>');
        element.innerHTML = highlightedText;
    }

    removeHighlight(element) {
        element.innerHTML = element.textContent;
    }

    clearSearch() {
        this.searchInput.value = '';
        
        // Show all navigation sections and links
        document.querySelectorAll('.nav-section').forEach(section => {
            section.style.display = 'block';
        });
        
        this.navLinks.forEach(link => {
            link.style.display = 'block';
            this.removeHighlight(link);
        });

        this.hideNoResultsMessage();
    }

    showNoResultsMessage(show) {
        let noResultsEl = document.querySelector('.no-search-results');
        
        if (show && !noResultsEl) {
            noResultsEl = document.createElement('div');
            noResultsEl.className = 'no-search-results';
            noResultsEl.innerHTML = `
                <div style="padding: 1rem; text-align: center; color: var(--text-muted);">
                    <p>No results found</p>
                    <small>Try a different search term</small>
                </div>
            `;
            document.querySelector('.nav-menu').appendChild(noResultsEl);
        } else if (!show && noResultsEl) {
            noResultsEl.remove();
        }
    }

    hideNoResultsMessage() {
        const noResultsEl = document.querySelector('.no-search-results');
        if (noResultsEl) {
            noResultsEl.remove();
        }
    }

    navigateToFirstResult() {
        const visibleLinks = Array.from(this.navLinks).filter(link => 
            link.style.display !== 'none' && link.href
        );
        
        if (visibleLinks.length > 0) {
            visibleLinks[0].click();
        }
    }

    toggleSidebar() {
        if (this.isSidebarOpen()) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        this.sidebar.classList.add('open');
        this.sidebarOverlay.classList.add('show');
        document.body.style.overflow = window.innerWidth <= 768 ? 'hidden' : 'auto';
        
        // Focus search input when sidebar opens
        if (this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 100);
        }
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.sidebarOverlay.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    isSidebarOpen() {
        return this.sidebar.classList.contains('open');
    }

    handleResize() {
        // Close sidebar on desktop resize
        if (window.innerWidth > 768 && this.isSidebarOpen()) {
            this.closeSidebar();
        }
    }

    updateActiveNavigation() {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            
            // Check if link matches current page
            if (link.getAttribute('href') === currentPath || 
                link.getAttribute('href') === currentHash ||
                (currentPath.includes('index.html') && link.getAttribute('href') === '#')) {
                link.classList.add('active');
            }
        });
    }

    setActiveNavLink(activeLink) {
        this.navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + K for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (this.searchInput) {
                    if (!this.isSidebarOpen() && window.innerWidth <= 768) {
                        this.openSidebar();
                    }
                    this.searchInput.focus();
                }
            }
            
            // Cmd/Ctrl + B for sidebar toggle
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });
    }
}

// Utility functions for enhanced UX
class DocumentationUtils {
    static addCopyButtons() {
        // Add copy buttons to code blocks (if any exist)
        document.querySelectorAll('pre code').forEach(block => {
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.textContent = 'Copy';
            button.onclick = () => {
                navigator.clipboard.writeText(block.textContent);
                button.textContent = 'Copied!';
                setTimeout(() => button.textContent = 'Copy', 2000);
            };
            
            const pre = block.parentElement;
            pre.style.position = 'relative';
            pre.appendChild(button);
        });
    }

    static setupExternalLinks() {
        // Open external links in new tab
        document.querySelectorAll('a[href^="http"]').forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
    }

    static setupScrollSpy() {
        // Highlight current section in navigation based on scroll position
        const sections = document.querySelectorAll('section[id], h2[id], h3[id]');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    const navLink = document.querySelector(`.nav-link[href="#${id}"]`);
                    if (navLink) {
                        document.querySelectorAll('.nav-link').forEach(link => 
                            link.classList.remove('active')
                        );
                        navLink.classList.add('active');
                    }
                }
            });
        }, {
            rootMargin: '-20% 0px -70% 0px'
        });

        sections.forEach(section => observer.observe(section));
    }

    static addBackToTop() {
        // Add back to top button
        const button = document.createElement('button');
        button.className = 'back-to-top';
        button.innerHTML = '↑';
        button.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 3rem;
            height: 3rem;
            border-radius: 50%;
            background: var(--primary-color);
            color: white;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1000;
        `;

        button.onclick = () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        document.body.appendChild(button);

        // Show/hide based on scroll position
        window.addEventListener('scroll', () => {
            button.style.opacity = window.scrollY > 300 ? '1' : '0';
        });
    }

    static setupPrintStyles() {
        // Add print button functionality
        document.querySelectorAll('.print-page').forEach(button => {
            button.onclick = () => window.print();
        });
    }

    static setupTableOfContents() {
        // Generate table of contents for long pages
        const headings = document.querySelectorAll('h2, h3, h4');
        if (headings.length > 5) {
            const toc = document.createElement('nav');
            toc.className = 'table-of-contents';
            toc.innerHTML = '<h3>Table of Contents</h3>';
            
            const list = document.createElement('ul');
            headings.forEach((heading, index) => {
                if (!heading.id) {
                    heading.id = `heading-${index}`;
                }
                
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.href = `#${heading.id}`;
                link.textContent = heading.textContent;
                link.className = `toc-${heading.tagName.toLowerCase()}`;
                
                item.appendChild(link);
                list.appendChild(item);
            });
            
            toc.appendChild(list);
            
            // Insert TOC after the first paragraph or at the beginning of content
            const firstParagraph = document.querySelector('.content p');
            if (firstParagraph) {
                firstParagraph.parentNode.insertBefore(toc, firstParagraph.nextSibling);
            }
        }
    }
}

// Theme management
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('docs-theme') || 'auto';
        this.applyTheme();
    }

    applyTheme() {
        if (this.currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (this.currentTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    toggleTheme() {
        const themes = ['auto', 'light', 'dark'];
        const currentIndex = themes.indexOf(this.currentTheme);
        this.currentTheme = themes[(currentIndex + 1) % themes.length];
        
        localStorage.setItem('docs-theme', this.currentTheme);
        this.applyTheme();
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main app
    const app = new DocumentationApp();
    
    // Initialize utilities
    DocumentationUtils.addCopyButtons();
    DocumentationUtils.setupExternalLinks();
    DocumentationUtils.setupScrollSpy();
    DocumentationUtils.addBackToTop();
    DocumentationUtils.setupPrintStyles();
    DocumentationUtils.setupTableOfContents();
    
    // Initialize theme manager
    const themeManager = new ThemeManager();
    
    // Add theme toggle if element exists
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => themeManager.toggleTheme());
    }
    
    // Performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', () => {
            const loadTime = performance.now();
        });
    }
});

// Service worker registration for offline support (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
        });
    });
}
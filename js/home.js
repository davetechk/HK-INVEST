// js/home.js - Home page specific functionality
console.log('home.js loaded successfully');

// Initialize hero slideshow
function initHeroSlideshow() {
    console.log('Initializing hero slideshow');
    const slides = document.querySelectorAll('.hero-section .slide');
    const indicators = document.querySelectorAll('.slideshow-indicators .indicator');
    let currentSlide = 0;
    
    if (slides.length === 0) return;
    
    function showSlide(index) {
        // Remove active class from all slides
        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(indicator => indicator.classList.remove('active'));
        
        // Add active class to current slide
        slides[index].classList.add('active');
        indicators[index].classList.add('active');
        
        currentSlide = index;
    }
    
    // Set up indicator clicks
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            showSlide(index);
        });
    });
    
    // Auto-advance slides every 5 seconds
    const slideshowInterval = setInterval(() => {
        let nextSlide = (currentSlide + 1) % slides.length;
        showSlide(nextSlide);
    }, 5000);
    
    return function cleanup() {
        clearInterval(slideshowInterval);
    };
}

// Initialize scroll animations for home page
function initHomeScrollAnimations() {
    console.log('Initializing scroll animations');
    
    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
        console.log('IntersectionObserver not supported, using fallback');
        // Fallback: Show all elements immediately
        document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right').forEach(el => {
            el.classList.add('is-visible');
        });
        return;
    }
    
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add is-visible class to trigger CSS animations
                entry.target.classList.add('is-visible');
                
                // Stop observing after animation starts
                setTimeout(() => {
                    observer.unobserve(entry.target);
                }, 100);
            }
        });
    }, observerOptions);
    
    // Observe all reveal elements
    const revealElements = document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right');
    console.log(`Found ${revealElements.length} elements to animate`);
    
    revealElements.forEach(el => {
        observer.observe(el);
    });
    
    // Animate hero elements immediately (no need to wait for scroll)
    setTimeout(() => {
        const heroElements = document.querySelectorAll('.hero-title, .hero-subtitle, .hero-cta');
        heroElements.forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('is-visible');
            }, index * 200);
        });
    }, 300);
}

// Initialize card interactions for home page
function initHomeCardInteractions() {
    console.log('Initializing card interactions');
    
    // All glass cards automatically get hover effects via CSS
    const cards = document.querySelectorAll('.glass-card');
    
    cards.forEach(card => {
        // Ensure all cards have hover-lift class
        if (!card.classList.contains('hover-lift')) {
            card.classList.add('hover-lift');
        }
        
        // Add press effect
        card.addEventListener('mousedown', () => {
            card.style.transform = 'translateY(-4px) scale(0.99)';
        });
        
        card.addEventListener('mouseup', () => {
            card.style.transform = '';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

// Initialize home page when DOM is loaded
function initHomePage() {
    console.log('Initializing home page');
    
    // Initialize slideshow
    const cleanupSlideshow = initHeroSlideshow();
    
    // Initialize scroll animations
    initHomeScrollAnimations();
    
    // Initialize card interactions
    initHomeCardInteractions();
    
    // Add animation to stats with delay
    setTimeout(() => {
        document.querySelectorAll('.stat-item').forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('is-visible');
            }, index * 200);
        });
    }, 1000);
    
    // Cleanup function
    return function cleanup() {
        if (cleanupSlideshow) cleanupSlideshow();
    };
}

// Initialize immediately if on home page
if (document.querySelector('.index-page')) {
    // Wait a bit for CSS to load
    setTimeout(() => {
        initHomePage();
    }, 100);
}




// Export functions for use in app.js
window.initHomePage = initHomePage;
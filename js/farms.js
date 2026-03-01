// farms.js - Invest page specific functionality for HK INVEST
// Handles farm listings, filtering, sorting, and animations

// Farm data (moved from inline HTML)
const farmData = [
    {
        id: 1,
        name: "Kaduna Maize Farm",
        crop: "Maize",
        location: "Kaduna",
        image: "assets/images/farm-maize.jpg",
        fundingGoal: 5500000,
        fundedAmount: 4300000,
        roi: 32,
        duration: 6,
        risk: "low",
        description: "Large-scale maize farm with irrigation and proven track record.",
        verified: true,
        agentRating: 4.8
    },
    {
        id: 2,
        name: "Kebbi Rice Farm",
        crop: "Rice",
        location: "Kebbi",
        image: "assets/images/farm-rice.jpg",
        fundingGoal: 6000000,
        fundedAmount: 2700000,
        roi: 28,
        duration: 8,
        risk: "medium",
        description: "Rice farm in Nigeria's rice belt with modern milling equipment.",
        verified: true,
        agentRating: 4.5
    },
    {
        id: 3,
        name: "Oyo Tomato Farm",
        crop: "Tomatoes",
        location: "Oyo",
        image: "assets/images/farm-tomato.jpg",
        fundingGoal: 2000000,
        fundedAmount: 1840000,
        roi: 24,
        duration: 4,
        risk: "low",
        description: "Greenhouse tomato farm with climate control technology.",
        verified: true,
        agentRating: 4.9
    },
    {
        id: 4,
        name: "Kano Sorghum Farm",
        crop: "Sorghum",
        location: "Kano",
        image: "assets/images/farm-sorghum.jpg",
        fundingGoal: 3500000,
        fundedAmount: 2100000,
        roi: 35,
        duration: 7,
        risk: "medium",
        description: "Traditional sorghum farm expanding to commercial scale.",
        verified: true,
        agentRating: 4.3
    },
    {
        id: 5,
        name: "Benue Vegetable Farm",
        crop: "Vegetables",
        location: "Benue",
        image: "assets/images/farm-vegetables.jpg",
        fundingGoal: 1500000,
        fundedAmount: 1200000,
        roi: 22,
        duration: 3,
        risk: "low",
        description: "Mixed vegetable farm supplying local markets.",
        verified: true,
        agentRating: 4.7
    },
    {
        id: 6,
        name: "Plateau Potato Farm",
        crop: "Potatoes",
        location: "Plateau",
        image: "assets/images/farm-potato.jpg",
        fundingGoal: 2800000,
        fundedAmount: 1400000,
        roi: 30,
        duration: 5,
        risk: "medium",
        description: "Highland potato farm with cold storage facilities.",
        verified: true,
        agentRating: 4.4
    },
    {
        id: 7,
        name: "Niger Millet Farm",
        crop: "Millet",
        location: "Niger",
        image: "assets/images/farm-millet.jpg",
        fundingGoal: 4200000,
        fundedAmount: 3780000,
        roi: 26,
        duration: 6,
        risk: "low",
        description: "Organic millet farm with export certification.",
        verified: true,
        agentRating: 4.8
    },
    {
        id: 8,
        name: "Experimental Cassava Farm",
        crop: "Cassava",
        location: "Ogun",
        image: "assets/images/farm-cassava.jpg",
        fundingGoal: 5000000,
        fundedAmount: 1500000,
        roi: 42,
        duration: 10,
        risk: "high",
        description: "New high-yield cassava variety with processing unit.",
        verified: true,
        agentRating: 4.2
    },
    {
        id: 9,
        name: "Sokoto Onion Farm",
        crop: "Onions",
        location: "Sokoto",
        image: "assets/images/farm-onion.jpg",
        fundingGoal: 1800000,
        fundedAmount: 1260000,
        roi: 27,
        duration: 4,
        risk: "low",
        description: "Specialized onion farm with irrigation system.",
        verified: true,
        agentRating: 4.6
    },
    {
        id: 10,
        name: "Enugu Yam Farm",
        crop: "Yam",
        location: "Enugu",
        image: "assets/images/farm-yam.jpg",
        fundingGoal: 3200000,
        fundedAmount: 2240000,
        roi: 31,
        duration: 8,
        risk: "medium",
        description: "Traditional yam farm modernizing operations.",
        verified: true,
        agentRating: 4.5
    },
    {
        id: 11,
        name: "Delta Fish Farm",
        crop: "Aquaculture",
        location: "Delta",
        image: "assets/images/farm-fish.jpg",
        fundingGoal: 7500000,
        fundedAmount: 5250000,
        roi: 29,
        duration: 9,
        risk: "medium",
        description: "Catfish farm with hatchery and processing facilities.",
        verified: true,
        agentRating: 4.7
    },
    {
        id: 12,
        name: "Zamfara Ginger Farm",
        crop: "Ginger",
        location: "Zamfara",
        image: "assets/images/farm-ginger.jpg",
        fundingGoal: 2500000,
        fundedAmount: 1000000,
        roi: 38,
        duration: 7,
        risk: "high",
        description: "Ginger farm for export market with drying facilities.",
        verified: true,
        agentRating: 4.1
    }
];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('HK INVEST: Initializing farms page');
    initFarmListings();
    initFilters();
    initSorting();
    initRevealAnimations();
});

// Initialize farm listings
function initFarmListings() {
    const listingsContainer = document.getElementById('farm-listings');
    const totalCountElement = document.getElementById('total-count');
    
    if (!listingsContainer || !totalCountElement) {
        console.error('Farm listings elements not found');
        return;
    }
    
    // Set total count
    totalCountElement.textContent = farmData.length;
    
    // Render all farms initially
    renderFarms(farmData);
    
    // Update visible count
    updateVisibleCount(farmData.length);
}

// Render farms to the page
function renderFarms(farms) {
    const listingsContainer = document.getElementById('farm-listings');
    const noResultsMessage = document.getElementById('no-results-message');
    
    if (!listingsContainer) return;
    
    // Clear existing listings
    listingsContainer.innerHTML = '';
    
    if (farms.length === 0) {
        listingsContainer.style.display = 'none';
        if (noResultsMessage) noResultsMessage.style.display = 'block';
        return;
    }
    
    listingsContainer.style.display = 'grid';
    if (noResultsMessage) noResultsMessage.style.display = 'none';
    
    // Render each farm with stagger animation
    farms.forEach((farm, index) => {
        const progressPercent = Math.round((farm.fundedAmount / farm.fundingGoal) * 100);
        const formattedGoal = formatCurrency(farm.fundingGoal);
        const formattedFunded = formatCurrency(farm.fundedAmount);
        
        const farmCard = document.createElement('div');
        farmCard.className = 'farm-card glass-card card-hoverable stagger-item';
        farmCard.style.setProperty('--stagger-index', index);
        farmCard.innerHTML = `
            <div class="farm-badge ${farm.risk}-risk">${farm.risk.charAt(0).toUpperCase() + farm.risk.slice(1)} Risk</div>
            ${farm.verified ? '<div class="farm-badge verified">Agent Verified</div>' : ''}
            
            <div class="farm-image">
                <img src="${farm.image}" alt="${farm.crop} farm in ${farm.location}" loading="lazy">
            </div>
            
            <div class="farm-content">
                <div class="farm-header">
                    <h3>${farm.name}</h3>
                    <div class="farm-location">
                        <span class="location-icon">📍</span>
                        ${farm.location}, Nigeria
                    </div>
                </div>
                
                <div class="farm-details">
                    <div class="detail-item">
                        <span class="detail-label">Crop Type</span>
                        <span class="detail-value">${farm.crop}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Duration</span>
                        <span class="detail-value">${farm.duration} Months</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Target ROI</span>
                        <span class="detail-value highlight">${farm.roi}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Risk Level</span>
                        <span class="detail-value">
                            <span class="risk-indicator ${farm.risk}-risk"></span>
                            ${farm.risk.charAt(0).toUpperCase() + farm.risk.slice(1)}
                        </span>
                    </div>
                </div>
                
                <div class="farm-progress">
                    <div class="progress-header">
                        <span>Funded: ${progressPercent}%</span>
                        <span>${formattedFunded} / ${formattedGoal}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="--progress-width: ${progressPercent}%"></div>
                    </div>
                </div>
                
                <div class="farm-actions">
                    <a href="farms/farm-details.html?id=${farm.id}" class="btn btn-outline hover-lift press-down">View Details</a>
                    <a href="auth/login.html?redirect=invest&farm=${farm.id}" class="btn btn-primary hover-lift press-down">Invest Now</a>
                </div>
            </div>
        `;
        
        listingsContainer.appendChild(farmCard);
    });
}

// Format currency for display
function formatCurrency(amount) {
    if (amount >= 1000000) {
        return '₦' + (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
        return '₦' + (amount / 1000).toFixed(0) + 'K';
    }
    return '₦' + amount;
}

// Update visible farm count
function updateVisibleCount(count) {
    const visibleCountElement = document.getElementById('visible-count');
    if (visibleCountElement) {
        visibleCountElement.textContent = count;
        // Add quick fade animation
        visibleCountElement.classList.add('quick-fade-in');
        setTimeout(() => {
            visibleCountElement.classList.remove('quick-fade-in');
        }, 300);
    }
}

// Initialize filter functionality
function initFilters() {
    const searchInput = document.getElementById('search-input');
    const cropFilter = document.getElementById('crop-filter');
    const locationFilter = document.getElementById('location-filter');
    const riskFilterButtons = document.querySelectorAll('.risk-filter-btn');
    const durationFilter = document.getElementById('duration-filter');
    const roiFilter = document.getElementById('roi-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const resetFiltersBtn = document.getElementById('reset-filters');

    if (!searchInput || !cropFilter) return;

    // Apply all current filters
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedCrop = cropFilter.value;
        const selectedLocation = locationFilter ? locationFilter.value : 'all';
        const selectedRisk = document.querySelector('.risk-filter-btn.active')?.dataset.risk || 'all';
        const selectedDuration = durationFilter ? durationFilter.value : 'all';
        const selectedROI = roiFilter ? roiFilter.value : 'all';

        const filteredFarms = farmData.filter(farm => {
            // Search filter
            if (searchTerm && 
                !farm.name.toLowerCase().includes(searchTerm) && 
                !farm.crop.toLowerCase().includes(searchTerm) &&
                !farm.location.toLowerCase().includes(searchTerm)) {
                return false;
            }

            // Crop filter
            if (selectedCrop !== 'all' && farm.crop.toLowerCase() !== selectedCrop) {
                if (selectedCrop === 'grains' && !['maize', 'rice', 'sorghum', 'millet'].includes(farm.crop.toLowerCase())) {
                    return false;
                }
                if (selectedCrop === 'vegetables' && !['tomatoes', 'onions', 'potatoes'].includes(farm.crop.toLowerCase())) {
                    return false;
                }
                if (!['grains', 'vegetables'].includes(selectedCrop)) {
                    return false;
                }
            }

            // Location filter
            if (selectedLocation !== 'all') {
                if (selectedLocation === 'others') {
                    const majorStates = ['kaduna', 'kebbi', 'oyo', 'kano', 'niger', 'benue', 'plateau'];
                    if (majorStates.includes(farm.location.toLowerCase())) {
                        return false;
                    }
                } else if (farm.location.toLowerCase() !== selectedLocation) {
                    return false;
                }
            }

            // Risk filter
            if (selectedRisk !== 'all' && farm.risk !== selectedRisk) {
                return false;
            }

            // Duration filter
            if (selectedDuration !== 'all') {
                if (selectedDuration === 'short' && farm.duration > 4) return false;
                if (selectedDuration === 'medium' && (farm.duration < 5 || farm.duration > 8)) return false;
                if (selectedDuration === 'long' && farm.duration < 9) return false;
            }

            // ROI filter
            if (selectedROI !== 'all') {
                if (selectedROI === 'low' && (farm.roi < 15 || farm.roi > 25)) return false;
                if (selectedROI === 'medium' && (farm.roi < 26 || farm.roi > 35)) return false;
                if (selectedROI === 'high' && farm.roi < 36) return false;
            }

            return true;
        });

        // Apply sorting
        const sortSelect = document.getElementById('sort-select');
        const sortType = sortSelect ? sortSelect.value : 'roi-desc';
        const sortedFarms = sortFarms(filteredFarms, sortType);
        
        // Render filtered farms with animation
        renderFarms(sortedFarms);
        updateVisibleCount(sortedFarms.length);
    }

    // Event listeners
    searchInput.addEventListener('input', applyFilters);
    cropFilter.addEventListener('change', applyFilters);
    if (locationFilter) locationFilter.addEventListener('change', applyFilters);
    if (durationFilter) durationFilter.addEventListener('change', applyFilters);
    if (roiFilter) roiFilter.addEventListener('change', applyFilters);

    // Risk filter buttons
    riskFilterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            riskFilterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            applyFilters();
        });
    });

    // Clear filters button
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            searchInput.value = '';
            cropFilter.value = 'all';
            if (locationFilter) locationFilter.value = 'all';
            if (durationFilter) durationFilter.value = 'all';
            if (roiFilter) roiFilter.value = 'all';
            
            riskFilterButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.risk === 'all') {
                    btn.classList.add('active');
                }
            });
            
            applyFilters();
        });
    }

    // Reset filters button (in no results message)
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            searchInput.value = '';
            cropFilter.value = 'all';
            if (locationFilter) locationFilter.value = 'all';
            if (durationFilter) durationFilter.value = 'all';
            if (roiFilter) roiFilter.value = 'all';
            
            riskFilterButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.risk === 'all') {
                    btn.classList.add('active');
                }
            });
            
            applyFilters();
        });
    }

    // Initial filter application
    applyFilters();
}

// Initialize sorting
function initSorting() {
    const sortSelect = document.getElementById('sort-select');
    
    if (!sortSelect) return;
    
    sortSelect.addEventListener('change', function() {
        const filteredFarms = getCurrentFilteredFarms();
        const sortedFarms = sortFarms(filteredFarms, this.value);
        renderFarms(sortedFarms);
    });
}

// Sort farms based on criteria
function sortFarms(farms, sortType) {
    return [...farms].sort((a, b) => {
        switch (sortType) {
            case 'roi-desc':
                return b.roi - a.roi;
            case 'roi-asc':
                return a.roi - b.roi;
            case 'risk-asc':
                const riskOrder = { low: 1, medium: 2, high: 3 };
                return riskOrder[a.risk] - riskOrder[b.risk];
            case 'duration-asc':
                return a.duration - b.duration;
            case 'progress-desc':
                const progressA = (a.fundedAmount / a.fundingGoal) * 100;
                const progressB = (b.fundedAmount / b.fundingGoal) * 100;
                return progressB - progressA;
            default:
                return 0;
        }
    });
}

// Get currently filtered farms
function getCurrentFilteredFarms() {
    const searchInput = document.getElementById('search-input');
    const cropFilter = document.getElementById('crop-filter');
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCrop = cropFilter.value;
    
    return farmData.filter(farm => {
        if (searchTerm && 
            !farm.name.toLowerCase().includes(searchTerm) && 
            !farm.crop.toLowerCase().includes(searchTerm)) {
            return false;
        }
        
        if (selectedCrop !== 'all' && farm.crop.toLowerCase() !== selectedCrop) {
            return false;
        }
        
        return true;
    });
}

// Initialize reveal animations on scroll
function initRevealAnimations() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale');
    
    if (revealElements.length === 0) return;
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    revealElements.forEach(element => {
        revealObserver.observe(element);
    });
}
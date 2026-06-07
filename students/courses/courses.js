// resources.js — Hybrid filtering: Category tabs + Value-type chips + Search

// ──────────────────────────────────────────────
//  State
// ──────────────────────────────────────────────
let allResources = [];              // Full flat array from JSON
let filteredResources = [];         // After all filters applied
let activeCategory = 'all';         // Primary category (single-select)
let activeValueTypes = new Set();   // Value-type chips (multi-select OR)
let searchTerm = '';                // Text search

const itemsPerPage = 16;
let currentPage = 1;
let centerPage = 1;

// Category mapping: tab data-category values
const CATEGORIES = [
    'all',
    'cs',
    'ai-ml',
    'math-data',
    'cloud-it'
];

const VALUE_TYPES = ['mit', 'harvard', 'stanford', 'cmu', 'open-u', 'princeton'];

// ──────────────────────────────────────────────
//  DOM Elements
// ──────────────────────────────────────────────
const coursesGrid = document.getElementById('courses-grid');
const loadingState = document.getElementById('loading');
const noResults = document.getElementById('no-results');
const resultsCount = document.getElementById('results-count');
const searchInput = document.getElementById('search-input');
const categoryTabs = document.querySelectorAll('.tab-btn');
const valueChips = document.querySelectorAll('.value-chip');
const tabIndicator = document.getElementById('tab-indicator');


// ──────────────────────────────────────────────
//  Initialize
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadResources();
    setupCategoryListeners();
    setupValueChipListeners();
    setupSearchListener();
    setupKeyboardNav();

    // Position indicator on initial active tab
    moveIndicator();

    // Reposition on window resize
    window.addEventListener('resize', moveIndicator);
});


// ──────────────────────────────────────────────
//  Data Loading
// ──────────────────────────────────────────────
async function loadResources() {
    try {
        const response = await fetch('/students/courses-data.json');
        if (!response.ok) throw new Error('Failed to load courses');

        const data = await response.json();

        // JSON is a flat array (not { all_items: [...] })
        allResources = Array.isArray(data) ? data : (data.all_items || []);

        updateTabCounts();
        applyFilters();
    } catch (error) {
        console.error('Error loading courses:', error);
        showError();
    }
}


// ──────────────────────────────────────────────
//  Tab Counts — show count on each category tab
// ──────────────────────────────────────────────
function updateTabCounts() {
    categoryTabs.forEach(tab => {
        const cat = tab.getAttribute('data-category');
        let count;
        if (cat === 'all') {
            count = allResources.length;
        } else {
            count = allResources.filter(item =>
                item.tags && item.tags.includes(cat)
            ).length;
        }

        // Add or update count badge
        let badge = tab.querySelector('.tab-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'tab-count';
            tab.appendChild(badge);
        }
        badge.textContent = count;
    });
}


// ──────────────────────────────────────────────
//  Category Tab Listeners (single-select)
// ──────────────────────────────────────────────
function setupCategoryListeners() {
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all, activate clicked
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            activeCategory = tab.getAttribute('data-category');
            resetPagination();
            applyFilters();

            // Slide the indicator to the new tab
            moveIndicator();

            // Ensure tab is visible on mobile
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });
}


// ──────────────────────────────────────────────
//  Value-Type Chip Listeners (multi-select OR)
// ──────────────────────────────────────────────
function setupValueChipListeners() {
    valueChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const value = chip.getAttribute('data-value');

            if (activeValueTypes.has(value)) {
                activeValueTypes.delete(value);
                chip.classList.remove('active');
            } else {
                activeValueTypes.add(value);
                chip.classList.add('active');
            }

            resetPagination();
            applyFilters();
        });
    });
}


// ──────────────────────────────────────────────
//  Search Listener (debounced)
// ──────────────────────────────────────────────
function setupSearchListener() {
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchTerm = e.target.value.trim().toLowerCase();
            resetPagination();
            applyFilters();
        }, 250);
    });
}


// ──────────────────────────────────────────────
//  Keyboard Navigation (Left/Right arrows)
// ──────────────────────────────────────────────
function setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
        // Don't hijack arrows when typing in search
        if (document.activeElement === searchInput) return;

        const currentIndex = CATEGORIES.indexOf(activeCategory);

        if (e.key === 'ArrowRight' && currentIndex < CATEGORIES.length - 1) {
            switchToCategory(CATEGORIES[currentIndex + 1]);
        }
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
            switchToCategory(CATEGORIES[currentIndex - 1]);
        }
    });
}

function switchToCategory(category) {
    activeCategory = category;

    categoryTabs.forEach(tab => {
        if (tab.getAttribute('data-category') === category) {
            tab.classList.add('active');
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            tab.classList.remove('active');
        }
    });

    moveIndicator();
    resetPagination();
    applyFilters();
}


// ──────────────────────────────────────────────
//  Sliding Indicator — moves under the active tab
// ──────────────────────────────────────────────
function moveIndicator() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (!activeTab || !tabIndicator) return;

    const nav = document.getElementById('category-tabs');
    const navRect = nav.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();

    // Calculate position relative to the nav container (accounts for scroll)
    const left = tabRect.left - navRect.left + nav.scrollLeft;
    const width = tabRect.width;

    tabIndicator.style.left = left + 'px';
    tabIndicator.style.width = width + 'px';
}


// ──────────────────────────────────────────────
//  Filtering Pipeline
//  Category (single) → Value Types (OR multi) → Search text
// ──────────────────────────────────────────────
function applyFilters() {
    loadingState.style.display = 'block';
    coursesGrid.style.display = 'none';
    noResults.style.display = 'none';

    // Small delay for visual feedback
    setTimeout(() => {
        let results = allResources;

        // 1. Category filter (skip if "all")
        if (activeCategory !== 'all') {
            results = results.filter(item =>
                item.tags && item.tags.includes(activeCategory)
            );
        }

        // 2. Value-type filter (OR logic — item must have at least one active type)
        if (activeValueTypes.size > 0) {
            results = results.filter(item =>
                item.tags && item.tags.some(tag => activeValueTypes.has(tag))
            );
        }

        // 3. Text search (matches course name OR university OR topic)
        if (searchTerm) {
            results = results.filter(item =>
                item.courseName.toLowerCase().includes(searchTerm) ||
                item.university.toLowerCase().includes(searchTerm) ||
                item.topic.toLowerCase().includes(searchTerm)
            );
        }

        filteredResources = results;

        // Update results count
        resultsCount.textContent = filteredResources.length;

        if (filteredResources.length === 0) {
            showNoResults();
            return;
        }

        renderPage(currentPage);
        loadingState.style.display = 'none';
        coursesGrid.style.display = 'grid';
    }, 150);
}


// ──────────────────────────────────────────────
//  Pagination
// ──────────────────────────────────────────────
function resetPagination() {
    currentPage = 1;
    centerPage = 1;
}

function renderPage(page) {
    currentPage = page;
    coursesGrid.innerHTML = '';

    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredResources.slice(start, end);

    pageItems.forEach((resource, index) => {
        const card = createCourseCard(resource, index);
        coursesGrid.appendChild(card);
    });

    renderPaginationButtons();
}

function renderPaginationButtons() {
    const container = document.getElementById('pages-container');
    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
    if (!container) return;
    container.innerHTML = '';

    // Hide pagination bar if 1 or fewer pages
    const paginationBar = document.querySelector('.pagination-bar');
    if (totalPages <= 1) {
        paginationBar.style.display = 'none';
        return;
    }
    paginationBar.style.display = 'flex';

    const createBtn = (text, type, onClick) => {
        const btn = document.createElement(type === 'placeholder' ? 'div' : 'button');
        btn.className = `page-circle ${type}`;
        if (type !== 'placeholder') {
            btn.textContent = text;
            btn.onclick = onClick;
        } else {
            btn.style.width = "3.5rem";
            btn.style.visibility = "hidden";
        }
        container.appendChild(btn);
    };

    // Slot 1: Previous Number
    const prevNum = centerPage - 1;
    if (prevNum >= 1) {
        createBtn(prevNum, (prevNum === currentPage) ? 'active' : 'inactive', () => goToPage(prevNum));
    } else {
        createBtn('', 'placeholder', null);
    }

    // Slot 2: Center Number
    createBtn(centerPage, (centerPage === currentPage) ? 'active' : 'inactive', () => goToPage(centerPage));

    // Slot 3: Next Number
    const nextNum = centerPage + 1;
    if (nextNum <= totalPages) {
        createBtn(nextNum, (nextNum === currentPage) ? 'active' : 'inactive', () => goToPage(nextNum));
    } else {
        createBtn('', 'placeholder', null);
    }

    // Arrow buttons
    document.getElementById('prev-page').onclick = () => changePage('prev', totalPages);
    document.getElementById('next-page').onclick = () => changePage('next', totalPages);
}

function goToPage(num) {
    centerPage = num;
    currentPage = num;
    renderPage(num);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changePage(direction, totalPages) {
    if (direction === 'prev' && centerPage > 1) {
        centerPage--;
        renderPaginationButtons();
    } else if (direction === 'next' && centerPage < totalPages) {
        centerPage++;
        renderPaginationButtons();
    }
}


// ──────────────────────────────────────────────
//  Card Creation
// ──────────────────────────────────────────────
function createCourseCard(resource, index) {
    const cardLink = document.createElement('a');
    cardLink.href = resource.url || '#';
    cardLink.target = "_blank";
    cardLink.rel = "noopener noreferrer";
    cardLink.className = 'course-card';
    cardLink.style.animation = `fadeIn 0.35s ease-in ${index * 0.03}s both`;
    cardLink.setAttribute('aria-label', `View course: ${resource.courseName}`);

    // Header: Uni + Provider
    const header = document.createElement('div');
    header.className = 'course-card-header';
    
    const uniBadge = document.createElement('span');
    uniBadge.className = 'course-uni';
    uniBadge.textContent = resource.university;
    header.appendChild(uniBadge);

    if (resource.provider && resource.provider !== resource.university && resource.provider !== "OpenLearn") {
        const providerText = document.createElement('span');
        providerText.className = 'course-provider';
        providerText.textContent = resource.provider;
        header.appendChild(providerText);
    }
    cardLink.appendChild(header);

    // Title
    const title = document.createElement('h3');
    title.className = 'course-title';
    title.textContent = resource.courseName;
    cardLink.appendChild(title);

    // Footer: Topic + Button
    const footer = document.createElement('div');
    footer.className = 'course-card-footer';
    
    const topic = document.createElement('span');
    topic.className = 'course-topic';
    topic.textContent = resource.topic;
    footer.appendChild(topic);

    const btn = document.createElement('div');
    btn.className = 'course-btn';
    btn.innerHTML = `View Course <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    footer.appendChild(btn);

    cardLink.appendChild(footer);

    return cardLink;
}


// ──────────────────────────────────────────────
//  Empty / Error States
// ──────────────────────────────────────────────
function showNoResults() {
    loadingState.style.display = 'none';
    coursesGrid.style.display = 'none';
    noResults.style.display = 'block';

    // Hide pagination
    const paginationBar = document.querySelector('.pagination-bar');
    if (paginationBar) paginationBar.style.display = 'none';
}

function showError() {
    loadingState.innerHTML = '<p style="color: #d73634;">Failed to load courses. Please try again later.</p>';
}


// ──────────────────────────────────────────────
//  Export for external use
// ──────────────────────────────────────────────
window.coursesApp = {
    applyFilters,
    loadResources,
    switchToCategory
};
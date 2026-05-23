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
    'Developer Tools',
    'Cloud & Hosting',
    'AI & Machine Learning',
    'Design & Creative',
    'Learning & Courses',
    'Productivity & Collaboration',
    'Security & Privacy',
    'Entertainment & Wellness',
    'Web3 & Crypto'
];

const VALUE_TYPES = ['Free', 'Discount', 'Trial', 'Credit', 'Grant'];

// ──────────────────────────────────────────────
//  DOM Elements
// ──────────────────────────────────────────────
const tableBody = document.getElementById('table-body');
const resourcesTable = document.getElementById('resources-table');
const loadingState = document.getElementById('loading');
const noResults = document.getElementById('no-results');
const resultsCount = document.getElementById('results-count');
const searchInput = document.getElementById('search-input');
const categoryTabs = document.querySelectorAll('.tab-btn');
const valueChips = document.querySelectorAll('.value-chip');


// ──────────────────────────────────────────────
//  Initialize
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadResources();
    setupCategoryListeners();
    setupValueChipListeners();
    setupSearchListener();
    setupKeyboardNav();
});


// ──────────────────────────────────────────────
//  Data Loading
// ──────────────────────────────────────────────
async function loadResources() {
    try {
        const response = await fetch('/students/resources/resources-data.json');
        if (!response.ok) throw new Error('Failed to load resources');

        const data = await response.json();

        // JSON is a flat array (not { all_items: [...] })
        allResources = Array.isArray(data) ? data : (data.all_items || []);

        updateTabCounts();
        applyFilters();
    } catch (error) {
        console.error('Error loading resources:', error);
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

    resetPagination();
    applyFilters();
}


// ──────────────────────────────────────────────
//  Filtering Pipeline
//  Category (single) → Value Types (OR multi) → Search text
// ──────────────────────────────────────────────
function applyFilters() {
    loadingState.style.display = 'block';
    resourcesTable.style.display = 'none';
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

        // 3. Text search (matches resource name OR description)
        if (searchTerm) {
            results = results.filter(item =>
                item.resource.toLowerCase().includes(searchTerm) ||
                item.description.toLowerCase().includes(searchTerm) ||
                item.value.toLowerCase().includes(searchTerm)
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
        resourcesTable.style.display = 'table';
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
    tableBody.innerHTML = '';

    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredResources.slice(start, end);

    pageItems.forEach((resource, index) => {
        const row = createTableRow(resource, index);
        tableBody.appendChild(row);
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
//  Table Row Creation
// ──────────────────────────────────────────────
function createTableRow(resource, index) {
    const row = document.createElement('tr');
    row.style.animation = `fadeIn 0.35s ease-in ${index * 0.03}s both`;

    // Col 1 — Resource name
    const nameCell = document.createElement('td');
    nameCell.textContent = resource.resource;
    // Add "changed" badge if status is changed
    if (resource.status === 'changed') {
        const badge = document.createElement('span');
        badge.className = 'status-badge changed';
        badge.textContent = 'Updated';
        badge.title = 'This offer has been recently updated';
        nameCell.appendChild(badge);
    }
    row.appendChild(nameCell);

    // Col 2 — Value
    const valueCell = document.createElement('td');
    valueCell.textContent = resource.value;
    row.appendChild(valueCell);

    // Col 3 — Description
    const descCell = document.createElement('td');
    descCell.textContent = resource.description;
    row.appendChild(descCell);

    // Col 4 — Apply link
    const actionCell = document.createElement('td');
    const link = document.createElement('a');
    link.href = resource.link || '#';
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = 'apply-link';
    link.setAttribute('aria-label', `Apply for ${resource.resource}`);
    link.textContent = 'Apply Now';
    actionCell.appendChild(link);
    row.appendChild(actionCell);

    return row;
}


// ──────────────────────────────────────────────
//  Empty / Error States
// ──────────────────────────────────────────────
function showNoResults() {
    loadingState.style.display = 'none';
    resourcesTable.style.display = 'none';
    noResults.style.display = 'block';

    // Hide pagination
    const paginationBar = document.querySelector('.pagination-bar');
    if (paginationBar) paginationBar.style.display = 'none';
}

function showError() {
    loadingState.innerHTML = '<p style="color: #d73634;">Failed to load resources. Please try again later.</p>';
}


// ──────────────────────────────────────────────
//  Export for external use
// ──────────────────────────────────────────────
window.resourcesApp = {
    applyFilters,
    loadResources,
    switchToCategory
};
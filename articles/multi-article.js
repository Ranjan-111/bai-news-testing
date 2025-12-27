// --- CONFIGURATION ---
const itemsPerPage = 7;
let currentPage = 1;      // The actual page being viewed
let centerPage = 1;       // The pagination center number
let allArticles = [];     // The MASTER list (loaded from file)
let filteredArticles = []; // The LIST TO SHOW (filtered by search)
let totalPages = 0;

// --- MAIN APP LOGIC ---
function init() {
    // 1. Check Data
    if (typeof articleDatabase === 'undefined') {
        console.error("Error: articleDatabase not found. Check data.js linkage.");
        return;
    }

    // 2. Load Data
    allArticles = articleDatabase;
    filteredArticles = [...allArticles]; // Initially, filtered list is everything

    // 3. Initial Calculations
    recalculatePages();

    // 4. Setup Search & Filter Listeners (Connecting UI to Logic)
    setupFilterListeners();

    // 5. Render
    renderContent();
}

function recalculatePages() {
    totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
    if (totalPages === 0) totalPages = 1; // Prevent 0 pages error
}

// --- NEW: FILTERING LOGIC (With Event Delegation) ---
function setupFilterListeners() {
    // We listen to the entire DOCUMENT because #searchInput 
    // is injected dynamically by layout.js and doesn't exist yet 
    // when this script first runs.

    // 1. Search Input Listener
    document.addEventListener('input', (e) => {
        // Check if the event came from our search input
        if (e.target && e.target.id === 'searchInput') {
            applyFilters();
        }
    });

    // 2. Tag Checkbox Listener
    document.addEventListener('change', (e) => {
        // Check if the event came from our filter tags
        if (e.target && e.target.name === 'filter-tags') {
            applyFilters();
        }
    });
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // Get selected tags
    const checkedBoxes = document.querySelectorAll('input[name="filter-tags"]:checked');
    const selectedTags = Array.from(checkedBoxes).map(cb => cb.value.toLowerCase());

    // --- THE CORE FILTERING ---
    filteredArticles = allArticles.filter(article => {
        // 1. Check Text Match (Title or Summary)
        const textMatch = !searchTerm ||
            article.title.toLowerCase().includes(searchTerm) ||
            article.summary.toLowerCase().includes(searchTerm);

        // 2. Check Tag Match (If tags selected, article must have at least one)
        // Note: data-tags="tech india" usually comes as a string in your data object
        const articleTags = (article.tags || "").toLowerCase();
        const tagMatch = selectedTags.length === 0 ||
            selectedTags.some(tag => articleTags.includes(tag));

        return textMatch && tagMatch;
    });

    // --- RESET VIEW ---
    currentPage = 1; // Always go back to page 1 after a search
    centerPage = 1;
    recalculatePages();
    renderContent();
}

// --- RENDERING LOGIC ---
function renderContent() {
    const articlesContainer = document.getElementById('articles-list');
    const pagesContainer = document.getElementById('pages-container');

    if (!articlesContainer) return;

    // A. Slice the FILTERED list, not the master list
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const visibleArticles = filteredArticles.slice(start, end);

    // B. Generate HTML
    if (visibleArticles.length === 0) {
        articlesContainer.innerHTML = `
            <div style="text-align:center; padding: 4rem 0;">
                <p style="color:#888; font-size:1.1rem;">No articles match your search.</p>
                <button onclick="clearSearch()" style="margin-top:1rem; padding:8px 16px; cursor:pointer; background:#eee; border:none; border-radius:4px;">Clear Filters</button>
            </div>`;
    } else {
        articlesContainer.innerHTML = visibleArticles.map((article, index) => `
            <a class="article-card" href="../main/index.html" data-tags="${article.tags}">
                        <h3 class="article-title">${article.title}</h3>
                        <p class="date">${article.date}</p>
                        <p class="article-summary">${article.summary}</p>
            </a>
            ${index < visibleArticles.length - 1 ? '<hr>' : ''} 
        `).join('');
    }

    // C. Update Pagination
    // If current page > total pages (e.g. after filtering), reset to 1
    if (currentPage > totalPages) currentPage = 1;

    // Only update centerPage if it's out of bounds
    if (centerPage > totalPages) centerPage = totalPages;
    if (centerPage < 1) centerPage = 1;

    if (pagesContainer) {
        // Hide pagination if no results
        pagesContainer.parentElement.style.visibility = (filteredArticles.length === 0) ? 'hidden' : 'visible';
        renderPaginationButtons(pagesContainer);
    }
}

// Helper to reset everything (optional, used in the "No Results" button)
window.clearSearch = function() {
    const searchInput = document.getElementById('searchInput');
    const checkboxes = document.querySelectorAll('input[name="filter-tags"]');

    if(searchInput) searchInput.value = "";
    checkboxes.forEach(cb => cb.checked = false);

    applyFilters();
};

function renderPaginationButtons(container) {
    container.innerHTML = '';

    if (totalPages <= 1) return; // Don't show buttons if only 1 page

    const createBtn = (text, type, onClick) => {
        const btn = document.createElement(type === 'placeholder' ? 'div' : 'button');
        btn.className = `page-circle ${type}`;
        if (type !== 'placeholder') {
            btn.textContent = text;
            btn.onclick = onClick;
        }
        container.appendChild(btn);
    };

    // 1. LEFT SLOT
    const prevNum = centerPage - 1;
    if (prevNum >= 1) {
        const style = (prevNum === currentPage) ? 'active' : 'inactive';
        createBtn(prevNum, style, () => setPage(prevNum));
    } else {
        createBtn('', 'placeholder', null);
    }

    // 2. MIDDLE SLOT
    const midStyle = (centerPage === currentPage) ? 'active' : 'inactive';
    createBtn(centerPage, midStyle, () => setPage(centerPage));

    // 3. RIGHT SLOT
    const nextNum = centerPage + 1;
    if (nextNum <= totalPages) {
        const style = (nextNum === currentPage) ? 'active' : 'inactive';
        createBtn(nextNum, style, () => setPage(nextNum));
    } else {
        createBtn('', 'placeholder', null);
    }
}

function setPage(num) {
    if (num < 1 || num > totalPages) return;
    currentPage = num;
    renderContent();
    const mainArea = document.querySelector('.ma-main');
    if (mainArea) mainArea.scrollIntoView({ behavior: 'smooth' });
}

function changePage(direction) {
    const pagesContainer = document.getElementById('pages-container');

    if (direction === 'prev' && centerPage > 1) {
        centerPage--;
        renderPaginationButtons(pagesContainer);
    } else if (direction === 'next' && centerPage < totalPages) {
        centerPage++;
        renderPaginationButtons(pagesContainer);
    }
}

// Start
init();
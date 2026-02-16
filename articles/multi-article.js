import { fetchAllSearchData } from '/Article/firebase-db.js';

// CONFIGURATION
const itemsPerPage = 7;

// STATE VARIABLES
let allArticles = [];           // Holds the full list (from LocalStorage)
let filteredArticles = [];      // Holds the list after search/filter
let totalPages = 0;
let currentPage = 1;
let centerPage = 1;
let currentSearchQuery = "";    // For highlighting

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load Data (From LocalStorage/Cache)
    await initPageData();

    // 2. Setup Listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearchInput(e.target.value);
        });
    }

    const filterCheckboxes = document.querySelectorAll('input[name="filter-tags"]');
    filterCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => handleSearchInput());
    });
});

// A. INIT DATA
async function initPageData() {
    const skeletonView = document.getElementById('skeleton-view');
    const realView = document.getElementById('articles-list');
    
    // Ensure Skeleton is ON and Real View is OFF initially
    if (skeletonView) skeletonView.classList.remove('hidden');
    if (realView) realView.classList.add('hidden');

    try {
        // Fetch from LocalStorage (0 Reads usually)
        allArticles = await fetchAllSearchData(true);
        
        // 2. Explicitly filter for 'active' articles only
        filteredArticles = allArticles.filter(a => a.status === 'active');
        
        setupPagination();
        
        // LOAD DATA
        loadPage(1);

        // --- SWAP VIEWS ---
        // Hide Skeleton, Show Real Content with Fade In
        if (skeletonView) skeletonView.classList.add('hidden');
        if (realView) {
            realView.classList.remove('hidden');
            realView.classList.add('fade-in');
        }

    } catch (e) {
        console.error("Error loading feed:", e);
        // On error, hide skeleton and show error message
        if (skeletonView) skeletonView.classList.add('hidden');
        if (realView) {
            realView.classList.remove('hidden');
            realView.innerHTML = "<p style='text-align:center;'>Error loading articles. Please refresh.</p>";
        }
    }
}

// B. SEARCH & FILTER LOGIC
function handleSearchInput(queryOverride = null) {
    const searchInput = document.getElementById('searchInput');
    const rawQuery = (queryOverride !== null) ? queryOverride : (searchInput ? searchInput.value : "");
    const query = rawQuery.toLowerCase().trim();
    currentSearchQuery = query; // For Highlighting

    const activeTags = Array.from(document.querySelectorAll('input[name="filter-tags"]:checked'))
                            .map(cb => cb.value.toLowerCase());

    // Filter the master list
    filteredArticles = allArticles.filter(article => {
        const matchesText = !query || 
                            article.searchTitle.includes(query) || 
                            article.searchSummary.includes(query);
        const matchesTags = activeTags.length === 0 || 
                            activeTags.some(tag => article.searchTags.includes(tag));
        return matchesText && matchesTags;
    });

    // Reset to Page 1 of results
    currentPage = 1;
    centerPage = 1;
    setupPagination();
    loadPage(1);
}

// C. PAGINATION LOGIC
function setupPagination() {
    totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
    if (totalPages === 0) totalPages = 1;
    
    // Ensure UI is visible
    const pageContainer = document.getElementById('pages-container');
    if (pageContainer) pageContainer.style.display = 'flex';
    document.querySelectorAll('.arrow-btn').forEach(b => b.style.display = 'inline-block');

    renderPaginationButtons();
}

function loadPage(pageNumber) {
    const start = (pageNumber - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const visibleArticles = filteredArticles.slice(start, end);

    renderArticlesToScreen(visibleArticles);
    
    currentPage = pageNumber;
    renderPaginationButtons();
}

// D. RENDERER (With Date Fix & Highlight)
function renderArticlesToScreen(articles) {
    const container = document.getElementById('articles-list');
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 4rem 0;"><p>No articles match your criteria.</p></div>`;
        return;
    }

    articles.forEach(article => {
        // Date Fix
        let dateStr = "";
        if (article.datePosted) {
            let dateObj = null;
            // Handle Firestore Timestamp vs String vs Object
            if (article.datePosted.seconds) {
                dateObj = new Date(article.datePosted.seconds * 1000);
            } else if (typeof article.datePosted.toDate === 'function') {
                dateObj = article.datePosted.toDate();
            } else {
                dateObj = new Date(article.datePosted);
            }
            dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        // Highlight
        const displayTitle = highlightText(article.title, currentSearchQuery);
        const displaySummary = highlightText(article.summary, currentSearchQuery);

        const html = `
            <a class="article-card" href="article.html?id=${article.id}">
                <h3 class="article-title">${displayTitle}</h3>
                <p class="date">${dateStr}</p>
                <p class="article-summary">${displaySummary}</p>
            </a>
            <hr>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });

    // Scroll Top
    const mainArea = document.querySelector('.ma-main');
    if (mainArea) mainArea.scrollIntoView({ behavior: 'smooth' });
}

// Highlight Helper
function highlightText(text, query) {
    if (!query || !text) return text || "";
    const safeText = text.replace(/(<([^>]+)>)/gi, ""); // Strip HTML
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    return safeText.replace(regex, '<span class="highlight-red">$1</span>');
}

// E. BUTTONS UI
function renderPaginationButtons() {
    const container = document.getElementById('pages-container');
    if (!container) return;
    container.innerHTML = '';

    const createBtn = (text, type, onClick) => {
        const btn = document.createElement(type === 'placeholder' ? 'div' : 'button');
        btn.className = `page-circle ${type}`;
        if (type !== 'placeholder') { btn.textContent = text; btn.onclick = onClick; }
        if (type === 'placeholder') { btn.style.width = "3.5rem"; btn.style.visibility = "hidden"; }
        container.appendChild(btn);
    };

    const prevNum = centerPage - 1;
    if (prevNum >= 1) createBtn(prevNum, (prevNum === currentPage) ? 'active' : 'inactive', () => goToPage(prevNum));
    else createBtn('', 'placeholder', null);

    createBtn(centerPage, (centerPage === currentPage) ? 'active' : 'inactive', () => goToPage(centerPage));

    const nextNum = centerPage + 1;
    if (nextNum <= totalPages) createBtn(nextNum, (nextNum === currentPage) ? 'active' : 'inactive', () => goToPage(nextNum));
    else createBtn('', 'placeholder', null);
}

function goToPage(num) {
    centerPage = num; // Set the clicked number as the new center
    loadPage(num);
}

window.changePage = function(direction) {
    if (direction === 'prev' && centerPage > 1) { centerPage--; renderPaginationButtons(); }
    else if (direction === 'next' && centerPage < totalPages) { centerPage++; renderPaginationButtons(); }
};


// --- KEYBOARD SHORTCUTS FOR PAGINATION ---
document.addEventListener('keydown', (e) => {
    // 1. Identify if the user is typing in the search bar or any other input
    const isTyping = e.target.tagName === 'INPUT' || 
                     e.target.tagName === 'TEXTAREA' || 
                     e.target.isContentEditable;

    // 2. If they ARE typing, don't trigger the pagination
    if (isTyping) return;

    // 3. Handle Arrow Keys
    if (e.key === 'ArrowRight') {
        // Only go next if we aren't at the last page
        if (currentPage < totalPages) {
            // Using your existing centerPage logic to keep UI in sync
            centerPage = Math.min(totalPages, currentPage + 1);
            loadPage(currentPage + 1);
        }
    } 
    else if (e.key === 'ArrowLeft') {
        // Only go back if we aren't on page 1
        if (currentPage > 1) {
            centerPage = Math.max(1, currentPage - 1);
            loadPage(currentPage - 1);
        }
    }
});
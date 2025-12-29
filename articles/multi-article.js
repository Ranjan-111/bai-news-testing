import { getArticlesBySerial, getTotalArticleCount, fetchAllSearchData } from '../Article/firebase-db.js';

// CONFIGURATION
const itemsPerPage = 7;

// STATE VARIABLES
let isSearchMode = false;
let totalArticles = 0;
let totalPages = 0;
let currentPage = 1;
let centerPage = 1;

// SEARCH SPECIFIC STATE
let allSearchMatches = [];
let currentSearchQuery = ""; // <--- NEW: Remembers what you typed for highlighting

// ======================================================
// 1. INITIALIZATION
// ======================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initNormalMode();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            triggerSearch(e.target.value);
        });
    }

    const filterCheckboxes = document.querySelectorAll('input[name="filter-tags"]');
    filterCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => triggerSearch());
    });
});

window.handlePageSearch = function(queryText) {
    triggerSearch(queryText);
}

function triggerSearch(queryOverride = null) {
    const searchInput = document.getElementById('searchInput');
    const query = (queryOverride !== null) ? queryOverride : (searchInput ? searchInput.value : "");
    const activeTags = Array.from(document.querySelectorAll('input[name="filter-tags"]:checked')).map(cb => cb.value.toLowerCase());

    const cleanQuery = query.toLowerCase().trim();

    if (cleanQuery === "" && activeTags.length === 0) {
        if (isSearchMode) initNormalMode();
        return;
    }

    performClientSearch(cleanQuery, activeTags);
}


// ======================================================
// 2. NORMAL MODE (Server Side)
// ======================================================
async function initNormalMode() {
    isSearchMode = false;
    currentSearchQuery = ""; // Clear highlighting query
    const container = document.getElementById('articles-list');
    
    if (totalArticles === 0) {
        try {
            totalArticles = await getTotalArticleCount(); 
        } catch (e) {
            console.error("Init Error:", e);
            container.innerHTML = "<p>Error loading data.</p>";
            return;
        }
    }

    totalPages = Math.ceil(totalArticles / itemsPerPage);
    if (totalPages === 0) totalPages = 1;

    currentPage = 1;
    centerPage = 1;
    
    const pageContainer = document.getElementById('pages-container');
    if (pageContainer) pageContainer.style.display = 'flex';
    document.querySelectorAll('.arrow-btn').forEach(b => b.style.display = 'inline-block');
    
    renderPaginationButtons();
    loadNormalPage(1);
}

async function loadNormalPage(pageNumber) {
    const container = document.getElementById('articles-list');
    container.innerHTML = '<p style="text-align:center; padding:2rem;">Loading...</p>';

    const startSerial = totalArticles - (itemsPerPage * (pageNumber - 1));

    try {
        const articles = await getArticlesBySerial(startSerial);
        renderArticlesToScreen(articles); // Normal mode (no highlight)
        currentPage = pageNumber;
        renderPaginationButtons();
    } catch (e) { console.error(e); }
}


// ======================================================
// 3. SEARCH MODE (Client Side)
// ======================================================
async function performClientSearch(query, tags) {
    isSearchMode = true;
    currentSearchQuery = query; // Save query for highlighting
    const container = document.getElementById('articles-list');
    
    if (container.innerHTML === "") {
        container.innerHTML = '<p style="text-align:center; padding:2rem;">Searching...</p>';
    }

    try {
        let database = window.cachedSearchData;
        if (!database) database = await fetchAllSearchData();

        allSearchMatches = database.filter(article => {
            const matchesText = !query || 
                                article.searchTitle.includes(query) || 
                                article.searchSummary.includes(query);
            const matchesTags = tags.length === 0 || 
                                tags.some(tag => article.searchTags.includes(tag));
            return matchesText && matchesTags;
        });

        totalPages = Math.ceil(allSearchMatches.length / itemsPerPage);
        if (totalPages === 0) totalPages = 1;

        currentPage = 1;
        centerPage = 1;

        loadSearchPage(1);

        const pageContainer = document.getElementById('pages-container');
        if (pageContainer) pageContainer.style.display = 'flex';
        document.querySelectorAll('.arrow-btn').forEach(b => b.style.display = 'inline-block');
        renderPaginationButtons();

    } catch (e) { console.error(e); }
}

function loadSearchPage(pageNumber) {
    const start = (pageNumber - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const visibleArticles = allSearchMatches.slice(start, end);

    renderArticlesToScreen(visibleArticles); // Pass list to renderer
    
    currentPage = pageNumber;
    renderPaginationButtons();
}


// ======================================================
// 4. SHARED RENDERER & UI (Updated with Highlight)
// ======================================================
function renderArticlesToScreen(articles) {
    const container = document.getElementById('articles-list');
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 4rem 0;"><p>No articles match your search.</p></div>`;
        return;
    }

    articles.forEach(article => {
        // Date
        let dateStr = "";
        if (article.datePosted) {
            let dateObj = typeof article.datePosted.toDate === 'function' ? article.datePosted.toDate() : new Date(article.datePosted);
            dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        // Highlight Title & Summary if searching
        // We use the global currentSearchQuery variable
        const displayTitle = isSearchMode ? highlightText(article.title, currentSearchQuery) : article.title;
        const displaySummary = isSearchMode ? highlightText(article.summary, currentSearchQuery) : article.summary;

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

    const mainArea = document.querySelector('.ma-main');
    if (mainArea) mainArea.scrollIntoView({ behavior: 'smooth' });
}

// --- HELPER: HIGHLIGHT TEXT ---
function highlightText(text, query) {
    if (!query || !text) return text || "";
    // Remove HTML tags to prevent breaking layout
    const safeText = text.replace(/(<([^>]+)>)/gi, "");
    
    // Regex Logic
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    return safeText.replace(regex, '<span class="highlight-red">$1</span>');
}

// ======================================================
// 5. PAGINATION BUTTONS
// ======================================================
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
    if (prevNum >= 1) {
        createBtn(prevNum, (prevNum === currentPage) ? 'active' : 'inactive', () => goToPage(prevNum));
    } else {
        createBtn('', 'placeholder', null);
    }

    createBtn(centerPage, (centerPage === currentPage) ? 'active' : 'inactive', () => goToPage(centerPage));

    const nextNum = centerPage + 1;
    if (nextNum <= totalPages) {
        createBtn(nextNum, (nextNum === currentPage) ? 'active' : 'inactive', () => goToPage(nextNum));
    } else {
        createBtn('', 'placeholder', null);
    }
}

function goToPage(num) {
    if (isSearchMode) loadSearchPage(num);
    else loadNormalPage(num);
}

window.changePage = function(direction) {
    if (direction === 'prev' && centerPage > 1) {
        centerPage--;
        renderPaginationButtons();
    } else if (direction === 'next' && centerPage < totalPages) {
        centerPage++;
        renderPaginationButtons();
    }
};
// --- CONFIGURATION ---
const itemsPerPage = 8;
let currentPage = 1;      // The actual page of articles being viewed
let centerPage = 1;       // The page number currently shown in the center button
let allArticles = [];
let totalPages = 0;

// --- MAIN APP LOGIC ---
function init() {
    // 1. Check if the data file loaded correctly
    if (typeof articleDatabase === 'undefined') {
        console.error("Error: articleDatabase not found. Make sure data.js is linked BEFORE app.js in your HTML.");
        return;
    }

    // 2. Load data from the external data.js file
    allArticles = articleDatabase;

    // 3. Calculate pages
    totalPages = Math.ceil(allArticles.length / itemsPerPage);

    // 4. Render
    renderContent();
}

function renderContent() {
    const articlesContainer = document.getElementById('articles-list');
    const pagesContainer = document.getElementById('pages-container');

    if (!articlesContainer) return;

    // A. Filter articles for current page
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const visibleArticles = allArticles.slice(start, end);

    // B. Generate HTML
    if (visibleArticles.length === 0) {
        articlesContainer.innerHTML = '<p style="text-align:center; color:#888;">No articles found.</p>';
    } else {
        articlesContainer.innerHTML = visibleArticles.map((article, index) => `
            <a class="article-card" href="../docs/index.html" data-tags="${article.tags}">
                <h3 class="article-title">${article.title}</h3>
                <p class="date">${article.date}</p>
                <p class="article-summary">${article.summary}</p>
            </a>
            ${index < visibleArticles.length - 1 ? '<hr>' : ''} 
        `).join('');
    }

    // C. Update Pagination Buttons
    // When content changes, we usually want to re-center the buttons on the new page
    // (Optional: You can remove this line if you want the numbers to stay still when content changes)
    centerPage = currentPage; 
    
    if (pagesContainer && totalPages > 0) {
        renderPaginationButtons(pagesContainer);
    }
}

function renderPaginationButtons(container) {
    container.innerHTML = '';

    const createBtn = (text, type, onClick) => {
        const btn = document.createElement(type === 'placeholder' ? 'div' : 'button');
        btn.className = `page-circle ${type}`;
        if (type !== 'placeholder') {
            btn.textContent = text;
            btn.onclick = onClick;
        }
        container.appendChild(btn);
    };

    // --- LOGIC: Show 3 buttons centered around "centerPage" ---
    
    // 1. LEFT SLOT (centerPage - 1)
    const prevNum = centerPage - 1;
    if (prevNum >= 1) {
        // If this number happens to be the active content page, make it RED (active)
        const style = (prevNum === currentPage) ? 'active' : 'inactive';
        createBtn(prevNum, style, () => setPage(prevNum));
    } else {
        createBtn('', 'placeholder', null);
    }

    // 2. MIDDLE SLOT (centerPage)
    const midStyle = (centerPage === currentPage) ? 'active' : 'inactive';
    createBtn(centerPage, midStyle, () => setPage(centerPage));

    // 3. RIGHT SLOT (centerPage + 1)
    const nextNum = centerPage + 1;
    if (nextNum <= totalPages) {
        const style = (nextNum === currentPage) ? 'active' : 'inactive';
        createBtn(nextNum, style, () => setPage(nextNum));
    } else {
        createBtn('', 'placeholder', null);
    }
}

// Function called when clicking a NUMBER bubble
// This updates the content.
function setPage(num) {
    if (num < 1 || num > totalPages) return;
    currentPage = num;
    renderContent();
    const mainArea = document.querySelector('.ma-main');
    if (mainArea) mainArea.scrollIntoView({ behavior: 'smooth' });
}

// Function called when clicking ARROWS
// This only updates the numbers shown (slides them).
function changePage(direction) {
    const pagesContainer = document.getElementById('pages-container');

    if (direction === 'prev' && centerPage > 1) {
        centerPage--; // Slide numbers Left
        renderPaginationButtons(pagesContainer);
    } else if (direction === 'next' && centerPage < totalPages) {
        centerPage++; // Slide numbers Right
        renderPaginationButtons(pagesContainer);
    }
}

// Start
init();
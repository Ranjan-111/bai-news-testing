import { getFirestore, doc, getDoc, getDocs, collection, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from '/Article/firebase-db.js';

const db = getFirestore(app);
const auth = getAuth(app);

// ==========================================
// PAGINATION STATE
// ==========================================
const ITEMS_PER_PAGE = 5;
let allSavedArticles = []; // Full flat list fetched once
let totalPages = 0;
let currentPage = 1;
let centerPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const nameEl = document.getElementById('user-name-display');
            if (nameEl) nameEl.textContent = user.displayName || "Reader";
            await loadUserProfileData(user);
        } else {
            window.location.href = "/";
        }
    });
});

// ==========================================
// 1. LOAD ALL SAVED ARTICLES ONCE
// ==========================================
async function loadUserProfileData(user) {
    const container = document.getElementById('saved-articles-list');

    try {
        const q = query(
            collection(db, "savedArticles"),
            where("userId", "==", user.uid),
            orderBy("savedAt", "desc")
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<div class="empty-state"><h3>No saved articles</h3><p>Bookmark articles to read them later.</p></div>`;
            return;
        }

        // Build the full in-memory list
        allSavedArticles = snapshot.docs.map(doc => doc.data());

        // Setup pagination and render page 1
        setupPagination();
        loadPage(1);

    } catch (error) {
        console.error("Error fetching saved articles:", error);
        container.innerHTML = `<div class="empty-state"><h3>Error loading</h3><p>Could not load saved articles at this time.</p></div>`;
    }
}

// ==========================================
// 2. PAGINATION LOGIC (matches multi-article)
// ==========================================
function setupPagination() {
    totalPages = Math.ceil(allSavedArticles.length / ITEMS_PER_PAGE);
    if (totalPages <= 0) totalPages = 1;

    const paginationContainer = document.getElementById('pagination-container');
    if (paginationContainer) {
        paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
    }

    renderPaginationButtons();
}

function loadPage(pageNumber) {
    const start = (pageNumber - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const visibleArticles = allSavedArticles.slice(start, end);

    renderArticles(visibleArticles);

    currentPage = pageNumber;
    renderPaginationButtons();

    // Scroll to top of saved articles
    const container = document.getElementById('saved-articles-list');
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPaginationButtons() {
    const container = document.getElementById('saved-pages-container');
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
    centerPage = num;
    loadPage(num);
}

window.changeSavedPage = function (direction) {
    // Arrows only shift the visible number buttons (like multi-article)
    if (direction === 'prev' && centerPage > 1) { centerPage--; renderPaginationButtons(); }
    else if (direction === 'next' && centerPage < totalPages) { centerPage++; renderPaginationButtons(); }
};

// ==========================================
// 3. ARTICLE RENDERER
// ==========================================
function renderArticles(articles) {
    const container = document.getElementById('saved-articles-list');
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No saved articles</h3><p>Bookmark articles to read them later.</p></div>`;
        return;
    }

    articles.forEach((article, index) => {
        const isLast = index === articles.length - 1;
        const html = `
            <a href="/article?id=${article.articleId}" class="article-card">
                <h3 class="article-title">${article.title || "Untitled Article"}</h3>
                <p class="date">${formatDate(article.datePosted)}</p>
                <p class="article-summary">${article.summary || ""}</p>
            </a>
            ${isLast ? '' : '<hr>'}
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// ==========================================
// 4. DATE HELPER
// ==========================================
function formatDate(timestamp) {
    if (!timestamp) return "";
    let date;
    if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
import { initPopupLogic } from './auth.js';
import { fetchAllSearchData } from '../Article/firebase-db.js';
import { saveToNewsletterList } from '../admin/user-db.js';

// ==========================================
//  SHARE ICON LOGIC (Safeguarded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // We verify the element exists BEFORE trying to use it
    const shareLink = document.querySelector('a:has(.s-icon1)');
    const shareIcon = shareLink ? shareLink.querySelector('.s-icon1') : null;

    if (shareLink && shareIcon) {
        const unfilledIconPath = "../assets/share icon unfilled.png";
        const filledIconPath = "../assets/share icon filled.png";

        shareLink.addEventListener('click', function (event) {
            event.preventDefault();
            if (shareIcon.src.includes("unfilled")) {
                shareIcon.src = filledIconPath;
            } else {
                shareIcon.src = unfilledIconPath;
            }
        });

        document.addEventListener('click', function (event) {
            if (!shareLink.contains(event.target)) {
                if (shareIcon.src.includes("filled")) {
                    shareIcon.src = unfilledIconPath;
                }
            }
        });
    }
});



// ==========================================
//  SHARE FUNCTIONALITY (Safeguarded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const shareIconEl = document.querySelector('.s-icon1');
    // SAFETY CHECK: Only run if icon exists

    if (shareIconEl) {
        const shareBtnParent = shareIconEl.parentElement;
        shareBtnParent.addEventListener('click', async (e) => {
            e.preventDefault();
            const articleTitle = document.querySelector('#news-headline')?.textContent || document.title;
            const articleUrl = window.location.href;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: articleTitle,
                        text: `${articleTitle}\n\nRead more here:`,
                        url: articleUrl
                    });
                } catch (error) {
                    if (error.name !== 'AbortError') console.error('Error sharing:', error);
                }
            } else {
                alert('Share not supported');
            }
        });
    }
});












// ==========================================
// 1. MASTER LAYOUT LOADER (Executes First)
// ==========================================
async function loadLayout() {
    try {
        const response = await fetch('../layout/layout.html');
        if (!response.ok) throw new Error('Could not load layout.html');

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // A. Inject Header
        const headerContent = doc.getElementById('source-header').innerHTML;
        document.getElementById('global-header').innerHTML = headerContent;

        // B. Inject Footer
        const footerContent = doc.getElementById('source-footer').innerHTML;
        document.getElementById('global-footer').innerHTML = footerContent;

        // C. Inject Popup (Append to bottom)
        const popupContent = doc.getElementById('source-popup').innerHTML;
        document.body.insertAdjacentHTML('beforeend', popupContent);

        // D. INJECT SEARCH WRAPPER (New!)
        const searchContent = doc.getElementById('source-search').innerHTML;
        document.body.insertAdjacentHTML('beforeend', searchContent);

        // E. START LOGIC (Now that all elements exist)
        initGlobalLogic();

    } catch (error) {
        console.error('Error loading layout:', error);
    }
}

// ==========================================
// 2. GLOBAL INIT (The Coordinator)
// ==========================================
function initGlobalLogic() {
    // 1. Initialize Popup
    initPopupLogic();

    // 2. Initialize Search (We call the new function here!)
    initSearchLogic();

    // 3. Initialize Responsive Profile Image (ADD THIS LINE)
    initResponsiveProfile();

    initFooterNewsletter();

    // 3. Highlight Sidebar Link
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';
    const menuLinks = document.querySelectorAll('.menu-item');
    menuLinks.forEach(link => {
        if (link.getAttribute('href').split('/').pop() === currentPage) {
            link.classList.add('active-page');
        }
    });

    // 4. Hamburger Menu Logic
    const btn = document.querySelector('.menu__icon');
    if (btn) {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
    }
}

// ==========================================
// 3. SEARCH LOGIC (Unified: Client-Side)
// ==========================================
export function initSearchLogic() {
    // --- Selectors ---
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchPopupContainer = document.getElementById('search-popup-container');
    const filterOptionsContainer = document.getElementById('filter-options-container');
    const searchInput = document.getElementById('searchInput');
    const resultsBox = document.getElementById('search-results-box');
    const filterCheckboxes = document.querySelectorAll('input[name="filter-tags"]');

    // Safety Exit
    if (!searchToggleBtn || !searchInput || !resultsBox) return;

    // --- State Variables ---
    let clickCount = 0;
    let hasTyped = false;

    // --- A. TOGGLE BUTTON VISUALS ---
    const imgSearch = searchToggleBtn.querySelector('.search-icon');
    const imgFilterEmpty = searchToggleBtn.querySelector('.filter-icon1');
    const imgFilterFilled = searchToggleBtn.querySelector('.filter-icon2');

    function updateImages(showImage) {
        if (imgSearch) imgSearch.style.display = 'none';
        if (imgFilterEmpty) imgFilterEmpty.style.display = 'none';
        if (imgFilterFilled) imgFilterFilled.style.display = 'none';

        if (showImage === 1 && imgSearch) imgSearch.style.display = 'block';
        if (showImage === 2 && imgFilterEmpty) imgFilterEmpty.style.display = 'block';
        if (showImage === 3 && imgFilterFilled) imgFilterFilled.style.display = 'block';
    }
    updateImages(1); // Default

    // --- B. TOGGLE CLICK HANDLER (UPDATED) ---
    searchToggleBtn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        clickCount++;

        if (clickCount === 1) { // Open Search
            searchWrapper.classList.add('active');
            searchPopupContainer.classList.add('active');
            filterOptionsContainer.classList.remove('visible');
            searchInput.focus();
            updateImages(2);

            // PRE-FETCH DATA NOW (So it's ready when they type)
            if (!window.cachedSearchData) {
                resultsBox.innerHTML = '<p style="padding:10px; color:#888;">Loading Search Index...</p>';
                await fetchAllSearchData();
                resultsBox.innerHTML = ''; // Clear loading message
            }

        } else { // Toggle Filter
            if (clickCount % 2 === 0) {
                filterOptionsContainer.classList.add('visible');
                updateImages(3);
            } else {
                filterOptionsContainer.classList.remove('visible');
                updateImages(2);
            }
        }
    });

    // --- C. CLOSE ON CLICK OUTSIDE ---
    document.addEventListener('click', (e) => {
        if (!searchWrapper || !searchWrapper.classList.contains('active')) return;

        if (!searchWrapper.contains(e.target)) {
            closeSearch();
        } else if (!filterOptionsContainer.contains(e.target) && e.target !== searchToggleBtn && !resultsBox.contains(e.target)) {
            if (filterOptionsContainer.classList.contains('visible')) {
                filterOptionsContainer.classList.remove('visible');
                clickCount = 1;
                updateImages(2);
            }
        }
    });

    function closeSearch() {
        searchWrapper.classList.remove('active');
        searchPopupContainer.classList.remove('active');
        filterOptionsContainer.classList.remove('visible');
        resultsBox.classList.remove('active');
        clickCount = 0;
        hasTyped = false;
        updateImages(1);
    }

    // --- D. REAL-TIME SEARCH LOGIC (CLIENT SIDE) ---
    async function performSearch() {
        // If on multi-article page, do nothing (let that script handle it)
        if (window.location.pathname.includes('multi-article')) {
            resultsBox.classList.remove('active');
            return;
        }

        const query = searchInput.value.toLowerCase().trim();
        hasTyped = true;

        const selectedTags = Array.from(filterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value.toLowerCase());

        if (query.length === 0 && selectedTags.length === 0) {
            resultsBox.classList.remove('active');
            resultsBox.innerHTML = "";
            return;
        }

        // Get Data
        let database = window.cachedSearchData;
        if (!database) {
            database = await fetchAllSearchData();
        }

        // Filter Data
        const filteredData = database.filter(article => {
            const matchesText = !query ||
                article.searchTitle.includes(query) ||
                article.searchSummary.includes(query);

            const matchesTags = selectedTags.length === 0 ||
                selectedTags.some(tag => article.searchTags.includes(tag));

            return matchesText && matchesTags;
        });

        displaySearchResults(filteredData, query);
    }

    // Attach Listeners
    searchInput.addEventListener('input', performSearch);
    filterCheckboxes.forEach(cb => cb.addEventListener('change', performSearch));


    // --- E. DISPLAY LOGIC (With Highlighting) ---
    function displaySearchResults(data, query) {

        if (data.length === 0) {
            resultsBox.innerHTML = `<div class="search-scroll-view"><div style="text-align:center; color:#888; padding:10px;">No matching results.</div></div>`;
            resultsBox.classList.add('active');
            return;
        }

        resultsBox.innerHTML = '';
        const viewClass = data.length < 5 ? "search-scroll-view few-results" : "search-scroll-view";

        const scrollView = document.createElement('div');
        scrollView.className = viewClass;
        resultsBox.appendChild(scrollView);
        resultsBox.classList.add('active');

        // Render Items
        const html = data.map(article => {
            // 1. Date Logic
            let dateStr = "";
            if (article.datePosted) {
                let dateObj = typeof article.datePosted.toDate === 'function' ? article.datePosted.toDate() : new Date(article.datePosted);
                dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }

            // 2. Highlight Logic (Title & Summary)
            const hlTitle = highlightText(article.title, query);
            const hlSummary = highlightText(article.summary, query);

            return `
            <a href="../articles/article.html?id=${article.id}" class="result-card">
                <h4 style="font-family: 'Inter', sans-serif;">${hlTitle}</h4>
                <p style="font-family: sans-serif; font-weight: 300">${hlSummary}</p>
                <span class="result-date">${dateStr}</span>
            </a>
            `;
        }).join('');

        scrollView.innerHTML = html;

        // Fade Logic
        if (data.length >= 5) {
            scrollView.addEventListener('scroll', function () {
                if (hasTyped && this.scrollTop > 0) {
                    const fadeDistance = 60;
                    let alpha = 1 - Math.min(this.scrollTop / fadeDistance, 1);
                    const mask = `linear-gradient(to bottom, rgba(0,0,0,${alpha}) 0%, black 10%, black 100%)`;
                    this.style.maskImage = mask;
                    this.style.webkitMaskImage = mask;
                } else {
                    this.style.maskImage = "none";
                    this.style.webkitMaskImage = "none";
                }
            });
        }
    }

    // --- HELPER: HIGHLIGHT TEXT ---
    function highlightText(text, query) {
        if (!query || !text) return text || "";
        // Clean the text of HTML tags first (optional safety)
        const safeText = text.replace(/(<([^>]+)>)/gi, "");

        // Escape special regex characters in query
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Create Regex (Case Insensitive)
        const regex = new RegExp(`(${safeQuery})`, 'gi');

        // Wrap match in span
        return safeText.replace(regex, '<span class="highlight-red">$1</span>');
    }
}

// ==========================================
// 5. RESPONSIVE PROFILE IMAGE
// ==========================================
function initResponsiveProfile() {
    const myImg = document.getElementById('responsiveImg');

    // REPLACE with your actual image paths
    const desktopImg = "../assets/profile Image.png";
    const mobileImg = "../assets/Customer Icon Windows 10.png"; // Make sure you have this file!

    function updateImageSource() {
        if (!myImg) return; // Safety check if element is missing

        // Check viewport width (550px breakpoint)
        if (window.innerWidth <= 550) {
            // Mobile: Only change if not already set (prevents flickering)
            if (!myImg.src.includes("Customer Icon Windows 10")) {
                myImg.src = mobileImg;
            }
        } else {
            // Desktop: Only change if not already set
            if (!myImg.src.includes("profile Image")) {
                myImg.src = desktopImg;
            }
        }
    }

    // 1. Run immediately
    updateImageSource();

    // 2. Listen for resize (in case user rotates phone or resizes browser)
    window.addEventListener('resize', updateImageSource);
}

// ==========================================
// FOOTER NEWSLETTER LOGIC
// ==========================================
function initFooterNewsletter() {
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('footer button');
        if (btn) {
            e.preventDefault();
            const input = document.querySelector('footer input[type="email"]');
            
            if (input && input.value.includes('@')) {
                const originalText = btn.innerText;
                btn.innerText = "Saving...";
                await saveToNewsletterList(input.value);
                btn.innerText = originalText;
                input.value = "";
            } else {
                alert("Please enter a valid email");
            }
        }
    });
}

// ==========================================
// 4. EXECUTE ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', loadLayout);
// ==========================================
// FOLLOW BUTTON LOGIC
// ==========================================
function initFollowButton() {
    const followBtn = document.querySelector('.follow-btn');
    const authorNameEl = document.querySelector('.author-name');

    // Safety check: only run if button exists on this page
    if (!followBtn || !authorNameEl) return;

    const authorName = authorNameEl.textContent.trim();
    const storageKey = `isFollowing_${authorName}`; // Unique key: "isFollowing_Priyanshu"

    // 1. CHECK STATE ON LOAD (Zero Delay)
    if (localStorage.getItem(storageKey) === 'true') {
        setFollowedState();
    }

    // 2. HANDLE CLICK
    followBtn.addEventListener('click', () => {
        const isCurrentlyFollowing = followBtn.classList.contains('following');

        if (isCurrentlyFollowing) {
            // UNFOLLOW
            setUnfollowedState();
            localStorage.removeItem(storageKey);
        } else {
            // FOLLOW
            setFollowedState();
            localStorage.setItem(storageKey, 'true');
        }
    });

    // --- Helpers ---
    function setFollowedState() {
        followBtn.textContent = 'Following';
        followBtn.classList.add('following');
    }

    function setUnfollowedState() {
        followBtn.textContent = 'Follow';
        followBtn.classList.remove('following');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // ... your other init functions ...
    initFollowButton();
});


// ==========================================
// firebase LOGIC
// ==========================================

import { getArticleById, getLocalRelatedArticles } from '../Article/firebase-db.js';

// Fallback images
const AUTHOR_DEFAULTS = {
    "Priyanshu": "../assets/author-profile.jpeg",
    "Tiara": "../assets/img2.jpg",
    "Harsh": "../assets/img1.jpg" 
};

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) return;

    const article = await getArticleById(articleId);

    if (!article) {
        document.querySelector('.main').innerHTML = "<h1 style='text-align:center;'>Article not found.</h1>";
        return;
    }

    // --- A. RENDER TITLE ---
    const titleEl = document.getElementById('news-headline');
    if (titleEl) titleEl.innerText = article.title;

    // --- B. RENDER DATE ---
    const dateEl = document.getElementById('news-date'); 
    if (dateEl && article.datePosted) {
        let dateObj = typeof article.datePosted.toDate === 'function' 
            ? article.datePosted.toDate() 
            : new Date(article.datePosted);
        
        dateEl.innerText = dateObj.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    }

    // --- C. RENDER IMAGE ---
    const imgEl = document.getElementById('news-img');
    if (imgEl && article.imageUrl) imgEl.src = article.imageUrl;

    // --- D. RENDER CONTENT ---
    const contentEl = document.getElementById('article-content');
    if (contentEl && article.content) contentEl.innerHTML = article.content;

    // --- E. RENDER TAGS (THIS WAS MISSING) ---
    const tagsSection = document.querySelector('.tags');
    if (tagsSection) {
        if (article.tags && article.tags.length > 0) {
            tagsSection.innerHTML = ''; // Clear hardcoded dummy tags
            article.tags.forEach(tag => {
                const tagDiv = document.createElement('div');
                tagDiv.className = 'article-tags';
                tagDiv.innerHTML = `<a href="#">${tag}</a>`;
                tagsSection.appendChild(tagDiv);
            });
        } else {
            tagsSection.style.display = 'none'; // Hide if no tags
        }
    }

// --- F. AUTHOR SECTION (Final Email Strategy) ---
    // 1. Get Display Name (For the text)
    const authorName = article.authorName || article.authorId || "Editor"; 
    
    // 2. Get Link ID (Must be the Email to match your DB)
    // Fallback: Use your test email if the article has no email field yet
    const authorEmail = article.authorEmail || "priyanshuranjank@gmail.com"; 
    
    // 3. Image Fallback
    let authorPicUrl = article.authorImage || AUTHOR_DEFAULTS[authorName] || "../assets/default-user.png";

    // Select Elements
    const authorNameEl = document.querySelector('.author-name');
    const authorImgEl = document.querySelector('.author-avatar');
    const authorLinks = document.querySelectorAll('.author-profile a, .author-info a');

    // 4. Render Text & Image
    if (authorNameEl) authorNameEl.innerText = authorName;
    if (authorImgEl) { 
        authorImgEl.src = authorPicUrl; 
        authorImgEl.alt = authorName; 
    }

    // 5. UPDATE LINKS
    // We send the EMAIL in the URL: ?id=priyanshuranjank@gmail.com
    authorLinks.forEach(link => {
        link.href = `../profile pages/author.html?id=${encodeURIComponent(authorEmail)}`;
    });

    // --- G. LOAD RELATED ---
    if (article.tags && article.tags.length > 0) {
        loadRelated(article.tags, article.id);
    }
});

async function loadRelated(tags, currentId) {
    const container = document.getElementById('related-container');
    if (!container) return;

    const related = await getLocalRelatedArticles(tags, currentId);
    
    container.innerHTML = ''; 

    if (related.length === 0) {
        container.innerHTML = '<p style="padding:10px;">No related articles found.</p>';
        return;
    }

    related.forEach(item => {
        const html = `
            <div>
                <img src="${item.imageUrl || '../assets/default.png'}" alt="Related Image">
                <h3><a href="article.html?id=${item.id}">${item.title}</a></h3>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}
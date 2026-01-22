import { getArticleById, getLocalRelatedArticles, auth } from '/Article/firebase-db.js';

// Fallback images
const AUTHOR_DEFAULTS = {
    "Priyanshu": "/assets/author-profile.jpeg",
    "Tiara": "/assets/img2.jpg",
    "Harsh": "/assets/img1.jpg" 
};
// ==========================================
// FOLLOW BUTTON LOGIC
// ==========================================
function initFollowButton() {
    const followBtn = document.querySelector('.follow-btn');
    const authorNameEl = document.querySelector('.author-name');

    if (!followBtn || !authorNameEl) return;

    const authorName = authorNameEl.textContent.trim();
    const storageKey = `isFollowing_${authorName}`; 

    // Check localStorage only if previously followed
    if (localStorage.getItem(storageKey) === 'true') {
        setFollowedState();
    }

    followBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent default link behavior if it's an <a> tag

        // --- NEW: CHECK LOGIN STATUS ---
        if (!auth.currentUser) {
            // User is Logged OUT -> Open the Popup
            const overlay = document.getElementById('popupOverlay');
            const viewOptions = document.getElementById('view-options');
            
            // Reset views (hide email/otp forms, show main options)
            const hiddenViews = ['view-email', 'view-otp'];
            hiddenViews.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

            if (viewOptions) viewOptions.classList.remove('hidden');
            if (overlay) overlay.classList.add('active');
            
            return; // Stop here, don't toggle follow
        }

        // --- USER IS LOGGED IN: TOGGLE FOLLOW ---
        const isCurrentlyFollowing = followBtn.classList.contains('following');
        if (isCurrentlyFollowing) {
            setUnfollowedState();
            localStorage.removeItem(storageKey);
        } else {
            setFollowedState();
            localStorage.setItem(storageKey, 'true');
        }
    });

    function setFollowedState() {
        followBtn.textContent = 'Following';
        followBtn.classList.add('following');
    }

    function setUnfollowedState() {
        followBtn.textContent = 'Follow';
        followBtn.classList.remove('following');
    }
}

// ==========================================
// MAIN ARTICLE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. SELECT MAIN SKELETON ELEMENTS
    const skeletonView = document.getElementById('skeleton-view');
    const realView = document.getElementById('real-view');

    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) return;

    // 2. FETCH DATA
    const article = await getArticleById(articleId);

    if (!article) {
        document.querySelector('.main').innerHTML = "<h1 style='text-align:center;'>Article not found.</h1>";
        return;
    }

    // --- POPULATE REAL VIEW ---
    const titleEl = document.getElementById('news-headline');
    if (titleEl) titleEl.innerText = article.title;

    const dateEl = document.getElementById('news-date'); 
    if (dateEl && article.datePosted) {
        let dateObj = typeof article.datePosted.toDate === 'function' 
            ? article.datePosted.toDate() 
            : new Date(article.datePosted);
        
        dateEl.innerText = dateObj.toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });
    }

    const imgEl = document.getElementById('news-img');
    if (imgEl && article.imageUrl) imgEl.src = article.imageUrl;

    const contentEl = document.getElementById('article-content');
    if (contentEl && article.content) contentEl.innerHTML = article.content;

    const tagsSection = document.querySelector('.tags');
    if (tagsSection) {
        if (article.tags && article.tags.length > 0) {
            tagsSection.innerHTML = ''; 
            article.tags.forEach(tag => {
                const tagDiv = document.createElement('div');
                tagDiv.className = 'article-tags';
                tagDiv.innerHTML = `<a href="#">${tag}</a>`;
                tagsSection.appendChild(tagDiv);
            });
        } else {
            tagsSection.style.display = 'none'; 
        }
    }

    // --- AUTHOR SECTION ---
    const authorName = article.authorName || article.authorId || "Editor"; 
    const authorEmail = article.authorEmail || "priyanshuranjank@gmail.com"; 
    let authorPicUrl = article.authorImage || AUTHOR_DEFAULTS[authorName] || "/assets/default-user.png";

    const authorNameEl = document.querySelector('.author-name');
    const authorImgEl = document.querySelector('.author-avatar');
    const linkImg = document.getElementById('auth-link-img');
    const linkName = document.getElementById('auth-link-name');

    if (authorNameEl) authorNameEl.innerText = authorName;
    if (authorImgEl) { authorImgEl.src = authorPicUrl; authorImgEl.alt = authorName; }

    const profileUrl = `/profile pages/author.html?id=${encodeURIComponent(authorEmail)}`;
    // if (linkImg) linkImg.href = profileUrl;
    // if (linkName) linkName.href = profileUrl;

    // 3. HIDE MAIN SKELETON / SHOW REAL CONTENT
    if (skeletonView && realView) {
        skeletonView.classList.add('hidden');
        realView.classList.remove('hidden');
        realView.classList.add('fade-in');
    }

    // 4. INIT UTILS
    initFollowButton();
    
    // 5. LOAD RELATED (This triggers the second skeleton logic)
    if (article.tags && article.tags.length > 0) {
        loadRelated(article.tags, article.id);
    }
});

// ==========================================
// RELATED ARTICLES LOAD
// ==========================================
async function loadRelated(tags, currentId) {
    const container = document.getElementById('related-container');
    
    // Select the NEW wrappers
    const skeletonView = document.getElementById('related-skeleton-view');
    const realView = document.getElementById('related-real-view');
    
    if (!container) return;

    try {
        const related = await getLocalRelatedArticles(tags, currentId);
        
        container.innerHTML = ''; 

        if (related.length === 0) {
            container.innerHTML = '<p style="padding:10px;">No related articles found.</p>';
        } else {
            related.forEach(item => {
                const html = `
                    <div>
                        <img class="rel-img" width="280px" height="215px" display="block" src="${item.imageUrl || '/assets/default.png'}" alt="Related Image">
                        <h3><a href="article.html?id=${item.id}">${item.title}</a></h3>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }

        // --- SWAP VIEWS ---
        // Hide the entire Skeleton Wrapper (Header + Cards)
        if (skeletonView) skeletonView.classList.add('hidden');
        
        // Show the entire Real Wrapper (Header + Cards)
        if (realView) {
            realView.classList.remove('hidden');
            realView.classList.add('fade-in');
        }

    } catch (error) {
        console.error("Error loading related articles:", error);
        if (skeletonView) skeletonView.classList.add('hidden');
    }
}


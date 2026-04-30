// 1. Import Firebase Firestore functions
import {
    getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, query, where, getDocs, orderBy, collection
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Import your custom functions and auth
import { getArticleById, getLocalRelatedArticles, auth, app, toggleSaveArticle } from '/Article/firebase-db.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { renderMarkdown, initPremiumCharts } from '/assets/js/markdown-renderer.js';

import { ArticleReader } from '/assets/js/article-reader.js';
// 3. Initialize DB
const db = getFirestore(app);



// Add these variables at the top
let currentScale = 1, currentX = 0, currentY = 0, isDragging = false, startX, startY;

// 

// Fallback images
const AUTHOR_DEFAULTS = {
    "Priyanshu": "/assets/author-profile.jpeg",
    "Tiara": "/assets/img2.jpg",
    "Harsh": "/assets/img1.jpg"
};

// STATE VARIABLES
let originalTitle = "";
let originalSummary = "";
let originalContent = "";
let originalImageSrc = "";

// Image tag data — loaded dynamically from JSON (populated in DOMContentLoaded)
let IMG_TAGS_DATA = [];
let newImageBase64 = null;
let isEditing = false;

// --- NEW: Content Version States ---
let contentVersions = {
    beginner: "",
    intermediate: "", // Default
    pro: ""
};

// ==========================================
// FOLLOW BUTTON LOGIC
// ==========================================
// Follow button removed

// ==========================================
// MAIN ARTICLE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {

    // 0. LOAD IMAGE TAGS JSON
    try {
        const _res = await fetch('/assets/tags/img-tags.json');
        IMG_TAGS_DATA = await _res.json();
    } catch (e) { console.error('Error loading image tags:', e); }

    // 1. SELECT MAIN SKELETON ELEMENTS
    const skeletonView = document.getElementById('skeleton-view');
    const realView = document.getElementById('real-view');

    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');
    const isPreview = params.get('preview') === 'true';

    let article = null;

    if (isPreview) {
        // --- PREVIEW MODE START ---
        const previewData = sessionStorage.getItem('previewArticle');
        if (previewData) {
            article = JSON.parse(previewData);
            window.currentArticleData = article;

            // Adjust UI for preview mode
            document.getElementById('global-header').style.display = 'none';
            document.getElementById('preview-header').classList.remove('hidden');

            const actionButtons = document.querySelector('.article-actions');
            if (actionButtons) actionButtons.style.display = 'none';
        } else {
            document.querySelector('.main').innerHTML = "<h1 style='text-align:center;'>Preview data not found.</h1>";
            return;
        }
        // --- PREVIEW MODE END ---
    } else {
        if (!articleId) return;

        // --- SSR HYDRATION CHECK ---
        // If the Cloudflare Worker already pre-rendered the article, use that data
        const ssrDataEl = document.getElementById('ssr-article-data');
        if (ssrDataEl) {
            try {
                article = JSON.parse(ssrDataEl.textContent);
                console.log('✅ SSR: Article data loaded from pre-rendered HTML, skipping Firestore fetch.');
                // Still update social meta tags client-side for dynamic URL
                if (article) updateSocialMetaTags(article);
            } catch (e) {
                console.warn('SSR data parse failed, falling back to Firestore fetch:', e);
                article = null;
            }
        }

        // Fallback: fetch from Firestore if SSR data wasn't available
        if (!article) {
            // 2. FETCH DATA (Normal Mode)
            article = await getArticleById(articleId);
            if (article) {
                updateSocialMetaTags(article); // THE NEW CALL
            }
        }
        window.currentArticleData = article;
    }

    if (!article) {
        document.querySelector('.main').innerHTML = "<h1 style='text-align:center;'>Article not found.</h1>";
        return;
    }

    // --- NEW: STORE CONTENT VERSIONS ---

    // renderMarkdown is imported from /assets/js/markdown-renderer.js

    // We check if the specific field exists, otherwise fallback to standard content or a placeholder
    contentVersions.intermediate = renderMarkdown(article.content) || "";

    contentVersions.concise = article.conciseContent
        ? renderMarkdown(article.conciseContent)
        : "<p><em>(Concise version not available for this article. Showing standard content.)</em></p>" + renderMarkdown(article.content);
    // -----------------------------------


    // --- NEW: INCREMENT VIEW COUNT ---
    if (!isPreview) {
        try {
            const articleRef = doc(db, "articles", articleId);
            await updateDoc(articleRef, {
                "stats.views": increment(1)
            });
            console.log("📈 View recorded");
        } catch (e) {
            console.error("Error updating view count:", e);
        }
    }
    // ---------------------------------

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
    if (contentEl) {
        // Determine starting tab level (if intermediate is empty, default to concise)
        const hasIntermediate = !!article.content;
        const initialLevel = hasIntermediate ? 'intermediate' : 'concise';

        // Initializing with contentVersions ensures <p> wrapper exists so ArticleReader doesn't strip it
        contentEl.innerHTML = contentVersions[initialLevel] || "";

        // Post-processing: Render Chart.js charts and highlight code blocks
        initPremiumCharts(contentEl);
        Prism.highlightAll();

        // Correct active tab state if necessary
        if (!hasIntermediate && article.conciseContent) {
            const btnIntermediate = document.getElementById('btn-intermediate');
            const btnConcise = document.getElementById('btn-concise');
            if (btnIntermediate) btnIntermediate.classList.remove('active');
            if (btnConcise) btnConcise.classList.add('active');
        }
    }

    // Hide related news skeleton if in preview mode
    if (isPreview) {
        const moreNewsSect = document.querySelector('.more-news');
        if (moreNewsSect) moreNewsSect.style.display = 'none';
    }

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

    // Attempt to fetch profile photo from authors or users collection dynamically
    try {
        if (!article.authorImage) {
            // First check the `authors` collection
            const authorRef = doc(db, "authors", authorEmail);
            const authorSnap = await getDoc(authorRef);
            
            if (authorSnap.exists() && authorSnap.data().photoURL) {
                authorPicUrl = authorSnap.data().photoURL;
            } else {
                // Fallback to `users` collection
                const userRef = doc(db, "users", authorEmail);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists() && userSnap.data().photoURL) {
                    authorPicUrl = userSnap.data().photoURL;
                }
            }
        }
    } catch (e) {
        console.warn("Could not fetch author profile photo dynamically:", e);
    }

    const authorNameEl = document.querySelector('.author-name');
    const authorImgEl = document.querySelector('.author-avatar');
    const linkImg = document.getElementById('auth-link-img');
    const linkName = document.getElementById('auth-link-name');

    if (authorNameEl) authorNameEl.innerText = authorName;
    if (authorImgEl) { authorImgEl.src = authorPicUrl; authorImgEl.alt = authorName; }

    const profileUrl = `/author?id=${encodeURIComponent(authorEmail)}`;
    // if (linkImg) linkImg.href = profileUrl;
    // if (linkName) linkName.href = profileUrl;

    // 3. HIDE MAIN SKELETON / SHOW REAL CONTENT
    if (skeletonView && realView) {
        skeletonView.classList.add('hidden');
        realView.classList.remove('hidden');
        realView.classList.add('fade-in');
    }

    // 4. INIT UTILS (Only if not in preview)
    if (!isPreview) {
        initLikeButton(articleId, article);
    }

    // 5. LOAD RELATED
    if (!isPreview && article.tags && article.tags.length > 0) {
        // --- SSR HYDRATION CHECK FOR RELATED ---
        const relatedRealView = document.getElementById('related-real-view');
        if (relatedRealView && relatedRealView.dataset.ssr === 'true') {
            console.log('✅ SSR: Related articles already pre-rendered, skipping fetch.');
            // Hide skeleton and show real view
            const relatedSkeleton = document.getElementById('related-skeleton-view');
            if (relatedSkeleton) relatedSkeleton.classList.add('hidden');
            relatedRealView.classList.remove('hidden');
            relatedRealView.classList.add('fade-in');
        } else {
            loadRelated(article.tags, article.id);
        }
    }

    // 6. CHECK IF USER IS ADMIN OR AUTHOR -> OVERRIDE HEADER BUTTON (Only if not in preview)
    if (!isPreview) {
        onAuthStateChanged(auth, async (user) => {
            if (user && window.currentArticleData) {

                let isAdmin = false;
                let isAuthor = (user.email === window.currentArticleData.authorEmail);

                // Fetch Role to check for Admin
                try {
                    const userRef = doc(db, "users", user.email);
                    const snap = await getDoc(userRef);
                    if (snap.exists() && snap.data().role === 'admin') {
                        isAdmin = true;
                    }
                } catch (e) { console.error("Role check failed", e); }

                // If Admin or Original Author -> Change Header Button to "Edit"
                if (isAdmin || isAuthor) {
                    const headerBtn = document.getElementById('openPopupBtn');
                    if (headerBtn) {
                        // Force display flex in case it was hidden
                        headerBtn.style.display = 'flex';
                        headerBtn.style.pointerEvents = 'auto';
                        headerBtn.style.backgroundColor = '#000'; // Black background
                        headerBtn.style.color = '#fff';

                        // Override Text & Icon
                        headerBtn.innerHTML = `
                        <span class="edit-text-mobile-hide" style="position: relative; transform: translateX(30px); font-family: Helvetica, Arial, sans-serif; font-weight:300; font-size: 1.1rem; letter-spacing: 1px;">Edit Article</span>
                    `;

                        // Remove old listeners and attach Edit Mode toggle
                        // Cloning node is the cleanest way to strip existing listeners (like Dashboard link)
                        const newBtn = headerBtn.cloneNode(true);
                        headerBtn.parentNode.replaceChild(newBtn, headerBtn);

                        newBtn.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.toggleEditMode();
                        };
                    }
                }
            }
        });
    }
});

// ==========================================
// RELATED ARTICLES LOAD (CORRECTED)
// ==========================================
async function loadRelated(tags, currentId) {
    const container = document.getElementById('related-container');
    const skeletonView = document.getElementById('related-skeleton-view');
    const realView = document.getElementById('related-real-view');

    if (!container) return;

    try {
        // 1. Fetch only active articles from the local cache
        const related = await getLocalRelatedArticles(tags, currentId);
        container.innerHTML = '';

        if (related.length === 0) {
            // If no active related articles, hide the entire section
            if (realView) realView.classList.add('hidden');
        } else {
            related.forEach(item => {
                // Ensure we only show articles that are 'active'
                if (item.status === 'active') {
                    const html = `
                        <div>
                            <a href="/article?id=${item.id}">
                                <img class="rel-img" src="${item.imageUrl || '/assets/default.png'}" alt="Related Image" loading="lazy">
                            </a>
                            <h3><a href="/article?id=${item.id}">${item.title}</a></h3>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', html);
                }
            });
        }

        // 2. SWAP VIEWS: Hide skeleton and show real content
        if (skeletonView) skeletonView.classList.add('hidden');
        if (realView && container.children.length > 0) {
            realView.classList.remove('hidden');
            realView.classList.add('fade-in');
        }

    } catch (error) {
        console.error("Error loading related articles:", error);
        if (skeletonView) skeletonView.classList.add('hidden');
    }
}


/**
 * Dynamically updates meta tags for social media sharing using absolute URLs.
 * Ensure your article.html has meta tags with these exact IDs.
 */
function updateSocialMetaTags(article) {
    // 1. SET YOUR ACTUAL DOMAIN HERE (Must start with https://)
    const siteBaseUrl = "https://bitfeed.in";

    const title = article.title || "bitfeed";
    const summary = article.summary || "Clean. Minimal. Insights.";
    const authorName = article.authorName || article.authorId || "bitfeed";

    // 2. CONVERT TO ABSOLUTE URLs (Critical for bots/crawlers)
    const absoluteImageUrl = article.imageUrl.startsWith('http')
        ? article.imageUrl
        : `${siteBaseUrl}${article.imageUrl}`;

    const currentAbsoluteUrl = window.location.href;

    // 3. UPDATE BROWSER TAB
    document.title = `${title} | bitfeed`;

    // 4. UPDATE STANDARD META DESCRIPTION
    const metaDesc = document.getElementById('meta-description-tag');
    if (metaDesc) metaDesc.setAttribute("content", summary);

    // 4b. UPDATE AUTHOR META
    const metaAuthor = document.getElementById('meta-author-tag');
    if (metaAuthor) metaAuthor.setAttribute("content", authorName);

    // 5. UPDATE OPEN GRAPH (Facebook/LinkedIn)
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const ogImg = document.getElementById('og-image');
    const ogUrl = document.getElementById('og-url');

    if (ogTitle) ogTitle.setAttribute("content", title);
    if (ogDesc) ogDesc.setAttribute("content", summary);
    if (ogImg) ogImg.setAttribute("content", absoluteImageUrl);
    if (ogUrl) ogUrl.setAttribute("content", currentAbsoluteUrl);

    // 6. UPDATE TWITTER CARD TAGS
    const twitterTitle = document.getElementById('twitter-title');
    const twitterDesc = document.getElementById('twitter-description');
    const twitterImg = document.getElementById('twitter-image');

    if (twitterTitle) twitterTitle.setAttribute("content", title);
    if (twitterDesc) twitterDesc.setAttribute("content", summary);
    if (twitterImg) twitterImg.setAttribute("content", absoluteImageUrl);

    // 7. UPDATE CANONICAL URL
    const canonicalLink = document.getElementById('canonical-link');
    if (canonicalLink) canonicalLink.setAttribute("href", currentAbsoluteUrl);

    // 8. UPDATE ARTICLE JSON-LD STRUCTURED DATA
    const jsonLdEl = document.getElementById('article-jsonld');
    if (jsonLdEl) {
        let datePublished = "";
        if (article.datePosted) {
            const dateObj = typeof article.datePosted.toDate === 'function'
                ? article.datePosted.toDate()
                : new Date(article.datePosted);
            datePublished = dateObj.toISOString();
        }

        const jsonLd = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": title,
            "description": summary,
            "image": absoluteImageUrl,
            "datePublished": datePublished,
            "url": currentAbsoluteUrl,
            "author": {
                "@type": "Person",
                "name": authorName
            },
            "publisher": {
                "@type": "Organization",
                "name": "bitfeed by custmr.team",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://bitfeed.in/assets/favicon.png"
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": currentAbsoluteUrl
            }
        };

        jsonLdEl.textContent = JSON.stringify(jsonLd);
    }
}

async function initLikeButton(articleId, articleData) {
    const likeBtn = document.getElementById('like-btn');
    const likeIcon = document.getElementById('like-icon');

    if (!likeBtn || !likeIcon) return;

    const UNFILLED_IMAGE = "/assets/icons/like icon unfilled.png";
    const FILLED_IMAGE = "/assets/icons/like icon filled.png";

    // Check initial state
    if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.email);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const likedArticles = userSnap.data().likedArticles || [];
            if (likedArticles.includes(articleId)) {
                likeBtn.classList.add('liked');
                likeIcon.src = FILLED_IMAGE;
                // Update text to "Liked"
                likeBtn.childNodes[0].textContent = "Liked";
            }
        }
    }

    likeBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!auth.currentUser) {
            const overlay = document.getElementById('popupOverlay');
            const viewOptions = document.getElementById('view-options');
            if (overlay) overlay.classList.add('active');
            if (viewOptions) viewOptions.classList.remove('hidden');
            return;
        }

        const isCurrentlyLiked = likeBtn.classList.contains('liked');
        const userRef = doc(db, "users", auth.currentUser.email);
        const articleRef = doc(db, "articles", articleId);

        try {
            if (isCurrentlyLiked) {
                // UNLIKE: Update DB and UI
                await updateDoc(userRef, { likedArticles: arrayRemove(articleId) });
                await updateDoc(articleRef, { "stats.likes": increment(-1) });
                likeBtn.classList.remove('liked');
                likeIcon.src = UNFILLED_IMAGE;
                // Toggle text back to "Like"
                likeBtn.childNodes[0].textContent = "Like";

                // Also UNSAVE the article
                await toggleSaveArticle(articleId, false, articleData);
            } else {
                // LIKE: Update DB and UI
                await updateDoc(userRef, { likedArticles: arrayUnion(articleId) });
                await updateDoc(articleRef, { "stats.likes": increment(1) });
                likeBtn.classList.add('liked');
                likeIcon.src = FILLED_IMAGE;
                // Toggle text to "Liked"
                likeBtn.childNodes[0].textContent = "Liked";

                // Also SAVE the article
                await toggleSaveArticle(articleId, true, articleData);
            }
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    });
}




window.toggleEditMode = function () {
    const headerBtn = document.getElementById('openPopupBtn');
    if (headerBtn) headerBtn.style.visibility = 'hidden';
    if (isEditing) return;
    isEditing = true;

    // Elements
    const titleEl = document.getElementById('news-headline');
    const contentEl = document.getElementById('article-content');

    // Enable chart settings UI (gear icon + resize handle) for admin
    contentEl.classList.add('chart-edit-mode');
    const imgEl = document.getElementById('news-img');
    const toolbar = document.getElementById('edit-toolbar');
    const featuredRow = document.getElementById('featured-edit-row');
    const featuredCheck = document.getElementById('edit-is-featured');

    const deleteBtn = document.getElementById('btn-delete-article');

    // Show toolbar
    if (toolbar) toolbar.classList.remove('hidden');

    // Only show the Delete button if the user is an admin
    // We can check the isAdmin status we fetched earlier or check the current user role
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userRef = doc(db, "users", user.email);
            const snap = await getDoc(userRef);

            if (snap.exists() && snap.data().role === 'admin') {
                const subBtn = document.getElementById('openPopupBtn');
                const deleteBtn = document.getElementById('btn-delete-article');

                // Show delete button for admin
                if (deleteBtn) deleteBtn.style.display = 'block';

                if (subBtn) {
                    // Transform Subscribe Button to Edit Button
                    subBtn.classList.add('admin-edit-btn');
                    subBtn.onclick = () => window.toggleEditMode();
                    // Use spans to allow CSS to hide the text on mobile
                    subBtn.innerHTML = `
                        <span class="edit-text">Edit Article</span>
                        <span class="icon">
                            <img src="/assets/edit unfilled.png" id="edit-icon-img" class="edit-btn-icon">
                        </span>
                    `;
                }
            } else {
                // Hide delete button if not admin
                const deleteBtn = document.getElementById('btn-delete-article');
                if (deleteBtn) deleteBtn.style.display = 'none';
            }
        }
    });

    // Save Originals
    originalTitle = titleEl.innerText;
    originalContent = window.currentArticleData ? (window.currentArticleData.content || "") : "";
    originalImageSrc = imgEl.src;

    // 1. Make title editable
    titleEl.contentEditable = "true";
    titleEl.style.border = "2px dashed #ccc"; // Visual hint

    // 2. Replace rendered content div with a raw markdown textarea
    // Hide level tabs during edit
    const levelWrapper = document.querySelector('.level-selection-wrapper');
    if (levelWrapper) levelWrapper.style.display = 'none';

    const editTextarea = document.createElement('textarea');
    editTextarea.id = 'article-content-edit';
    editTextarea.value = originalContent; // Raw markdown from DB
    editTextarea.style.cssText = 'width:100%; padding:16px; font-family:monospace; font-size:0.95rem; line-height:1.6; border:2px dashed #ccc; border-radius:8px; background:#fafafa; resize:vertical; box-sizing:border-box; color:#333; overflow:hidden;';
    contentEl.style.display = 'none';
    contentEl.parentNode.insertBefore(editTextarea, contentEl.nextSibling);

    // Auto-size textarea to fit content
    function autoResize() {
        editTextarea.style.height = 'auto';
        editTextarea.style.height = editTextarea.scrollHeight + 'px';
    }
    autoResize(); // Initial resize
    editTextarea.addEventListener('input', autoResize);

    // 2. Show the Save/Cancel bar
    if (toolbar) toolbar.classList.remove('hidden');

    // 1. Set Featured Checkbox state
    if (window.currentArticleData && featuredCheck) {
        featuredCheck.checked = window.currentArticleData.isFeatured === true;
    }

    if (featuredRow) featuredRow.classList.remove('hidden');

    // 5. Image Overlay
    const wrapper = document.createElement('div');
    wrapper.className = 'edit-img-wrapper';
    imgEl.parentNode.insertBefore(wrapper, imgEl);
    wrapper.appendChild(imgEl);

    const overlay = document.createElement('div');
    overlay.className = 'img-upload-overlay';
    overlay.innerHTML = "<span>Click to Change Image</span>";
    overlay.onclick = () => document.getElementById('edit-img-input').click();
    wrapper.appendChild(overlay);

    // 6. Show image suggestion radios — render dynamically from JSON
    const editImgSuggestions = document.getElementById('edit-img-suggestions');
    if (editImgSuggestions) {
        editImgSuggestions.classList.remove('hidden');

        // Render radios dynamically into the container
        const editImgContainer = document.getElementById('edit-img-suggest-options');
        if (editImgContainer) {
            editImgContainer.innerHTML = ''; // Clear previous
            IMG_TAGS_DATA.forEach(tag => {
                const id = 'edit-suggest-' + tag.name.toLowerCase().replace(/\s+/g, '-');
                const div = document.createElement('div');
                div.className = 'img-suggest-option';
                div.innerHTML = `
                    <input type="radio" name="edit-img-suggest" id="${id}" value="${tag.path}" data-tag="${tag.name}">
                    <label for="${id}">${tag.name}</label>
                `;
                editImgContainer.appendChild(div);
            });
        }

        // Reset radios
        document.querySelectorAll('input[name="edit-img-suggest"]').forEach(r => r.checked = false);

        // Add change listener to update the article image live
        document.querySelectorAll('input[name="edit-img-suggest"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                imgEl.src = e.target.value;
                newImageBase64 = null; // Clear any cropped image — use radio path instead
            });
        });
    }

    // 7. Show Tag Editor
    const tagsSection = document.querySelector('.tags');
    if (tagsSection) {
        tagsSection.classList.add('hidden');
        tagsSection.style.display = 'none';
    }

    document.getElementById('edit-tags-group').classList.remove('hidden');
    window.currentEditTags = (window.currentArticleData && window.currentArticleData.tags) ? [...window.currentArticleData.tags] : [];
    if (window.renderEditTags) window.renderEditTags();

};


window.cancelEdit = function () {
    location.reload();// Simple reload to discard changes
};

// Handle Image File Selection
window.handleImageUpdate = function (input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            // Open Cropper
            const modal = document.getElementById('cropper-modal');
            const img = document.getElementById('cropper-img');
            const slider = document.getElementById('zoom-slider');

            img.src = e.target.result;
            modal.classList.remove('hidden');

            // Reset
            currentScale = 1; currentX = 0; currentY = 0; slider.value = 1;
            img.style.transform = `translate(0px, 0px) scale(1)`;

            initEditCropper(img, slider, modal);
        };
        reader.readAsDataURL(file);
    }
};

function initEditCropper(cropperImg, zoomSlider, modal) {
    const cropContainer = modal.querySelector('.crop-container');
    const btnSave = document.getElementById('btn-save-crop');
    const btnCancel = document.getElementById('btn-cancel-crop');

    function updateTrans() { cropperImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`; }

    // Drag
    cropContainer.onmousedown = (e) => { e.preventDefault(); isDragging = true; startX = e.clientX - currentX; startY = e.clientY - currentY; };
    window.onmouseup = () => { isDragging = false; };
    window.onmousemove = (e) => { if (!isDragging) return; e.preventDefault(); currentX = e.clientX - startX; currentY = e.clientY - startY; updateTrans(); };

    // Zoom
    zoomSlider.oninput = (e) => { currentScale = parseFloat(e.target.value); updateTrans(); };

    // Save
    btnSave.onclick = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800; canvas.height = 450;
        const ctx = canvas.getContext('2d');
        const ratio = 800 / cropContainer.clientWidth;

        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 800, 450);
        ctx.save();

        const imgWidth = 800;
        const imgHeight = (cropperImg.naturalHeight / cropperImg.naturalWidth) * 800;

        ctx.translate(currentX * ratio, currentY * ratio);
        ctx.translate(imgWidth / 2, imgHeight / 2);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-imgWidth / 2, -imgHeight / 2);
        ctx.drawImage(cropperImg, 0, 0, imgWidth, imgHeight);
        ctx.restore();

        // Save to Global var and UI
        newImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('news-img').src = newImageBase64;

        modal.classList.add('hidden');
    };

    btnCancel.onclick = () => modal.classList.add('hidden');
}

window.saveArticleChanges = async function () {
    const btn = document.querySelector('.btn-save-edit');
    // Ensure this ID matches your HTML checkbox
    const isFeaturedChecked = document.getElementById('edit-is-featured').checked;
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const params = new URLSearchParams(window.location.search);
        const articleId = params.get('id');
        const articleRef = doc(db, "articles", articleId);

        // 1. FEATURED LOGIC (Max 2 Rule)
        // Now that query/where/getDocs are imported, this will work
        if (isFeaturedChecked && window.currentArticleData.isFeatured !== true) {
            const qFeatured = query(
                collection(db, "articles"),
                where("status", "==", "active"),
                where("isFeatured", "==", true),
                orderBy("datePosted", "asc")
            );
            const featSnap = await getDocs(qFeatured);

            if (featSnap.size >= 2) {
                const oldestFeatDoc = featSnap.docs[0];
                await updateDoc(oldestFeatDoc.ref, { isFeatured: false });
            }
        }

        // 2. IMAGE TAG SWAP LOGIC
        // Build image tag names from fetched JSON data
        const IMAGE_TAG_NAMES = IMG_TAGS_DATA.map(t => t.name);
        const selectedRadio = document.querySelector('input[name="edit-img-suggest"]:checked');

        // If an image suggestion was selected, swap the image tag in the tags array
        let editTags = window.currentEditTags || [];
        if (selectedRadio && selectedRadio.dataset.tag) {
            // Remove any previous image tags
            editTags = editTags.filter(t => !IMAGE_TAG_NAMES.includes(t));
            // Add the new image tag
            editTags.push(selectedRadio.dataset.tag);
            window.currentEditTags = editTags;
        }

        // 3. COLLECT DATA — Get raw markdown from the edit textarea
        const editTextarea = document.getElementById('article-content-edit');
        const rawContent = editTextarea ? editTextarea.value : document.getElementById('article-content').innerHTML;
        const updateData = {
            title: document.getElementById('news-headline').innerText,
            content: rawContent, // Raw markdown, NOT rendered HTML
            isFeatured: isFeaturedChecked,
            tags: editTags,
            updatedAt: Date.now() // For cache sync
        };

        if (newImageBase64) {
            updateData.imageUrl = newImageBase64;
        } else {
            // Check if an image suggestion radio was selected
            if (selectedRadio) {
                updateData.imageUrl = selectedRadio.value;
            }
        }

        await updateDoc(articleRef, updateData);

        alert("Article Updated Successfully!");
        location.reload();

    } catch (e) {
        console.error(e);
        alert("Error updating article: " + e.message);
        btn.innerText = "Save Changes";
        btn.disabled = false;
    }
};

// ==========================================
// CONTENT LEVEL SWITCHER
// ==========================================
window.switchLevel = function (level) {
    // STOP READING if it's currently playing
    if (window.articleReaderInstance) {
        window.articleReaderInstance.stopReading();
        // Hide the progress bar
        const verticalBar = document.getElementById('progress-bar-vertical');
        if (verticalBar) {
            verticalBar.classList.add('hidden');
        }
    }

    // 1. Update Content
    const contentEl = document.getElementById('article-content');

    // Fade out effect (Optional polish)
    contentEl.style.opacity = '0.5';

    setTimeout(() => {
        if (contentVersions[level]) {
            contentEl.innerHTML = contentVersions[level];
        }
        contentEl.style.opacity = '1';

        // Post-processing: Render Chart.js charts and highlight code blocks
        initPremiumCharts(contentEl);
        Prism.highlightAll();

        // RE-PREPARE the article text for the new content
        if (window.articleReaderInstance) {
            window.articleReaderInstance.prepareArticleText();
        }
    }, 150);

    // 2. Update Tabs UI
    document.querySelectorAll('.level-tab').forEach(btn => { // Target .level-tab
        btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`btn-${level}`);
    if (activeBtn) activeBtn.classList.add('active');
};


window.deleteArticle = async function () {
    const confirmDelete = confirm("Are you sure you want to permanently delete this article? This action cannot be undone.");

    if (!confirmDelete) return;

    const btn = document.getElementById('btn-delete-article');
    btn.innerText = "Deleting...";
    btn.disabled = true;

    try {
        const params = new URLSearchParams(window.location.search);
        const articleId = params.get('id');

        if (!articleId) throw new Error("Article ID not found.");

        await deleteDoc(doc(db, "articles", articleId));

        alert("Article deleted successfully.");
        // Redirect to main page after deletion
        window.location.href = "/";

    } catch (e) {
        console.error("Error deleting article:", e);
        alert("Failed to delete article: " + e.message);
        btn.innerText = "Delete Article";
        btn.disabled = false;
    }
};










// listener — Piper TTS (WASM / Browser-Local) Engine


// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.articleReaderInstance = new ArticleReader();
    }, 2000); // Wait for Firebase content 

    // Tag Editor Logic
    window.currentEditTags = [];
    const editTagsContainer = document.getElementById('edit-tags-container');
    const editTagInput = document.getElementById('edit-tag-input');
    const tagSuggestions = document.getElementById('tag-suggestions');

    window.renderEditTags = function () {
        if (!editTagsContainer) return;
        const chips = editTagsContainer.querySelectorAll('.tag-chip-active');
        chips.forEach(chip => chip.remove());

        window.currentEditTags.forEach((tag, index) => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip-active';
            chip.textContent = tag;
            chip.dataset.index = index;
            // Style specifically for inline edit
            chip.style.backgroundColor = '#b93b3b';
            chip.style.color = '#fff';
            chip.style.padding = '5px 12px';
            chip.style.borderRadius = '20px';
            chip.style.display = 'flex';
            chip.style.alignItems = 'center';
            chip.style.fontSize = '0.85rem';
            chip.style.height = '25px';
            chip.style.cursor = 'pointer';

            chip.addEventListener('click', () => {
                window.currentEditTags.splice(index, 1);
                window.renderEditTags();
            });
            editTagsContainer.insertBefore(chip, editTagInput);
        });

        if (editTagInput) editTagInput.placeholder = window.currentEditTags.length >= 5 ? '' : 'Type & Press Enter';
    };

    if (editTagInput) {
        editTagInput.addEventListener('input', () => {
            if (editTagInput.value.trim().length > 0) {
                if (tagSuggestions) tagSuggestions.style.display = 'flex';
            } else {
                if (tagSuggestions) tagSuggestions.style.display = 'none';
            }
        });

        editTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = editTagInput.value.trim().replace(/[^a-zA-Z0-9 ]/g, "");
                if (val && !window.currentEditTags.includes(val) && window.currentEditTags.length < 5) {
                    window.currentEditTags.push(val);
                    window.renderEditTags();
                }
                editTagInput.value = "";
                if (tagSuggestions) tagSuggestions.style.display = 'none';
            } else if (e.key === 'Backspace' && editTagInput.value === "" && window.currentEditTags.length > 0) {
                window.currentEditTags.pop();
                window.renderEditTags();
            }
        });
    }

    document.querySelectorAll('.tag-suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.tag;
            if (val && !window.currentEditTags.includes(val) && window.currentEditTags.length < 5) {
                window.currentEditTags.push(val);
                window.renderEditTags();
            }
        });
    });

    // Share Button Logic
    const shareBtn = document.getElementById('share-btn');
    const sharePopup = document.getElementById('share-popup');
    if (shareBtn && sharePopup) {
        shareBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sharePopup.classList.toggle('hidden');
        });

        // Hide popup when clicking outside
        document.addEventListener('click', (e) => {
            if (!shareBtn.contains(e.target) && !sharePopup.contains(e.target)) {
                sharePopup.classList.add('hidden');
            }
        });
    }
});

// Share Function (Global)
window.shareArticle = function (platform) {
    if (!window.currentArticleData) return;

    const article = window.currentArticleData;
    const url = encodeURIComponent(window.location.href);

    // Build text to share
    const textToShare = `${article.title || 'Check out this article!'}\n\n${article.summary || ''}`;
    const encodedText = encodeURIComponent(textToShare);

    let shareUrl = '';

    switch (platform) {
        case 'copy':
            navigator.clipboard.writeText(window.location.href).then(() => {
                const textEl = document.getElementById('share-copy-text');
                if (textEl) {
                    const originalText = textEl.innerText;
                    textEl.innerText = 'Copied!';
                    setTimeout(() => {
                        textEl.innerText = originalText;
                        const popup = document.getElementById('share-popup');
                        if (popup) popup.classList.add('hidden');
                    }, 2000);
                }
            }).catch(err => console.error('Failed to copy: ', err));
            // Return early so we don't immediately hide the popup or open a window
            return;
        case 'telegram':
            shareUrl = `https://t.me/share/url?url=${url}&text=${encodedText}`;
            break;
        case 'facebook':
            // Facebook extracts info from meta tags
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'whatsapp':
            shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare + '\n' + window.location.href)}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${encodedText}`;
            break;
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }

    const popup = document.getElementById('share-popup');
    if (popup) popup.classList.add('hidden');
};

// --- PAGE NAVIGATION KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', function (e) {
    const isTyping = e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable;
    if (isTyping) return;

    switch (e.key.toLowerCase()) {
        case 'h':
            window.location.href = '/';
            break;
        case 's':
            window.location.href = '/students';
            break;
        case 'i':
            window.location.href = '/error';
            break;
        case 'm':
            window.location.href = '/news';
            break;
    }
});
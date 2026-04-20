// 1. Import Firebase Firestore functions
import {
    getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, query, where, getDocs, orderBy, collection
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Import your custom functions and auth
import { getArticleById, getLocalRelatedArticles, auth, app, toggleSaveArticle } from '/Article/firebase-db.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { renderMarkdown, initPremiumCharts } from '/assets/js/markdown-renderer.js';

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

        // 2. FETCH DATA (Normal Mode)
        article = await getArticleById(articleId);
        if (article) {
            updateSocialMetaTags(article); // THE NEW CALL
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

        // 5. LOAD RELATED (This triggers the second skeleton logic)
        if (article.tags && article.tags.length > 0) {
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

class ArticleReader {
    constructor() {
        this.isPlaying = false;
        this.isPaused = false;
        this.isDragging = false;
        this.currentWordIndex = 0;
        this.words = [];
        this.wordElements = [];
        this.highlighters = [];

        // Piper TTS state
        this.tts = null;
        this.piperReady = false;
        this.piperLoading = false;
        this.voiceId = 'en_US-hfc_female-medium';

        // Audio playback state (Web Audio API — AudioBufferSourceNode)
        this.audioContext = null;
        this.sourceNode = null;           // Current AudioBufferSourceNode
        this.currentAudioBuffer = null;   // Decoded AudioBuffer for current chunk
        this.playStartMark = 0;           // audioContext.currentTime when playback started
        this.playOffset = 0;              // Offset (seconds) into the buffer where playback started
        this.pausePosition = 0;           // Elapsed seconds when paused
        this._stoppedManually = false;    // Flag to differentiate stop() from natural end
        this._playbackGen = 0;            // Generation counter to cancel stale async playback

        // Sentence chunking state
        this.sentenceChunks = [];      // Array of { text, words, wordStartIdx, wordEndIdx }
        this.currentChunkIndex = 0;
        this.chunkWordTimings = [];    // Array of { startTime, endTime } for words in current chunk
        this.chunkStartWordIndex = 0;  // Global word index where current chunk starts
        this.rafId = null;

        // Pre-synthesis buffer
        this.nextChunkBuffer = null;      // Pre-decoded AudioBuffer for next chunk
        this.nextChunkDuration = 0;

        this.init();
    }

    init() {
        const playBtn = document.getElementById('play-pause-btn-circle');
        const verticalBar = document.getElementById('progress-bar-vertical');
        const readerContainer = document.getElementById('reader-container-vertical');

        playBtn.addEventListener('click', async () => {
            const isMobile = window.innerWidth <= 600;

            // Prepare words if not done yet
            if (this.words.length === 0) {
                this.prepareArticleText();
            }

            // Ensure Piper is loaded before any playback
            if (!this.piperReady && !this.piperLoading) {
                await this.initPiper();
                if (!this.piperReady) return; // failed to load
            }

            if (!this.isPlaying) {
                // Start playing
                if (isMobile) {
                    readerContainer.classList.add('expanded');
                    setTimeout(() => {
                        this.startReading();
                        const mobileProgress = document.getElementById('mobile-progress-container');
                        if (mobileProgress) mobileProgress.classList.add('active');
                    }, 400);
                } else {
                    this.startReading();
                    verticalBar.classList.remove('hidden');
                }
            } else if (this.isPaused) {
                this.resumeReading();
            } else {
                this.pauseReading();
            }
        });

        // Make the vertical progress bar draggable (desktop/tablet)
        const progressHandle = document.getElementById('progress-handle-vertical');
        this.initDraggableProgress(verticalBar, progressHandle);

        // Initialize horizontal progress bar for mobile
        this.initMobileProgressBar();

        // Prepare text after a small delay to ensure DOM is ready
        setTimeout(() => {
            this.prepareArticleText();
        }, 100);
    }

    // ─────────────────────────────────────────────────
    //  Piper TTS Initialization
    // ─────────────────────────────────────────────────

    async initPiper() {
        if (this.piperReady || this.piperLoading) return;
        this.piperLoading = true;

        const statusEl = document.getElementById('voice-download-status');
        const statusText = document.getElementById('voice-download-text');

        try {
            // Show download status
            if (statusEl) statusEl.classList.remove('hidden');
            if (statusText) statusText.textContent = 'Loading voice engine...';

            // Dynamic import of the Piper TTS library from CDN
            const ttsModule = await import('https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@latest/+esm');
            this.tts = ttsModule;

            // Check if model is already stored in OPFS
            const storedModels = await this.tts.stored();
            const isStored = storedModels.includes(this.voiceId);

            if (!isStored) {
                if (statusText) statusText.textContent = 'initializing (first time)...';

                // Download model with progress
                await this.tts.download(this.voiceId, (progress) => {
                    if (progress.total > 0) {
                        const pct = Math.round((progress.loaded / progress.total) * 100);
                        if (statusText) statusText.textContent = `Initializing voice... ${pct}%`;
                    }
                });
            }

            // Create AudioContext for decoding WAV durations
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            this.piperReady = true;
            if (statusText) statusText.textContent = 'initialized!';

            // Hide status after a short delay
            setTimeout(() => {
                if (statusEl) statusEl.classList.add('hidden');
            }, 1000);

        } catch (err) {
            console.error('Failed to initialize Piper TTS:', err);
            if (statusText) statusText.textContent = 'Voice failed to load';
            setTimeout(() => {
                if (statusEl) statusEl.classList.add('hidden');
            }, 3000);
        } finally {
            this.piperLoading = false;
        }
    }

    // ─────────────────────────────────────────────────
    //  Mobile Progress Bar Logic
    // ─────────────────────────────────────────────────

    initMobileProgressBar() {
        const horizontalBar = document.getElementById('progress-bar-horizontal');
        const horizontalHandle = document.getElementById('progress-handle-horizontal');

        if (!horizontalBar || !horizontalHandle) return;

        const seekToPosition = (clientX) => {
            if (!horizontalBar || this.words.length === 0) return;

            const rect = horizontalBar.getBoundingClientRect();
            const barWidth = rect.width;
            const offsetX = clientX - rect.left;
            const clampedX = Math.max(0, Math.min(offsetX, barWidth));
            const percentage = Math.max(0, Math.min(1, clampedX / barWidth));

            let newIndex = Math.floor(percentage * this.words.length);
            if (newIndex >= this.words.length) newIndex = this.words.length - 1;
            if (newIndex < 0) newIndex = 0;

            this.currentWordIndex = newIndex;
            this.updateProgress();

            if (!this.isDragging && this.isPlaying && !this.isPaused) {
                this.seekToWordIndex(newIndex);
            } else {
                this.updateFloatingHighlighter(this.currentWordIndex);
            }
        };

        const onMouseDown = (e) => {
            this.isDragging = true;
            seekToPosition(e.clientX);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.clientX);
            }
        };

        const onMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        const onTouchStart = (e) => {
            this.isDragging = true;
            seekToPosition(e.touches[0].clientX);
            e.preventDefault();
        };

        const onTouchMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.touches[0].clientX);
                e.preventDefault();
            }
        };

        const onTouchEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        horizontalHandle.addEventListener('mousedown', onMouseDown);
        horizontalBar.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        horizontalHandle.addEventListener('touchstart', onTouchStart);
        horizontalBar.addEventListener('touchstart', onTouchStart);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    // ─────────────────────────────────────────────────
    //  Desktop Draggable Progress Bar
    // ─────────────────────────────────────────────────

    initDraggableProgress(progressBar, handle) {
        if (!progressBar || !handle) return;

        const seekToPosition = (clientY) => {
            if (!progressBar || this.words.length === 0) return;

            const rect = progressBar.getBoundingClientRect();
            const barHeight = rect.height;
            const offsetY = clientY - rect.top;
            const clampedY = Math.max(0, Math.min(offsetY, barHeight));

            // Invert: top = 0%, bottom = 100% (fill grows from bottom)
            const percentage = Math.max(0, Math.min(1, 1 - (clampedY / barHeight)));

            let newIndex = Math.floor(percentage * this.words.length);
            if (newIndex >= this.words.length) newIndex = this.words.length - 1;
            if (newIndex < 0) newIndex = 0;

            this.currentWordIndex = newIndex;
            this.updateProgress();

            if (!this.isDragging && this.isPlaying && !this.isPaused) {
                this.seekToWordIndex(newIndex);
            } else {
                this.updateFloatingHighlighter(this.currentWordIndex);
            }
        };

        const onMouseDown = (e) => {
            this.isDragging = true;
            seekToPosition(e.clientY);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.clientY);
            }
        };

        const onMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        // Mouse events
        handle.addEventListener('mousedown', onMouseDown);
        progressBar.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Touch events for mobile
        const onTouchStart = (e) => {
            this.isDragging = true;
            seekToPosition(e.touches[0].clientY);
            e.preventDefault();
        };

        const onTouchMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.touches[0].clientY);
                e.preventDefault();
            }
        };

        const onTouchEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        handle.addEventListener('touchstart', onTouchStart);
        progressBar.addEventListener('touchstart', onTouchStart);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    // ─────────────────────────────────────────────────
    //  Text Preparation — Extract readable words
    // ─────────────────────────────────────────────────

    prepareArticleText() {
        const contentEl = document.getElementById('article-content');
        if (!contentEl) return;

        this.words = [];
        this.wordElements = [];

        // Helper: wrap text nodes inside an element with word spans
        const wrapWordsInElement = (el) => {
            if (!el.textContent.trim()) return;

            // Skip elements that contain non-readable nested content
            if (el.querySelector('pre, img, figure')) return;

            const text = el.textContent;
            const wordsArr = text.split(/(\s+)/);

            // Clear the element and rebuild with word spans
            el.innerHTML = '';
            el.style.position = 'relative';
            el.style.zIndex = '2';

            wordsArr.forEach(word => {
                if (word.trim()) {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = word;
                    this.wordElements.push(span);
                    this.words.push(word);
                    el.appendChild(span);
                } else {
                    el.appendChild(document.createTextNode(word));
                }
            });
        };

        // Walk ALL readable elements in a SINGLE querySelectorAll pass.
        // querySelectorAll returns elements in document order, so headings,
        // paragraphs, lists, and table cells are read in the correct sequence.
        const allReadable = contentEl.querySelectorAll(
            'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote'
        );

        allReadable.forEach(el => {
            // Skip if already processed (e.g. by a parent element)
            if (el.querySelector('.word')) return;

            // Skip elements inside code blocks or chart containers
            if (el.closest('pre') || el.closest('.premium-chart-container')) return;

            // Skip blockquotes that contain child <p> (those will be handled individually)
            if (el.tagName === 'BLOCKQUOTE' && el.querySelector('p')) return;

            // Skip paragraphs that contain images or figures
            if (el.querySelector('img, figure')) return;

            // Skip empty elements
            if (!el.textContent.trim()) return;

            wrapWordsInElement(el);
        });

        // FALLBACK: If no words were found (e.g. plain text content without
        // standard HTML tags like <p>, <h1>, etc.), walk through all text nodes
        // and wrap their words in <span> elements WITHOUT destroying the DOM.
        if (this.words.length === 0 && contentEl.textContent.trim()) {
            const textNodes = [];
            const walker = document.createTreeWalker(
                contentEl, NodeFilter.SHOW_TEXT, null, false
            );
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim()) textNodes.push(node);
            }

            textNodes.forEach(textNode => {
                const parent = textNode.parentNode;
                // Skip nodes inside pre/code/chart containers
                if (parent.closest && (parent.closest('pre') || parent.closest('.premium-chart-container'))) return;

                const text = textNode.textContent;
                const parts = text.split(/(\s+)/);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.trim()) {
                        const span = document.createElement('span');
                        span.className = 'word';
                        span.textContent = part;
                        this.wordElements.push(span);
                        this.words.push(part);
                        fragment.appendChild(span);
                    } else if (part) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, textNode);
            });

            contentEl.style.position = 'relative';
            contentEl.style.zIndex = '2';
        }

        // Build sentence chunks from the collected words
        this.buildSentenceChunks();
    }

    // ─────────────────────────────────────────────────
    //  Sentence Chunking — Split words into sentences
    // ─────────────────────────────────────────────────

    buildSentenceChunks() {
        this.sentenceChunks = [];
        if (this.words.length === 0) return;

        let currentSentenceWords = [];
        let sentenceStartIdx = 0;

        for (let i = 0; i < this.words.length; i++) {
            const word = this.words[i];
            currentSentenceWords.push(word);

            // Detect sentence boundaries: word ends with `.`, `!`, `?`, `:`, `;`
            // Also force a break every 25 words to keep chunks manageable
            const isSentenceEnd = /[.!?;:]$/.test(word);
            const isTooLong = currentSentenceWords.length >= 25;

            if (isSentenceEnd || isTooLong || i === this.words.length - 1) {
                this.sentenceChunks.push({
                    text: currentSentenceWords.join(' '),
                    words: [...currentSentenceWords],
                    wordStartIdx: sentenceStartIdx,
                    wordEndIdx: i
                });
                currentSentenceWords = [];
                sentenceStartIdx = i + 1;
            }
        }
    }

    // ─────────────────────────────────────────────────
    //  Playback Control
    // ─────────────────────────────────────────────────

    startReading() {
        this.isPlaying = true;
        this.isPaused = false;
        if (this.currentWordIndex >= this.words.length) {
            this.currentWordIndex = 0;
        }

        // Find which chunk contains the current word index
        this.currentChunkIndex = this.findChunkForWordIndex(this.currentWordIndex);
        this.updateButtonUI('pause');
        this.playCurrentChunk();
    }

    pauseReading() {
        this.isPaused = true;
        // Record where we are in the buffer
        this.pausePosition = this.getCurrentPlaybackTime();
        this.stopSourceNode();
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.updateButtonUI('play');
        // Keep highlighter visible at current position
        this.updateFloatingHighlighter(this.currentWordIndex);
    }

    resumeReading() {
        this.isPaused = false;
        this.updateButtonUI('pause');
        if (this.currentAudioBuffer) {
            // Resume from the paused position within the same buffer
            this.startSourceNode(this.currentAudioBuffer, this.pausePosition);
            this.trackPlayback();
        } else {
            // If buffer was cleaned up, restart from current chunk
            this.playCurrentChunk();
        }
    }

    stopReading() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentWordIndex = 0;
        this.currentChunkIndex = 0;

        // Stop audio source node
        this.stopSourceNode();
        this.currentAudioBuffer = null;

        // Cancel animation frame
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Clear pre-synthesized buffer
        this.nextChunkBuffer = null;
        this.nextChunkDuration = 0;

        this.updateButtonUI('play');
        this.highlighters.forEach(h => h.remove());
        this.highlighters = [];
        this.updateProgress();

        // Reset mobile UI
        const isMobile = window.innerWidth <= 600;
        if (isMobile) {
            const readerContainer = document.getElementById('reader-container-vertical');
            const mobileProgress = document.getElementById('mobile-progress-container');

            if (mobileProgress) {
                mobileProgress.classList.remove('active');
            }

            setTimeout(() => {
                if (readerContainer) {
                    readerContainer.classList.remove('expanded');
                }
            }, 400);
        }
    }

    // ─────────────────────────────────────────────────
    //  Seek to a specific word index (from progress bar drag)
    // ─────────────────────────────────────────────────

    seekToWordIndex(wordIndex) {
        // Increment generation to cancel any in-flight async playCurrentChunk
        this._playbackGen++;

        // Stop current playback
        this.stopSourceNode();
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        const targetChunk = this.findChunkForWordIndex(wordIndex);

        // Keep currentAudioBuffer if seeking within the same chunk (instant seek)
        if (targetChunk !== this.currentChunkIndex) {
            // Check if the target chunk was already synthesized (cached on the chunk object)
            const cached = this.sentenceChunks[targetChunk];
            this.currentAudioBuffer = cached._audioBuffer || null;
        }

        // Update indices and restart
        this.currentWordIndex = wordIndex;
        this.currentChunkIndex = targetChunk;
        this.playCurrentChunk();
    }

    // ─────────────────────────────────────────────────
    //  Core Synthesis & Playback
    // ─────────────────────────────────────────────────

    async playCurrentChunk() {
        const myGen = this._playbackGen;

        if (this.isPaused || this.currentChunkIndex >= this.sentenceChunks.length) {
            if (this.currentChunkIndex >= this.sentenceChunks.length) {
                this.stopReading();
            }
            return;
        }

        const chunk = this.sentenceChunks[this.currentChunkIndex];
        this.chunkStartWordIndex = chunk.wordStartIdx;

        try {
            let audioBuffer, audioDuration;

            // 1. Reuse current buffer (same chunk seek or pause/resume)
            if (this.currentAudioBuffer) {
                audioBuffer = this.currentAudioBuffer;
                audioDuration = this.currentAudioBuffer.duration;
            // 2. Check chunk-level cache (previously synthesized)
            } else if (chunk._audioBuffer) {
                audioBuffer = chunk._audioBuffer;
                audioDuration = audioBuffer.duration;
            // 3. Use pre-synthesized next-chunk buffer
            } else if (this.nextChunkBuffer) {
                audioBuffer = this.nextChunkBuffer;
                audioDuration = this.nextChunkDuration;
                this.nextChunkBuffer = null;
                this.nextChunkDuration = 0;
            } else {
                // 4. Synthesize from scratch
                const result = await this.synthesizeChunk(chunk.text);

                // RACE CHECK: bail out if a newer seek/stop happened during synthesis
                if (myGen !== this._playbackGen) return;

                audioBuffer = result.audioBuffer;
                audioDuration = result.duration;
            }

            // Cache on the chunk object so future seeks to this chunk are instant
            chunk._audioBuffer = audioBuffer;
            this.currentAudioBuffer = audioBuffer;

            // Calculate word timings for this chunk
            this.chunkWordTimings = this.calculateWordTimings(chunk.words, audioDuration);

            // Set the current word index to the start of this chunk
            // (unless we're seeking into the middle of a chunk)
            if (this.currentWordIndex < chunk.wordStartIdx || this.currentWordIndex > chunk.wordEndIdx) {
                this.currentWordIndex = chunk.wordStartIdx;
            }

            // Calculate the audio offset for seeking within the chunk
            let startOffset = 0;
            const offsetInChunk = this.currentWordIndex - chunk.wordStartIdx;
            if (offsetInChunk > 0 && offsetInChunk < this.chunkWordTimings.length) {
                startOffset = this.chunkWordTimings[offsetInChunk].startTime;
            }

            // Immediately show highlighter at the correct position
            this.updateFloatingHighlighter(this.currentWordIndex);

            // RACE CHECK: bail out if a newer seek happened during computation
            if (myGen !== this._playbackGen) return;

            // Play using AudioBufferSourceNode — start(when, offset) is precise!
            this.startSourceNode(audioBuffer, startOffset);

            // Start tracking playback for highlighter sync
            this.trackPlayback();

            // Pre-synthesize upcoming chunks in background
            this.preSynthesizeNextChunks();

        } catch (err) {
            if (myGen !== this._playbackGen) return; // Stale, ignore
            console.error('Error playing chunk:', err);
            // Try next chunk
            this.currentChunkIndex++;
            if (this.currentChunkIndex < this.sentenceChunks.length) {
                this.currentWordIndex = this.sentenceChunks[this.currentChunkIndex].wordStartIdx;
                this.playCurrentChunk();
            } else {
                this.stopReading();
            }
        }
    }

    async synthesizeChunk(text) {
        if (!this.tts || !this.piperReady) {
            throw new Error('Piper TTS not initialized');
        }

        // Generate WAV audio from text
        const wavBlob = await this.tts.predict({
            text: text,
            voiceId: this.voiceId
        });

        // Decode into an AudioBuffer (used directly by AudioBufferSourceNode)
        const arrayBuffer = await wavBlob.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        return { audioBuffer, duration: audioBuffer.duration };
    }

    async preSynthesizeNextChunks() {
        // Pre-synthesize 2 chunks ahead for smoother playback
        for (let offset = 1; offset <= 2; offset++) {
            const idx = this.currentChunkIndex + offset;
            if (idx >= this.sentenceChunks.length) break;

            const chunk = this.sentenceChunks[idx];
            // Skip if already cached
            if (chunk._audioBuffer) continue;

            try {
                const result = await this.synthesizeChunk(chunk.text);
                // Only store if we haven't moved past this chunk
                if (this.currentChunkIndex + offset === idx) {
                    chunk._audioBuffer = result.audioBuffer;
                    // Also store as the immediate-next buffer for the playback path
                    if (offset === 1) {
                        this.nextChunkBuffer = result.audioBuffer;
                        this.nextChunkDuration = result.duration;
                    }
                }
            } catch (err) {
                console.warn('Pre-synthesis failed:', err);
                break; // Don't try further if one fails
            }
        }
    }

    // ─────────────────────────────────────────────────
    //  Word Timing Calculation
    //  Distributes sentence duration across words
    //  proportionally by character length + punctuation pauses
    // ─────────────────────────────────────────────────

    calculateWordTimings(words, totalDuration) {
        const timings = [];
        if (words.length === 0 || totalDuration <= 0) return timings;

        // Calculate weighted character count for each word
        const weights = words.map(word => {
            let weight = word.length;

            // Punctuation at end of word adds a small pause
            if (/[.,;:]$/.test(word)) weight += 2;
            if (/[!?]$/.test(word)) weight += 3;

            // Long words get slightly less per-char weight (they're spoken faster proportionally)
            if (word.length > 10) weight = word.length * 0.85;

            return Math.max(weight, 1);
        });

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let currentTime = 0;

        for (let i = 0; i < words.length; i++) {
            const wordDuration = (weights[i] / totalWeight) * totalDuration;
            timings.push({
                startTime: currentTime,
                endTime: currentTime + wordDuration
            });
            currentTime += wordDuration;
        }

        return timings;
    }

    // ─────────────────────────────────────────────────
    //  Playback Tracking — requestAnimationFrame loop
    //  Syncs the floating highlighter with audio.currentTime
    // ─────────────────────────────────────────────────

    trackPlayback() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        const tick = () => {
            if (!this.sourceNode || this.isPaused || !this.isPlaying || this.isDragging) {
                return;
            }

            const currentTime = this.getCurrentPlaybackTime();
            const chunk = this.sentenceChunks[this.currentChunkIndex];
            if (!chunk) return;

            // Find which word we're currently on based on audio time
            let localWordIdx = 0;
            for (let i = 0; i < this.chunkWordTimings.length; i++) {
                if (currentTime >= this.chunkWordTimings[i].startTime) {
                    localWordIdx = i;
                }
            }

            const globalWordIdx = chunk.wordStartIdx + localWordIdx;

            if (globalWordIdx !== this.currentWordIndex) {
                this.currentWordIndex = globalWordIdx;
                this.updateProgress();
                this.updateFloatingHighlighter(this.currentWordIndex);
            }

            this.rafId = requestAnimationFrame(tick);
        };

        this.rafId = requestAnimationFrame(tick);
    }

    // ─────────────────────────────────────────────────
    //  Utility: Find which chunk contains a given word index
    // ─────────────────────────────────────────────────

    findChunkForWordIndex(wordIndex) {
        for (let i = 0; i < this.sentenceChunks.length; i++) {
            const chunk = this.sentenceChunks[i];
            if (wordIndex >= chunk.wordStartIdx && wordIndex <= chunk.wordEndIdx) {
                return i;
            }
        }
        return 0;
    }

    // ─────────────────────────────────────────────────
    //  Web Audio API — AudioBufferSourceNode helpers
    //  Used instead of Audio element for reliable seeking
    // ─────────────────────────────────────────────────

    /**
     * Start playing an AudioBuffer from the given offset (in seconds).
     * Uses AudioBufferSourceNode.start(when, offset) for precise positioning.
     */
    startSourceNode(audioBuffer, offset = 0) {
        // Stop any existing source first
        this.stopSourceNode();

        // CRITICAL: Reset the flag so the new source's onended
        // won't think it was a manual stop
        this._stoppedManually = false;
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = audioBuffer;
        this.sourceNode.connect(this.audioContext.destination);

        // Record timing marks
        this.playStartMark = this.audioContext.currentTime;
        this.playOffset = offset;

        // Handle natural end of playback (not manual stop)
        this.sourceNode.onended = () => {
            if (this._stoppedManually) {
                this._stoppedManually = false;
                return;
            }
            if (this.isDragging || this.isPaused) return;

            // Move to next chunk
            this.currentChunkIndex++;
            this.currentAudioBuffer = null;
            if (this.currentChunkIndex < this.sentenceChunks.length) {
                this.currentWordIndex = this.sentenceChunks[this.currentChunkIndex].wordStartIdx;
                this.playCurrentChunk();
            } else {
                this.stopReading();
            }
        };

        // Start playback from the specified offset
        this.sourceNode.start(0, offset);
    }

    /**
     * Stop the current AudioBufferSourceNode (sets a flag so onended
     * knows this was a manual stop, not a natural end of audio).
     */
    stopSourceNode() {
        if (this.sourceNode) {
            this._stoppedManually = true;
            try {
                this.sourceNode.stop();
            } catch (e) {
                // Already stopped — ignore
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
    }

    /**
     * Get the current playback position in seconds, relative to
     * the start of the current chunk's AudioBuffer.
     */
    getCurrentPlaybackTime() {
        if (!this.sourceNode || !this.audioContext) return this.pausePosition || 0;
        return this.audioContext.currentTime - this.playStartMark + this.playOffset;
    }

    // ─────────────────────────────────────────────────
    //  Floating Highlighter (unchanged logic)
    // ─────────────────────────────────────────────────

    updateFloatingHighlighter(index) {
        // Remove old highlighters
        this.highlighters.forEach(h => h.remove());
        this.highlighters = [];

        // Get previous, current, and next word for 3-word highlight
        const prevWord = index > 0 ? this.wordElements[index - 1] : null;
        const currentWord = this.wordElements[index];
        const nextWord = index < this.wordElements.length - 1 ? this.wordElements[index + 1] : null;

        if (!currentWord) return;

        const articleContent = document.getElementById('article-content');

        // Use prev, current, next for broader highlight flow
        const words = [prevWord, currentWord, nextWord].filter(w => w !== null);

        // Group words by line (handle line wrapping)
        const lineGroups = [];
        let currentLine = [];
        let lastTop = null;

        words.forEach(word => {
            const rect = word.getBoundingClientRect();
            if (rect.width === 0) return;

            const top = Math.round(rect.top);

            if (lastTop === null || Math.abs(top - lastTop) < 5) {
                currentLine.push(word);
            } else {
                if (currentLine.length > 0) lineGroups.push(currentLine);
                currentLine = [word];
            }
            lastTop = top;
        });

        if (currentLine.length > 0) {
            lineGroups.push(currentLine);
        }

        // Create highlighter for each line
        lineGroups.forEach(lineWords => {
            const firstWord = lineWords[0];
            const lastWord = lineWords[lineWords.length - 1];

            const firstRect = firstWord.getBoundingClientRect();
            const lastRect = lastWord.getBoundingClientRect();
            const contentRect = articleContent.getBoundingClientRect();

            const highlighter = document.createElement('div');
            highlighter.className = 'floating-highlighter';

            // Calculate position relative to the container
            const left = firstRect.left - contentRect.left;
            const top = firstRect.top - contentRect.top;
            const width = lastRect.right - firstRect.left;
            const height = Math.max(firstRect.height, lastRect.height);

            highlighter.style.left = `${left}px`;
            highlighter.style.top = `${top}px`;
            highlighter.style.width = `${width}px`;
            highlighter.style.height = `${height}px`;

            articleContent.appendChild(highlighter);
            this.highlighters.push(highlighter);
        });
    }

    // ─────────────────────────────────────────────────
    //  Progress Bar Update (unchanged logic)
    // ─────────────────────────────────────────────────

    updateProgress() {
        if (this.words.length === 0) return;
        const progress = (this.currentWordIndex / this.words.length) * 100;

        // Update vertical progress bar (desktop/tablet)
        const progressFillVertical = document.getElementById('progress-fill-vertical');
        if (progressFillVertical) {
            progressFillVertical.style.height = `${progress}%`;
        }

        // Update horizontal progress bar (mobile)
        const progressFillHorizontal = document.getElementById('progress-fill-horizontal');
        if (progressFillHorizontal) {
            progressFillHorizontal.style.width = `${progress}%`;
        }
    }

    // ─────────────────────────────────────────────────
    //  Button UI (unchanged logic)
    // ─────────────────────────────────────────────────

    updateButtonUI(state) {
        const btn = document.getElementById('play-pause-btn-circle');
        if (state === 'pause') {
            btn.classList.add('playing'); // Add class for red background
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        } else {
            btn.classList.remove('playing'); // Remove class for black background
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        }
    }
}

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
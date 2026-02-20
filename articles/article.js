// 1. Import Firebase Firestore functions
import { 
    getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, query, where, getDocs, orderBy, collection
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Import your custom functions and auth
import { getArticleById, getLocalRelatedArticles, auth, app } from '/Article/firebase-db.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
    if (article) {
        updateSocialMetaTags(article); // THE NEW CALL
    }
    window.currentArticleData = article;

    if (!article) {
        document.querySelector('.main').innerHTML = "<h1 style='text-align:center;'>Article not found.</h1>";
        return;
    }

    // --- NEW: STORE CONTENT VERSIONS ---
    // We check if the specific field exists, otherwise fallback to standard content or a placeholder
    contentVersions.intermediate = article.content || "";
    
    contentVersions.beginner = article.contentBeginner 
        ? article.contentBeginner 
        : "<p><em>(Beginner version not available for this article. Showing standard content.)</em></p>" + article.content;

    contentVersions.pro = article.contentPro 
        ? article.contentPro 
        : "<p><em>(Pro version not available for this article. Showing standard content.)</em></p>" + article.content;
    // -----------------------------------


    // --- NEW: INCREMENT VIEW COUNT ---
    try {
        const articleRef = doc(db, "articles", articleId);
        await updateDoc(articleRef, {
            "stats.views": increment(1)
        });
        console.log("📈 View recorded");
    } catch (e) {
        console.error("Error updating view count:", e);
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

    initLikeButton(articleId);
    
    // 5. LOAD RELATED (This triggers the second skeleton logic)
    if (article.tags && article.tags.length > 0) {
        loadRelated(article.tags, article.id);
    }

// 6. CHECK IF USER IS ADMIN OR AUTHOR -> OVERRIDE HEADER BUTTON
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
                            <a href="article.html?id=${item.id}">
                                <img class="rel-img" src="${item.imageUrl || '/assets/default.png'}" alt="Related Image">
                            </a>
                            <h3><a href="article.html?id=${item.id}">${item.title}</a></h3>
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

async function initLikeButton(articleId) {
    const likeBtn = document.getElementById('like-btn');
    const likeIcon = document.getElementById('like-icon');
    
    if (!likeBtn || !likeIcon) return;

    const UNFILLED_IMAGE = "/assets/like icon unfilled.png";
    const FILLED_IMAGE = "/assets/like icon filled.png";

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
            if (overlay) overlay.classList.add('active');
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
            } else {
                // LIKE: Update DB and UI
                await updateDoc(userRef, { likedArticles: arrayUnion(articleId) });
                await updateDoc(articleRef, { "stats.likes": increment(1) });
                likeBtn.classList.add('liked');
                likeIcon.src = FILLED_IMAGE;
                // Toggle text to "Liked"
                likeBtn.childNodes[0].textContent = "Liked";
            }
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    });
}




window.toggleEditMode = function() {
    const headerBtn = document.getElementById('openPopupBtn');
    if(headerBtn) headerBtn.style.visibility = 'hidden';
    if (isEditing) return;
    isEditing = true;

    // Elements
    const titleEl = document.getElementById('news-headline');
    const contentEl = document.getElementById('article-content');
    const imgEl = document.getElementById('news-img');
    const toolbar = document.getElementById('edit-toolbar');
    const featuredRow = document.getElementById('featured-edit-row');
    const featuredCheck = document.getElementById('edit-is-featured');

    const deleteBtn = document.getElementById('btn-delete-article');

    // Show toolbar
    if(toolbar) toolbar.classList.remove('hidden');

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
                if(deleteBtn) deleteBtn.style.display = 'block';

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
                if(deleteBtn) deleteBtn.style.display = 'none';
            }
        }
    });

    // Save Originals
    originalTitle = titleEl.value; 
    originalContent = contentEl.value;
    originalImageSrc = imgEl.src;

    // 1. Make tags editable without a toolbar
    titleEl.contentEditable = "true";
    titleEl.style.border = "2px dashed #ccc"; // Visual hint
    
    contentEl.contentEditable = "true";
    contentEl.style.border = "2px dashed #ccc"; // Visual hint

    // 2. Show the Save/Cancel bar
    if(toolbar) toolbar.classList.remove('hidden');

    // 1. Set Featured Checkbox state
    if (window.currentArticleData && featuredCheck) {
        featuredCheck.checked = window.currentArticleData.isFeatured === true;
    }

    if(featuredRow) featuredRow.classList.remove('hidden');

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
};


window.cancelEdit = function() {
    location.reload();// Simple reload to discard changes
};

// Handle Image File Selection
window.handleImageUpdate = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
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
    window.onmousemove = (e) => { if(!isDragging)return; e.preventDefault(); currentX = e.clientX - startX; currentY = e.clientY - startY; updateTrans(); };
    
    // Zoom
    zoomSlider.oninput = (e) => { currentScale = parseFloat(e.target.value); updateTrans(); };

    // Save
    btnSave.onclick = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800; canvas.height = 450;
        const ctx = canvas.getContext('2d');
        const ratio = 800 / cropContainer.clientWidth;
        
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,800,450);
        ctx.save();
        
        const imgWidth = 800;
        const imgHeight = (cropperImg.naturalHeight / cropperImg.naturalWidth) * 800;

        ctx.translate(currentX * ratio, currentY * ratio);
        ctx.translate(imgWidth/2, imgHeight/2);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-imgWidth/2, -imgHeight/2);
        ctx.drawImage(cropperImg, 0, 0, imgWidth, imgHeight);
        ctx.restore();

        // Save to Global var and UI
        newImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('news-img').src = newImageBase64; 
        
        modal.classList.add('hidden');
    };
    
    btnCancel.onclick = () => modal.classList.add('hidden');
}

window.saveArticleChanges = async function() {
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

        // 2. COLLECT DATA
        const updateData = {
            // FIX: Use .innerText for the <h1> tag, not .value
            title: document.getElementById('news-headline').innerText, 
            content: document.getElementById('article-content').innerHTML,
            isFeatured: isFeaturedChecked
        };

        if (newImageBase64) {
            updateData.imageUrl = newImageBase64;
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
window.switchLevel = function(level) {
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


window.deleteArticle = async function() {
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
        window.location.href = "/main/index.html";

    } catch (e) {
        console.error("Error deleting article:", e);
        alert("Failed to delete article: " + e.message);
        btn.innerText = "Delete Article";
        btn.disabled = false;
    }
};










// listener

class ArticleReader {
    constructor() {
        this.isPlaying = false;
        this.isPaused = false;
        this.isDragging = false;
        this.currentWordIndex = 0;
        this.words = [];
        this.wordElements = [];
        this.highlighters = [];
        this.utterance = null;
        this.init();
    }

    init() {
        const playBtn = document.getElementById('play-pause-btn-circle');
        const verticalBar = document.getElementById('progress-bar-vertical');
        const progressHandle = document.getElementById('progress-handle-vertical');
        const readerContainer = document.getElementById('reader-container-vertical');

        playBtn.addEventListener('click', () => {
            const isMobile = window.innerWidth <= 600;
            
            // FIX: Check if words are prepared, if not prepare them first
            if (this.words.length === 0) {
                this.prepareArticleText();
            }
            
            if (!this.isPlaying) {
                // Start playing from current position
                
                // Mobile: animate container to left FIRST, then start playing
                if (isMobile) {
                    readerContainer.classList.add('expanded');
                    
                    // Wait for button to move to left, then change to red and start playing
                    setTimeout(() => {
                        this.startReading();
                        const mobileProgress = document.getElementById('mobile-progress-container');
                        if (mobileProgress) {
                            mobileProgress.classList.add('active');
                        }
                    }, 400); // Wait for button animation to complete
                } else {
                    // Desktop/Tablet: immediate start
                    this.startReading();
                    verticalBar.classList.remove('hidden');
                }
            } else if (this.isPaused) {
                // Resume from paused position
                this.resumeReading();
            } else {
                // Pause at current position
                this.pauseReading();
            }
        });
        
        // Make the vertical progress bar draggable (desktop/tablet)
        this.initDraggableProgress(verticalBar, progressHandle);
        
        // Initialize horizontal progress bar for mobile
        this.initMobileProgressBar();
        
        // Prepare text immediately when initialized (prevents double-click issue)
        // But do it after a small delay to ensure DOM is ready
        setTimeout(() => {
            this.prepareArticleText();
        }, 100);
    }

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
                window.speechSynthesis.cancel();
                this.readWords();
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
                    window.speechSynthesis.cancel();
                    this.readWords();
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
                    window.speechSynthesis.cancel();
                    this.readWords();
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

    initDraggableProgress(progressBar, handle) {
        const seekToPosition = (clientY) => {
            if (!progressBar || this.words.length === 0) return;

            const rect = progressBar.getBoundingClientRect();
            const barHeight = rect.height;
            const offsetY = clientY - rect.top;
            const clampedY = Math.max(0, Math.min(offsetY, barHeight));
            
            // FIX: Invert the calculation - top of bar = 0%, bottom of bar = 100%
            // Since progress-fill grows from bottom, we need to invert the Y position
            const percentage = Math.max(0, Math.min(1, 1 - (clampedY / barHeight)));
            
            let newIndex = Math.floor(percentage * this.words.length);
            if (newIndex >= this.words.length) newIndex = this.words.length - 1;
            if (newIndex < 0) newIndex = 0;
            
            this.currentWordIndex = newIndex;
            this.updateProgress();
            
            // Update highlighter immediately when dragging
            if (!this.isDragging && this.isPlaying && !this.isPaused) {
                window.speechSynthesis.cancel();
                this.readWords();
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
                    window.speechSynthesis.cancel();
                    this.readWords();
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
                    window.speechSynthesis.cancel();
                    this.readWords();
                }
            }
        };

        handle.addEventListener('touchstart', onTouchStart);
        progressBar.addEventListener('touchstart', onTouchStart);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    prepareArticleText() {
        const contentEl = document.getElementById('article-content');
        if (!contentEl) return;
        
        const textBlocks = contentEl.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote');
        this.words = [];
        this.wordElements = [];

        const newContainer = document.createElement('div');

        textBlocks.forEach(block => {
            if (!block.textContent.trim()) return;

            const newBlock = document.createElement(block.tagName);
            newBlock.className = block.className;
            newBlock.style.position = 'relative';
            newBlock.style.zIndex = '2';

            const text = block.textContent;
            const wordsArr = text.split(/(\s+)/);
            
            wordsArr.forEach(word => {
                if (word.trim()) {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = word;
                    this.wordElements.push(span);
                    this.words.push(word);
                    newBlock.appendChild(span);
                } else {
                    newBlock.appendChild(document.createTextNode(word));
                }
            });
            
            newContainer.appendChild(newBlock);
        });

        contentEl.innerHTML = '';
        while (newContainer.firstChild) {
            contentEl.appendChild(newContainer.firstChild);
        }
    }

    startReading() {
        this.isPlaying = true;
        this.isPaused = false;
        if (this.currentWordIndex >= this.words.length) {
            this.currentWordIndex = 0;
        }
        this.updateButtonUI('pause');
        this.readWords();
    }

    pauseReading() {
        this.isPaused = true;
        window.speechSynthesis.cancel();
        this.updateButtonUI('play');
        // Keep highlighter visible at current position
        this.updateFloatingHighlighter(this.currentWordIndex);
    }

    resumeReading() {
        this.isPaused = false;
        this.updateButtonUI('pause');
        this.readWords();
    }

    stopReading() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentWordIndex = 0;
        window.speechSynthesis.cancel();
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

    readWords() {
        if (this.isPaused || this.currentWordIndex >= this.words.length) {
            if (this.currentWordIndex >= this.words.length) {
                this.stopReading();
            }
            return;
        }

        this.updateFloatingHighlighter(this.currentWordIndex);

        const word = this.words[this.currentWordIndex];
        
        if (!window.speechSynthesis) {
            console.error('Speech synthesis not supported');
            return;
        }
        
        this.utterance = new SpeechSynthesisUtterance(word);
        this.utterance.rate = 1.0;
        this.utterance.pitch = 1.0;
        this.utterance.volume = 1.0;
        this.utterance.lang = 'en-US';

        this.utterance.onend = () => {
            if (this.isDragging) return;

            this.currentWordIndex++;
            this.updateProgress();
            setTimeout(() => this.readWords(), 50);
        };

        this.utterance.onerror = (event) => {
            if (event.error === 'interrupted') return;
            if (!this.isDragging) {
                this.currentWordIndex++;
                this.readWords();
            }
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(this.utterance);
    }

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
});
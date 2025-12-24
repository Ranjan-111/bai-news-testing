document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET AUTHOR NAME FROM URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const authorKeyParam = urlParams.get('name'); 

    // --- 2. CHECK DATA SOURCE ---
    if (typeof authorProfiles === 'undefined') {
        console.error("Error: authors-data.js not loaded.");
        document.querySelector('.profile-container').innerHTML = "<h1>Error loading profile data.</h1>";
        return;
    }

    const currentAuthor = authorProfiles[authorKeyParam] || authorProfiles["Priyanshu"];

    if (!currentAuthor) {
        document.querySelector('.profile-container').innerHTML = "<h1>Author not found.</h1>";
        return;
    }

    // --- 3. FILL HEADER DETAILS ---
    document.title = `${currentAuthor.name} | BAI.NEWS`;
    
    const pImage = document.getElementById('p-image');
    if(pImage && currentAuthor.image) pImage.src = currentAuthor.image;
    
    const pName = document.getElementById('p-name');
    if(pName) pName.textContent = currentAuthor.name;
    
    const homeHeaderName = document.getElementById('home-header-name');
    if(homeHeaderName) homeHeaderName.textContent = currentAuthor.name;

    const aboutHeaderName = document.getElementById('about-header-name');
    if(aboutHeaderName) aboutHeaderName.textContent = currentAuthor.name;
    
    const pTag = document.getElementById('p-tag');
    if(pTag) pTag.textContent = currentAuthor.tag;
    
    const pFollowers = document.getElementById('p-followers');
    if(pFollowers) pFollowers.textContent = `${currentAuthor.followers} followers`;

    // --- 4. FILL ABOUT TAB DETAILS ---
    const pBio = document.getElementById('p-bio');
    if(pBio) pBio.textContent = currentAuthor.bio;

    const pEmail = document.getElementById('p-email');
    if(pEmail) pEmail.textContent = currentAuthor.stats?.email || "N/A";

    const pLocation = document.getElementById('p-location');
    if(pLocation) pLocation.textContent = currentAuthor.stats?.location || "N/A";

    // --- 5. FILL SOCIAL LINKS ---
    const getHandle = (url) => {
        try {
            const parts = url.split('/');
            return "@" + parts[parts.length - 1];
        } catch (e) { return "View Profile"; }
    };

    const setSocial = (linkId, textId, linkUrl) => {
        const linkEl = document.getElementById(linkId);
        const textEl = document.getElementById(textId);
        
        if (!linkEl) return;

        if (linkUrl && linkUrl !== "#") {
            linkEl.href = linkUrl;
            linkEl.style.display = "flex"; 
            if(textEl) textEl.textContent = getHandle(linkUrl);
        } else {
            linkEl.style.display = "none"; 
        }
    }

    setSocial('social-link-x', 'social-text-x', currentAuthor.socials?.x);
    setSocial('social-link-li', 'social-text-li', currentAuthor.socials?.linkedin);
    setSocial('social-link-yt', 'social-text-yt', currentAuthor.socials?.youtube);

    // --- 5B. FILL ABOUT TAGS ---
    const tagsContainer = document.getElementById('about-tags-container');
    if (tagsContainer) {
        tagsContainer.innerHTML = ''; 
        if (currentAuthor.aboutTags && Array.isArray(currentAuthor.aboutTags)) {
            currentAuthor.aboutTags.forEach(tagText => {
                const span = document.createElement('span');
                span.className = 'about-tag';
                span.textContent = tagText;
                tagsContainer.appendChild(span);
            });
        }
    }

    // --- 6. FILTER ARTICLES (Tag-Based) ---
    const articlesList = document.getElementById('author-articles-list');
    const articlesCountSpan = document.getElementById('p-articles-count');

    if (typeof articleDatabase === 'undefined') {
        console.error("Article Database not loaded.");
        if(articlesList) articlesList.innerHTML = "<p>Error loading articles.</p>";
        return;
    }

    const nameToSearch = currentAuthor.name.toLowerCase();
    const authorArticles = articleDatabase.filter(article => {
        const tags = (article.tags || "").toLowerCase();
        return tags.includes(nameToSearch);
    });

    if(articlesCountSpan) {
        articlesCountSpan.textContent = `${authorArticles.length} articles`;
    }

    if(articlesList) {
        if (authorArticles.length === 0) {
            articlesList.innerHTML = `<div style="padding:20px; background:#f9f9f9; border-radius:8px; color:#666;">No articles found.</div>`;
        } else {
            articlesList.innerHTML = authorArticles.map(article => `
                <a href="../docs/index.html" class="auth-article-card">
                    <img src="../assets/img1.jpg" alt="Article Thumb"> 
                    <div class="auth-card-content">
                        <h3>${article.title}</h3>
                        <p>${article.summary}</p>
                        <span class="auth-date">${article.date}</span>
                    </div>
                </a>
                <hr style="border:0; border-top:1px solid #f5f5f5; margin-bottom:2rem;">
            `).join('');
        }
    }

    // --- 7. AUTOMATE FOLLOWING SIDEBAR ---
    const followingContainer = document.getElementById('following-list');
    const seeAllLink = document.getElementById('see-all-count');

    if (followingContainer && typeof authorProfiles !== 'undefined') {
        followingContainer.innerHTML = '';
        const allAuthors = Object.values(authorProfiles);
        const otherAuthors = allAuthors.filter(auth => auth.name !== currentAuthor.name);

        if (otherAuthors.length === 0) {
            followingContainer.innerHTML = '<p style="color:#888;">No other authors.</p>';
        } else {
            otherAuthors.forEach(auth => {
                const card = document.createElement('div');
                card.className = 'following-card';
                card.innerHTML = `
                    <a href="author.html?name=${auth.name}" style="display:flex; align-items:center; gap:12px; flex-grow:1;">
                        <img src="${auth.image}" alt="${auth.name}">
                        <div class="f-info">
                            <h4>${auth.name}</h4>
                            <p>${auth.tag}</p>
                        </div>
                    </a>
                    <button class="btn-sm-follow">Follow</button>
                `;
                followingContainer.appendChild(card);
            });
        }
        if (seeAllLink) seeAllLink.textContent = `See all (${allAuthors.length})`;
    }

    // --- 8. MAIN FOLLOW BUTTON LOGIC (NEW!) ---
    const followBtn = document.querySelector('.follow-btn');
    
    // Safety Check: Ensure button exists
    if (followBtn) {
        const storageKey = `isFollowing_${currentAuthor.name}`; // e.g. "isFollowing_Priyanshu"
        
        // A. Check State on Load
        if (localStorage.getItem(storageKey) === 'true') {
            setFollowedState();
        } else {
            setUnfollowedState();
        }

        // B. Handle Click
        followBtn.addEventListener('click', () => {
            const isFollowing = followBtn.classList.contains('following');
            
            if (isFollowing) {
                // UNFOLLOW
                localStorage.removeItem(storageKey);
                setUnfollowedState();
            } else {
                // FOLLOW
                localStorage.setItem(storageKey, 'true');
                setFollowedState();
            }
        });

        // Helpers
        function setFollowedState() {
            followBtn.textContent = 'Following';
            followBtn.classList.add('following');
        }

        function setUnfollowedState() {
            followBtn.textContent = 'Follow';
            followBtn.classList.remove('following');
        }
    }

    // --- 9. TAB SWITCHING LOGIC ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = `tab-${btn.dataset.tab}`;
            const targetContent = document.getElementById(targetId);
            if(targetContent) {
                targetContent.classList.remove('hidden');
                targetContent.classList.add('active');
            }
        });
    });
});
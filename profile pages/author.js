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
    if (pImage && currentAuthor.image) pImage.src = currentAuthor.image;

    const pName = document.getElementById('p-name');
    if (pName) pName.textContent = currentAuthor.name;

    const homeHeaderName = document.getElementById('home-header-name');
    if (homeHeaderName) homeHeaderName.textContent = currentAuthor.name;

    const aboutHeaderName = document.getElementById('about-header-name');
    if (aboutHeaderName) aboutHeaderName.textContent = currentAuthor.name;

    const pTag = document.getElementById('p-tag');
    if (pTag) pTag.textContent = currentAuthor.tag;

    const pFollowers = document.getElementById('p-followers');
    if (pFollowers) pFollowers.textContent = `${currentAuthor.followers} followers`;

    // --- 4. INIT MAIN FOLLOW BUTTON (Header) ---
    // We attach the author's name to the button so our Global Click Listener knows who to follow
    const mainFollowBtn = document.querySelector('.profile-header .follow-btn');
    if (mainFollowBtn) {
        mainFollowBtn.dataset.author = currentAuthor.name; // Attach "Priyanshu" to button
        updateFollowButtonState(mainFollowBtn, currentAuthor.name); // Check storage immediately
    }

    // --- 5. FILL ABOUT DETAILS ---
    const pBio = document.getElementById('p-bio');
    if (pBio) pBio.textContent = currentAuthor.bio;

    const pEmail = document.getElementById('p-email');
    if (pEmail) pEmail.textContent = currentAuthor.stats?.email || "N/A";

    const pLocation = document.getElementById('p-location');
    if (pLocation) pLocation.textContent = currentAuthor.stats?.location || "N/A";

    // --- 6. FILL SOCIAL LINKS ---
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
            if (textEl) textEl.textContent = getHandle(linkUrl);
        } else {
            linkEl.style.display = "none";
        }
    }

    setSocial('social-link-x', 'social-text-x', currentAuthor.socials?.x);
    setSocial('social-link-li', 'social-text-li', currentAuthor.socials?.linkedin);
    setSocial('social-link-yt', 'social-text-yt', currentAuthor.socials?.youtube);

    // --- 7. FILL ABOUT TAGS ---
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

    // --- 8. FILTER ARTICLES (Tag-Based) ---
    const articlesList = document.getElementById('author-articles-list');
    const articlesCountSpan = document.getElementById('p-articles-count');

    if (typeof articleDatabase !== 'undefined') {
        const nameToSearch = currentAuthor.name.toLowerCase();
        const authorArticles = articleDatabase.filter(article => {
            const tags = (article.tags || "").toLowerCase();
            return tags.includes(nameToSearch);
        });

        if (articlesCountSpan) articlesCountSpan.textContent = `${authorArticles.length} articles`;

        if (articlesList) {
            if (authorArticles.length === 0) {
                articlesList.innerHTML = `<div style="padding:20px; color:#666;">No articles found.</div>`;
            } else {
                articlesList.innerHTML = authorArticles.map(article => `
                    <a href="../main/index.html" class="auth-article-card">
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
    }

    // --- 9. AUTOMATE FOLLOWING SIDEBAR ---
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

                // IMPORTANT: We add class="follow-btn" and data-author="Name"
                card.innerHTML = `
                    <a href="author.html?name=${auth.name}" style="display:flex; align-items:center; gap:12px; flex-grow:1;">
                        <img src="${auth.image}" alt="${auth.name}" style="object-fit: cover; object-position: center;">
                        <div class="f-info">
                            <h4>${auth.name}</h4>
                            <p>${auth.tag}</p>
                        </div>
                    </a>
                    <button class="follow-btn" data-author="${auth.name}">Follow</button>
                `;

                // Check state immediately for this button
                const btn = card.querySelector('.follow-btn');
                updateFollowButtonState(btn, auth.name);

                followingContainer.appendChild(card);
            });
        }
        if (seeAllLink) seeAllLink.textContent = `See all (${allAuthors.length})`;
    }

    // --- 10. GLOBAL FOLLOW BUTTON CLICK LISTENER ---
    // This handles clicks for BOTH the main button AND sidebar buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('follow-btn')) {
            const btn = e.target;
            const authorName = btn.dataset.author; // Gets "Priyanshu" or "Tiara"

            if (!authorName) return;

            const storageKey = `isFollowing_${authorName}`;
            const isFollowing = localStorage.getItem(storageKey) === 'true';

            if (isFollowing) {
                // UNFOLLOW
                localStorage.removeItem(storageKey);
            } else {
                // FOLLOW
                localStorage.setItem(storageKey, 'true');
            }

            // Update UI immediately
            updateFollowButtonState(btn, authorName);
        }
    });

    // --- HELPER: Update UI based on Storage ---
    function updateFollowButtonState(btn, authorName) {
        const storageKey = `isFollowing_${authorName}`;
        const isFollowing = localStorage.getItem(storageKey) === 'true';

        if (isFollowing) {
            btn.textContent = 'Following';
            btn.classList.add('following');
        } else {
            btn.textContent = 'Follow';
            btn.classList.remove('following');
        }
    }

    // --- 11. TAB SWITCHING ---
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
            if (targetContent) {
                targetContent.classList.remove('hidden');
                targetContent.classList.add('active');
            }
        });
    });
});
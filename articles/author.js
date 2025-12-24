document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET AUTHOR NAME FROM URL ---
    // Example: author.html?name=Priyanshu
    const urlParams = new URLSearchParams(window.location.search);
    const authorKeyParam = urlParams.get('name'); 

    // --- 2. CHECK DATA SOURCE ---
    // We check if authorProfiles is loaded from authors-data.js
    if (typeof authorProfiles === 'undefined') {
        console.error("Error: authors-data.js not loaded.");
        document.querySelector('.profile-container').innerHTML = "<h1>Error loading profile data.</h1>";
        return;
    }

    // Select the author object based on URL, or default to null
    // If no name param is provided, you might want a default or just show nothing.
    // For now, if no param, we try "Priyanshu" as a fallback for testing.
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
    
    // Updates "About [Name]" and "Latest Articles from [Name]" headers
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

    // Use optional chaining for stats, in case some authors don't have them
    const pEmail = document.getElementById('p-email');
    if(pEmail) pEmail.textContent = currentAuthor.stats?.email || "N/A";

    const pLocation = document.getElementById('p-location');
    if(pLocation) pLocation.textContent = currentAuthor.stats?.location || "N/A";

    
    // --- 5. FILL SOCIAL LINKS ---
    // Helper to format handle (e.g. x.com/priyanshu -> @priyanshu)
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
            linkEl.style.display = "flex"; // Show row
            if(textEl) textEl.textContent = getHandle(linkUrl);
        } else {
            linkEl.style.display = "none"; // Hide row
        }
    }

    setSocial('social-link-x', 'social-text-x', currentAuthor.socials?.x);
    setSocial('social-link-li', 'social-text-li', currentAuthor.socials?.linkedin);
    setSocial('social-link-yt', 'social-text-yt', currentAuthor.socials?.youtube);


    // --- 6. FILL ABOUT TAGS (NEW) ---
    const tagsContainer = document.getElementById('about-tags-container');
    
    if (tagsContainer) {
        // 1. Clear any existing content
        tagsContainer.innerHTML = ''; 

        // 2. Check if author has tags
        if (currentAuthor.aboutTags && Array.isArray(currentAuthor.aboutTags)) {
            
            // 3. Loop through tags and create spans
            currentAuthor.aboutTags.forEach(tagText => {
                const span = document.createElement('span');
                span.className = 'about-tag'; // Uses your existing CSS class
                span.textContent = tagText;
                tagsContainer.appendChild(span);
            });
            
        } else {
            // Optional: Hide container if no tags exist
            tagsContainer.style.display = 'none';
        }
    }


    // --- 7. FILTER ARTICLES (Tag-Based) ---
    const articlesList = document.getElementById('author-articles-list');
    const articlesCountSpan = document.getElementById('p-articles-count');

    if (typeof articleDatabase === 'undefined') {
        console.error("Article Database not loaded.");
        if(articlesList) articlesList.innerHTML = "<p>Error loading articles.</p>";
        return;
    }

    // Logic: matching if the 'tags' string contains the author name.
    const nameToSearch = currentAuthor.name.toLowerCase();

    const authorArticles = articleDatabase.filter(article => {
        const tags = (article.tags || "").toLowerCase();
        return tags.includes(nameToSearch);
    });

    // Update Article Count
    if(articlesCountSpan) {
        articlesCountSpan.textContent = `${authorArticles.length} articles`;
    }

    // Render Articles
    if(articlesList) {
        if (authorArticles.length === 0) {
            articlesList.innerHTML = `
                <div style="padding:20px; background:#f9f9f9; border-radius:8px; color:#666;">
                    No articles found for <strong>${currentAuthor.name}</strong> yet.
                    <br><small>Make sure the article tags in 'multi-article-data.js' include "${nameToSearch}".</small>
                </div>`;
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

    // --- 8. TAB SWITCHING LOGIC ---
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

    // --- 9. AUTOMATE FOLLOWING SIDEBAR (NEW) ---
    const followingContainer = document.getElementById('following-list');
    const seeAllLink = document.getElementById('see-all-count');

    if (followingContainer && typeof authorProfiles !== 'undefined') {
        // 1. Clear container
        followingContainer.innerHTML = '';

        // 2. Get all authors EXCEPT the current one
        // Object.values converts { "A": {...}, "B": {...} } into [ {...}, {...} ]
        const allAuthors = Object.values(authorProfiles);
        const otherAuthors = allAuthors.filter(auth => auth.name !== currentAuthor.name);

        // 3. Generate HTML for each
        if (otherAuthors.length === 0) {
            followingContainer.innerHTML = '<p style="color:#888; font-size:0.9rem;">No other authors found.</p>';
        } else {
            otherAuthors.forEach(auth => {
                // Create Card
                const card = document.createElement('div');
                card.className = 'following-card';
                
                // We link to their profile so clicking switches the view
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

        // 4. Update "See all" count
        if (seeAllLink) {
            seeAllLink.textContent = `See all (${allAuthors.length})`;
        }
    }
}); // End of DOMContentLoaded

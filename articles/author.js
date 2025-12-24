document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET AUTHOR NAME FROM URL ---
    // Example: author.html?name=Priyanshu
    const urlParams = new URLSearchParams(window.location.search);
    const authorKeyParam = urlParams.get('name'); 

    // Define Profiles (You can expand this list)
    // If name is not in URL, we default to "Priyanshu" for testing
    const authorProfiles = {
        "Priyanshu": {
            name: "Priyanshu",
            tag: "@priyanshu_ai",
            image: "../assets/author-profile.jpeg",
            followers: "1.2K",
            bio: "Tech Journalist & AI Enthusiast. Covering the future of deep learning, sustainable energy, and the global economy.",
            socials: {
                x: "#", 
                linkedin: "#",
                youtube: "#"
            }
        },
        "Tiara": {
            name: "Tiara",
            tag: "@tiara_research",
            image: "../assets/img2.jpg", // Placeholder
            followers: "850",
            bio: "Deep dive researcher focused on blockchain forensics and decentralized finance systems.",
            socials: { x: "#", linkedin: "#" }
        }
    };

    // Select the author object
    // If param exists use it, otherwise default to Priyanshu
    const currentAuthor = authorProfiles[authorKeyParam] || authorProfiles["Priyanshu"];

    if (!currentAuthor) {
        document.querySelector('.profile-container').innerHTML = "<h1>Author not found.</h1>";
        return;
    }

    // --- 2. FILL PROFILE DETAILS ---
    document.title = `${currentAuthor.name} | BAI.NEWS`;
    
    // Header
    const pImage = document.getElementById('p-image');
    if(pImage) pImage.src = currentAuthor.image;
    
    const pName = document.getElementById('p-name');
    if(pName) pName.textContent = currentAuthor.name;
    
    const pTag = document.getElementById('p-tag');
    if(pTag) pTag.textContent = currentAuthor.tag;
    
    const pFollowers = document.getElementById('p-followers');
    if(pFollowers) pFollowers.textContent = `${currentAuthor.followers} followers`;
    
    // About Tab Bio
    const aboutBio = document.querySelector('.about-bio');
    if(aboutBio) aboutBio.textContent = currentAuthor.bio;

    
    // --- FILL SOCIAL LINKS ---
    const btnX = document.getElementById('social-x');
    const btnLi = document.getElementById('social-li');
    const btnYt = document.getElementById('social-yt');

    function setSocial(btn, link) {
        if (!btn) return;
        if (link && link !== "#") {
            btn.href = link;
            btn.style.display = "flex"; 
        } else {
            btn.style.display = "none"; 
        }
    }

    setSocial(btnX, currentAuthor.socials?.x);
    setSocial(btnLi, currentAuthor.socials?.linkedin);
    setSocial(btnYt, currentAuthor.socials?.youtube);


    // --- 3. FILTER ARTICLES (UPDATED LOGIC) ---
    // This uses the TAGS system you requested
    const articlesList = document.getElementById('author-articles-list');
    const articlesCountSpan = document.getElementById('p-articles-count');

    if (typeof articleDatabase === 'undefined') {
        console.error("Article Database not loaded.");
        if(articlesList) articlesList.innerHTML = "<p>Error loading data.</p>";
        return;
    }

    // SEARCH LOGIC: Filter by Tags using the author's name
    const nameToSearch = currentAuthor.name.toLowerCase();

    const authorArticles = articleDatabase.filter(article => {
        const tags = (article.tags || "").toLowerCase();
        return tags.includes(nameToSearch);
    });

    // Update Article Count Display
    if(articlesCountSpan) {
        articlesCountSpan.textContent = `${authorArticles.length} articles`;
    }

    // Render Articles into the Home Tab
    if(articlesList) {
        if (authorArticles.length === 0) {
            articlesList.innerHTML = `
                <div style="padding:20px; background:#f9f9f9; border-radius:8px; color:#666;">
                    No articles found for <strong>${currentAuthor.name}</strong>.
                    <br><small>Add "${nameToSearch}" to article tags in data.js to see them here.</small>
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

    // --- 4. TAB SWITCHING LOGIC ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate clicked button
            btn.classList.add('active');
            
            // Show corresponding content
            const targetId = `tab-${btn.dataset.tab}`;
            const targetContent = document.getElementById(targetId);
            if(targetContent) {
                targetContent.classList.remove('hidden');
                targetContent.classList.add('active');
            }
        });
    });
});
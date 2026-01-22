// Import auth and db from your config file
import { getFeaturedNews, subscribeLatestNews, auth, db } from '/Article/firebase-db.js';

// Import Auth Listener
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Import Firestore functions (doc, getDoc were missing)
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Featured News Logic
    const featSkeleton = document.getElementById('featured-skeleton');
    const featReal = document.getElementById('featured-real');

    try {
        const featuredArticles = await getFeaturedNews();
        if (featuredArticles.length >= 1) updateFeaturedCard('.Article.LEFT', featuredArticles[0]);
        if (featuredArticles.length >= 2) updateFeaturedCard('.Article.RIGHT', featuredArticles[1]);

        // SWAP FEATURED VIEW
        if (featSkeleton) featSkeleton.classList.add('hidden');
        if (featReal) {
            featReal.classList.remove('hidden');
            featReal.classList.add('fade-in');
        }

    } catch (e) { 
        console.error(e);
        // On error, you might want to hide skeleton anyway or show an error state
        if (featSkeleton) featSkeleton.classList.add('hidden');
    }

    // 2. Latest News Ticker
    initLatestNews();

    // 3. PROMO LOGIC (Banner & Popup)
    initPromoSystem();
});

function initPromoSystem() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Check User Role in DB
                const userRef = doc(db, "users", user.email);
                const snap = await getDoc(userRef);

                if (snap.exists()) {
                    const data = snap.data();
                    
                    // Normalize role to lowercase to avoid "Admin" vs "admin" bugs
                    const userRole = data.role ? data.role.toLowerCase() : "reader";
                    
                    console.log(`👤 Logged in as: ${user.email} | Role: ${userRole}`);

                    // SHOW POPUP ONLY IF:
                    // 1. Not an Author
                    // 2. Not an Admin
                    // 3. Not a Pending Applicant (reporter_candidate)
                    if (userRole !== 'author' && userRole !== 'admin' && userRole !== 'reporter_candidate') {
                        showPromos();
                    } else {
                        console.log("✅ Promo hidden for this role.");
                    }
                }
            } catch (e) {
                console.error("Error checking role:", e);
            }
        }
    });
}
function showPromos() {
    const banner = document.getElementById('promo-banner');
    const popup = document.getElementById('apply-popup');
    const closeBtn = document.getElementById('close-apply-popup');

    // 1. Show Banner immediately
    if (banner) banner.classList.remove('hidden');

    // 2. Show Popup with slight delay (for better UX)
    if (popup) {
        setTimeout(() => {
            // Optional: Check session storage so it doesn't pop up every single refresh
            if (!sessionStorage.getItem('hideApplyPopup')) {
                popup.classList.remove('hidden');
            }
        }, 1000); // 2 second delay

        
    }
}

function updateFeaturedCard(selector, data) {
    const card = document.querySelector(selector);
    if (!card) return;

    const img = card.querySelector('.img');
    if (img && data.imageUrl) img.src = data.imageUrl;

    const title = card.querySelector('h3');
    if (title) title.innerText = data.title;

    const dateEl = card.querySelector('.date');
    if (dateEl && data.datePosted) {
        let dateObj = typeof data.datePosted.toDate === 'function' ? data.datePosted.toDate() : new Date(data.datePosted);
        dateEl.innerText = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const summaryEl = card.querySelector('.info p:not(.date)');
    if (summaryEl && data.summary) summaryEl.innerText = data.summary;

    card.style.cursor = "pointer";
    card.onclick = () => window.location.href = `/articles/article.html?id=${data.id}`;
}

function initLatestNews() {
    const container = document.getElementById('latest-news-container');
    
    // Select the Wrappers
    const skeletonView = document.getElementById('latest-skeleton-view');
    const realView = document.getElementById('latest-real-view');

    if (!container) return;

    // --- A. MOBILE TAP LOGIC ---
    container.addEventListener('click', function(e) {
        if (window.innerWidth > 600) return; // Only for Mobile

        const card = e.target.closest('.news-card');
        if (!card) return; 

        // Check if clicked the Headline Link
        const link = card.querySelector('a');
        if (link && link.contains(e.target)) {
            // IF CLOSED: Stop link, open details
            if (!card.classList.contains('active')) {
                e.preventDefault(); 
                // Close others (Accordion style)
                document.querySelectorAll('.news-card.active').forEach(c => {
                    c.classList.remove('active');
                });
                card.classList.add('active');
            }
            // IF OPEN: Do nothing (let link go to page)
        }
    });

    // --- B. LOAD DATA ---
    subscribeLatestNews((articles) => {
        container.innerHTML = ''; 
        
        if (articles.length === 0) { 
            container.innerHTML = '<p style="padding:20px;">No updates yet.</p>'; 
        } else {
            articles.forEach(article => {
                let dateObj = typeof article.datePosted.toDate === 'function' ? article.datePosted.toDate() : new Date(article.datePosted);
                const timeAgo = getTimeAgo(dateObj);
                const dateString = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                const html = `
                    <section class="timeline-item">
                        <section class="time">${timeAgo}</section>
                        <section class="news-card">
                            <a href="/articles/article.html?id=${article.id}" style="text-decoration:none; color:inherit;">
                                <h3>${article.title}</h3>
                            </a>
                            <section class="details">
                                <p><em>Reported: ${dateString}</em></p>
                                <p><em>${article.summary}</em></p>
                            </section>
                        </section>
                    </section>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }

        // --- C. SWAP VIEWS ---
        // 1. Unhide the container itself (just in case)
        container.classList.remove('hidden');

        // 2. Hide Skeleton Wrapper
        if (skeletonView) skeletonView.classList.add('hidden');
        
        // 3. Show Real Wrapper
        if (realView) {
            realView.classList.remove('hidden');
            realView.classList.add('fade-in');
        }
    });
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 3600;
    if (interval > 24) return Math.floor(interval / 24) + " days";
    if (interval > 1) return Math.floor(interval) + " hours";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins";
    return "Just now";
}
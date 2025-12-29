import { getFeaturedNews, subscribeLatestNews } from '../Article/firebase-db.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Featured News
    try {
        const featuredArticles = await getFeaturedNews();
        if (featuredArticles.length >= 1) updateFeaturedCard('.Article.LEFT', featuredArticles[0]);
        if (featuredArticles.length >= 2) updateFeaturedCard('.Article.RIGHT', featuredArticles[1]);
    } catch (e) { console.error(e); }

    // 2. Latest News Ticker
    initLatestNews();
});

function updateFeaturedCard(selector, data) {
    const card = document.querySelector(selector);
    if (!card) return;

    const img = card.querySelector('.img');
    if (img && data.imageUrl) img.src = data.imageUrl;

    const title = card.querySelector('h3');
    if (title) title.innerText = data.title;

    // --- DATE FIX ---
    const dateEl = card.querySelector('.date');
    if (dateEl && data.datePosted) {
        let dateObj = typeof data.datePosted.toDate === 'function' ? data.datePosted.toDate() : new Date(data.datePosted);
        // Format: 18 Nov 2025
        dateEl.innerText = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // Summary Fix
    const summaryEl = card.querySelector('.info p:not(.date)');
    if (summaryEl && data.summary) summaryEl.innerText = data.summary;

    card.style.cursor = "pointer";
    card.onclick = () => window.location.href = `../articles/article.html?id=${data.id}`;
}

function initLatestNews() {
    const container = document.getElementById('latest-news-container');
    if (!container) return;

    subscribeLatestNews((articles) => {
        container.innerHTML = ''; 
        if (articles.length === 0) { container.innerHTML = '<p style="padding:20px;">No updates yet.</p>'; return; }

        articles.forEach(article => {
            let dateObj = typeof article.datePosted.toDate === 'function' ? article.datePosted.toDate() : new Date(article.datePosted);
            const timeAgo = getTimeAgo(dateObj);
            // Format: 18 Nov 2025
            const dateString = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            const html = `
                <section class="timeline-item">
                    <section class="time">${timeAgo}</section>
                    <section class="news-card">
                        <a href="../articles/article.html?id=${article.id}" style="text-decoration:none; color:inherit;">
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
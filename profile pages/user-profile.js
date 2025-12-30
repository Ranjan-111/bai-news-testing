import { getFirestore, doc, getDoc, getDocs, collection, query, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from '../Article/firebase-db.js';

const db = getFirestore(app);
const auth = getAuth(app);

let allSavedIDs = [];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const nameEl = document.getElementById('user-name-display');
            if(nameEl) nameEl.textContent = user.displayName || "Reader";

            await loadUserProfileData(user.email);
        } else {
            window.location.href = "../main/index.html"; 
        }
    });
});

// ==========================================
// 1. LOAD USER DATA
// ==========================================
async function loadUserProfileData(email) {
    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        
        // A. Handle Saved Articles
        allSavedIDs = userData.savedArticles || [];
        if (allSavedIDs.length > 0) {
            await fetchAndRenderArticles(allSavedIDs.slice(0, 3));
            
            if (allSavedIDs.length > 3) {
                const btn = document.getElementById('load-more-btn');
                btn.style.display = 'block';
                btn.onclick = () => loadMoreArticles();
            }
        } else {
            document.getElementById('saved-articles-list').innerHTML = 
                `<div class="empty-state"><h3>No saved articles</h3><p>Bookmark articles to read them later.</p></div>`;
        }

        // B. Handle Sidebar (Following List)
        const followingEmails = userData.following || [];
        if (followingEmails.length > 0) {
            await renderSidebarFollowing(followingEmails);
        } else {
            document.getElementById('sidebar-following-list').innerHTML = 
                `<div style="color:#999; font-size:14px; text-align:center;">You are not following anyone yet.</div>`;
        }
    }
}

// ==========================================
// 2. RENDER SAVED ARTICLES
// ==========================================
async function fetchAndRenderArticles(idsToFetch) {
    const container = document.getElementById('saved-articles-list');
    if(container.querySelector('.loader')) container.innerHTML = '';

    // Firestore 'in' query supports max 10 items.
    const q = query(collection(db, "articles"), where("serialNumber", "in", idsToFetch));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
         // Handle case where IDs exist in user profile but article docs are missing/deleted
         // container.innerHTML = `<div class="empty-state">Articles unavailable.</div>`;
         return;
    }

    querySnapshot.forEach((doc) => {
        const article = doc.data();
        const html = `
            <a href="../articles/article.html?id=${doc.id}" class="article-card">
                <h3>${article.title || "Untitled Article"}</h3>
                <div class="date">${formatDate(article.datePosted)}</div>
                <p>${article.summary || article.content.substring(0, 150) + "..."}</p>
            </a>
            <hr class="article-separator">
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function loadMoreArticles() {
    const currentCount = document.querySelectorAll('.article-card').length;
    const nextBatch = allSavedIDs.slice(currentCount, currentCount + 3);
    
    if (nextBatch.length > 0) {
        fetchAndRenderArticles(nextBatch);
    }
    
    if (currentCount + nextBatch.length >= allSavedIDs.length) {
        document.getElementById('load-more-btn').style.display = 'none';
    }
}

// ==========================================
// 3. RENDER SIDEBAR (FOLLOWING)
// ==========================================
async function renderSidebarFollowing(emails) {
    const container = document.getElementById('sidebar-following-list');
    container.innerHTML = '';

    // Batch fetch authors (Limit to 10 for sidebar display)
    const emailsToFetch = emails.slice(0, 10);
    const q = query(collection(db, "users"), where("email", "in", emailsToFetch));
    const snapshot = await getDocs(q);

    snapshot.forEach(doc => {
        const author = doc.data();
        const card = createSidebarItem(author);
        container.appendChild(card);
    });
}

function createSidebarItem(author) {
    const div = document.createElement('div');
    div.className = 'reporter-item';
    
    const imgUrl = author.photoURL || '../assets/default-user.png';

    // No buttons, just info
    div.innerHTML = `
        <div class="reporter-avatar" style="background-image: url('${imgUrl}')"></div>
        <div class="reporter-info">
            <div class="reporter-name">${author.displayName}</div>
            <div class="reporter-role">${author.specialization || "Reporter"}</div>
        </div>
    `;
    
    // Optional: Make sidebar items clickable to visit profile
    div.style.cursor = "pointer";
    // div.onclick = () => window.location.href = `../students/author-profile.html?id=${author.email}`;

    return div;
}

// Helper: Format Date
function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
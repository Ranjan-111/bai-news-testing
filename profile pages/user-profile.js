import { getFirestore, doc, getDoc, getDocs, collection, query, where, limit, setDoc, documentId } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
            // Load the FIRST batch of 3
            await loadMoreArticles(); 
        } else {
            document.getElementById('saved-articles-list').innerHTML = 
                `<div class="empty-state"><h3>No saved articles</h3><p>Bookmark articles to read them later.</p></div>`;
            // Hide button if no articles
            toggleLoadMoreButton(false);
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
// 2. RENDER SAVED ARTICLES (Batch Logic)
// ==========================================
async function loadMoreArticles() {
    const container = document.getElementById('saved-articles-list');
    
    // 1. Clear initial loader if present
    if (container.querySelector('.loader') || container.innerHTML.includes('Loading')) {
        container.innerHTML = '';
    }

    // 2. Calculate which articles to fetch next
    const currentCount = container.querySelectorAll('.article-card').length;
    const nextBatchIDs = allSavedIDs.slice(currentCount, currentCount + 3);

    // 3. Fetch and Render them
    if (nextBatchIDs.length > 0) {
        await fetchAndRenderArticles(nextBatchIDs);
    }

    // 4. Button Logic: Check if we have more left to show
    const totalShown = currentCount + nextBatchIDs.length;
    if (totalShown >= allSavedIDs.length) {
        toggleLoadMoreButton(false); // Hide button (All loaded)
    } else {
        toggleLoadMoreButton(true);  // Show button (More remaining)
    }
}

// Helper: Show/Hide the Load More Button
function toggleLoadMoreButton(show) {
    const btnContainer = document.getElementById('load-more-container');
    const btnTrigger = document.getElementById('trigger-load-more');
    
    if (btnContainer && btnTrigger) {
        btnContainer.style.display = show ? 'flex' : 'none'; // Flex keeps your centering
        
        // Remove old listeners and add new one
        btnTrigger.onclick = null; 
        btnTrigger.onclick = (e) => {
            e.preventDefault();
            loadMoreArticles();
        };
    }
}

async function fetchAndRenderArticles(idsToFetch) {
    const container = document.getElementById('saved-articles-list');

    // Firestore 'in' query supports max 10 items.
    const q = query(collection(db, "articles"), where("serialNumber", "in", idsToFetch));
    const querySnapshot = await getDocs(q);

    // Note: 'in' query doesn't return docs in order. We might want to sort them if order matters.
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

// ==========================================
// 3. RENDER SIDEBAR (FOLLOWING) - FIXED FOR IDs
// ==========================================
async function renderSidebarFollowing(followingList) {
    const container = document.getElementById('sidebar-following-list');
    
    if (!container || !auth.currentUser) return;
    if (!followingList || followingList.length === 0) {
        container.innerHTML = '<div style="color:#999; font-size:13px; text-align:center;">You are not following anyone yet.</div>';
        return;
    }

    container.innerHTML = ''; 
    const idsToFetch = followingList.slice(0, 10);
    
    // Query by Document ID (which matches the emails in your following list)
    const q = query(collection(db, "authors"), where(documentId(), "in", idsToFetch));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        container.innerHTML = '<div style="color:#999; font-size:13px;">Following list unavailable.</div>';
        return;
    }

    snapshot.forEach(doc => {
        const authorData = doc.data();
        const authorId = doc.id; // This is "Tiara"
        createSidebarUserItem(container, authorId, authorData, auth.currentUser.email);
    });
}

// Helper: Create the User Item
function createSidebarUserItem(container, targetId, targetData, myEmail) {
    const userDiv = document.createElement('div');
    userDiv.className = 'sidebar-user-item';
    userDiv.style.display = 'flex';
    userDiv.style.alignItems = 'center';
    userDiv.style.justifyContent = 'space-between';
    userDiv.style.marginBottom = '15px';

    const avatarUrl = targetData.photoURL || "../assets/default-user.png";
    const displayName = targetData.displayName || targetId; // Use ID if name missing
    
    const roleText = targetData.specialization || "Reporter";

    // LINK UPDATED: Uses ?id=Tiara
    // FIXED PATH HERE:
    userDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="window.location.href='../profile pages/author.html?id=${encodeURIComponent(targetId)}'">
            <img src="${avatarUrl}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
            <div style="display:flex; flex-direction:column;">
                <span style="font-size:14px; font-weight:600; color:#333;">${displayName}</span>
                <span style="font-size:11px; color:#888;">${roleText}</span>
            </div>
        </div>
    `;

    const btn = document.createElement('button');
    btn.className = 'follow-btn following'; 
    btn.innerText = 'Following';
    
    btn.onclick = async (e) => {
        e.stopPropagation(); 
        await toggleFollowState(btn, myEmail, targetId);
    };

    userDiv.appendChild(btn);
    container.appendChild(userDiv);
}

// Helper: Toggle Follow (Updated for ID)
async function toggleFollowState(btn, myEmail, targetId) {
    const isFollowing = btn.classList.contains('following');
    const myUserRef = doc(db, "users", myEmail);

    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';

    try {
        const userSnap = await getDoc(myUserRef);
        let currentFollowing = userSnap.data().following || [];

        if (isFollowing) {
            // UNFOLLOW
            const newFollowing = currentFollowing.filter(id => id !== targetId);
            await setDoc(myUserRef, { following: newFollowing }, { merge: true });

            btn.classList.remove('following');
            btn.innerText = 'Follow';
        } else {
            // RE-FOLLOW
            if (!currentFollowing.includes(targetId)) {
                currentFollowing.push(targetId);
                await setDoc(myUserRef, { following: currentFollowing }, { merge: true });
            }

            btn.classList.add('following');
            btn.innerText = 'Following';
        }

    } catch (error) {
        console.error("Error toggling follow:", error);
        alert("Action failed.");
    } finally {
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    }
}


// Helper: Format Date
function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
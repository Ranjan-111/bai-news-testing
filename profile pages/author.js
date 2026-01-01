import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from '../Article/firebase-db.js';

const db = getFirestore(app);
const auth = getAuth(app);

let currentViewer = null; 
let authorEmail = null;   // Variable name changed to 'email' for clarity

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Author Email from URL
    const urlParams = new URLSearchParams(window.location.search);
    authorEmail = urlParams.get('id'); // e.g. ?id=priyanshu@gmail.com

    if (!authorEmail) {
        document.querySelector('.profile-container').innerHTML = "<h1>Error: No author specified.</h1>";
        return;
    }

    // 2. Check Viewer Login State
    onAuthStateChanged(auth, (user) => {
        currentViewer = user;
        loadAuthorProfile(authorEmail);
    });
});

// ==========================================
// 1. LOAD AUTHOR DATA
// ==========================================
async function loadAuthorProfile(email) { // <--- Input is named 'email'
    // We look for the document ID which IS the email
    const authorRef = doc(db, "authors", email); 
    const authorSnap = await getDoc(authorRef);

    if (!authorSnap.exists()) {
        document.querySelector('.profile-container').innerHTML = `<h1>Author not found.</h1>`;
        return;
    }

    const data = authorSnap.data();

    // A. Fill UI
    const bannerEl = document.getElementById('p-banner');
    if (data.bannerURL && bannerEl) bannerEl.style.backgroundImage = `url('${data.bannerURL}')`;
    
    const imgEl = document.getElementById('p-image');
    if (data.photoURL && imgEl) imgEl.src = data.photoURL;

    document.getElementById('p-name').textContent = data.displayName || "Reporter";
    document.getElementById('p-role').textContent = data.specialization || "Reporter";
    document.getElementById('p-bio').textContent = data.bio || "No bio available.";
    document.getElementById('p-location').textContent = data.location || "Earth";

    // Stats
    const followersCount = data.followers ? data.followers.length : 0;
    const articlesCount = data.articleCount || 0; 
    
    document.getElementById('p-followers').textContent = `${followersCount} followers`;
    document.getElementById('p-followers-2').textContent = followersCount;
    document.getElementById('p-articles-count').textContent = `${articlesCount} articles`;
    document.getElementById('p-articles-count-2').textContent = articlesCount;

    if (data.joinedDate) {
        const date = data.joinedDate.toDate();
        document.getElementById('p-joined-date').textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    // B. Follow Button Logic
    const followBtn = document.getElementById('main-follow-btn');
    if (currentViewer) {
        const viewerRef = doc(db, "users", currentViewer.email);
        const viewerSnap = await getDoc(viewerRef);
        
        if (viewerSnap.exists()) {
            const viewerData = viewerSnap.data();
            // Check using 'email' variable
            if (viewerData.following && viewerData.following.includes(email)) {
                setFollowButtonState(followBtn, true);
            }
        }
        // FIXED LINE: Use 'email', not 'targetId'
        followBtn.onclick = () => toggleFollow(followBtn, email);
    } else {
        if(followBtn) followBtn.style.display = 'none';
    }

    // C. Load Articles
    loadAuthorArticles(email); // Use 'email'

    // D. Load Sidebar
    loadSidebarSuggestions(email); // Use 'email'
}

// ==========================================
// 2. LOAD ARTICLES (Fixed Query)
// ==========================================
async function loadAuthorArticles(email) { // Input matches the email from loadAuthorProfile
    const container = document.getElementById('author-articles-list');
    container.innerHTML = '';

    // CRITICAL FIX: Change "authorId" to "authorEmail"
    // We are now searching for articles where authorEmail matches the profile ID
    const q = query(collection(db, "articles"), where("authorEmail", "==", email), limit(5));
    
    try {
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div style="color:#777; padding:20px;">No articles yet.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const article = doc.data();
            
            // Format the Date
            let dateStr = "";
            if (article.datePosted) {
                const dateObj = new Date(article.datePosted);
                dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }

            const html = `
                <a href="../articles/article.html?id=${doc.id}" class="article-card">
                    <h3>${article.title}</h3>
                    <div class="article-meta">${dateStr}</div>
                    <p class="article-summary">${article.summary || "No summary available."}</p>
                </a>
                <hr class="article-separator">
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (error) {
        console.error("Error loading articles:", error);
        container.innerHTML = '<div style="color:red; padding:10px;">Error loading articles.</div>';
    }
}

// ==========================================
// 3. LOAD SIDEBAR
// ==========================================
async function loadSidebarSuggestions(currentTargetId) {
    const container = document.getElementById('sidebar-list');
    container.innerHTML = '';

    let followingList = [];
    if (currentViewer) {
        const viewerRef = doc(db, "users", currentViewer.email);
        const viewerSnap = await getDoc(viewerRef);
        if (viewerSnap.exists()) followingList = viewerSnap.data().following || [];
    }

    const q = query(collection(db, "authors"), limit(4));
    const snapshot = await getDocs(q);

    let count = 0;
    snapshot.forEach(doc => {
        const author = doc.data();
        const authorDocId = doc.id; // This is "Tiara"

        if (authorDocId !== currentTargetId && count < 3) {
            const div = document.createElement('div');
            div.className = 'reporter-item';
            
            const isFollowing = followingList.includes(authorDocId);
            const btnText = isFollowing ? "Following" : "Follow";
            const btnClass = isFollowing ? "btn-sm-follow following" : "btn-sm-follow";

            div.innerHTML = `
                <div class="reporter-avatar" style="background-image: url('${author.photoURL || '../assets/default-user.png'}')">
                    <a href="../profile pages/author.html?id=${encodeURIComponent(authorDocId)}" style="display:block; width:100%; height:100%;"></a>
                </div>
                <div class="reporter-info">
                    <h4><a href="../profile pages/author.html?id=${encodeURIComponent(authorDocId)}" style="color:inherit; text-decoration:none;">
                        ${author.displayName || authorDocId}
                    </a></h4>
                    <p>${author.specialization || "Reporter"}</p>
                </div>
                <button class="${btnClass}">${btnText}</button>
            `;

            const btn = div.querySelector('button');
            btn.onclick = (e) => toggleFollow(e.target, authorDocId);

            container.appendChild(div);
            count++;
        }
    });
}

// ==========================================
// 4. FOLLOW LOGIC
// ==========================================
async function toggleFollow(btn, targetId) {
    if (!currentViewer) return;

    const viewerRef = doc(db, "users", currentViewer.email);
    // Important: The doc ID in 'authors' collection MUST be the name "Tiara"
    const authorRef = doc(db, "authors", targetId); 

    const isFollowing = btn.classList.contains('following');
    setFollowButtonState(btn, !isFollowing);

    try {
        if (isFollowing) {
            // Unfollow
            await updateDoc(viewerRef, { following: arrayRemove(targetId) });
            await updateDoc(authorRef, { followers: arrayRemove(currentViewer.email) });
        } else {
            // Follow
            await updateDoc(viewerRef, { following: arrayUnion(targetId) });
            await updateDoc(authorRef, { followers: arrayUnion(currentViewer.email) });
        }
    } catch (e) {
        console.error("Follow error:", e);
        setFollowButtonState(btn, isFollowing); 
        alert("Action failed.");
    }
}

function setFollowButtonState(btn, isFollowing) {
    if (isFollowing) {
        btn.textContent = "Following";
        btn.classList.add('following');
        btn.style.backgroundColor = "#000";
        btn.style.color = "#fff";
    } else {
        btn.textContent = "Follow";
        btn.classList.remove('following');
        btn.style.backgroundColor = "transparent";
        btn.style.color = "#000";
    }
}

function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
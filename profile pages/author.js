import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from '../Article/firebase-db.js';

const db = getFirestore(app);
const auth = getAuth(app);

let currentViewer = null; // The person looking at the page
let authorEmail = null;   // The author being viewed

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
async function loadAuthorProfile(email) {
    // Fetch Author Doc
    const authorRef = doc(db, "users", email);
    const authorSnap = await getDoc(authorRef);

    if (!authorSnap.exists()) {
        document.querySelector('.profile-container').innerHTML = "<h1>Author not found.</h1>";
        return;
    }

    const data = authorSnap.data();

    // A. Fill Banner & Image
    const bannerEl = document.getElementById('p-banner');
    if (data.bannerURL) bannerEl.style.backgroundImage = `url('${data.bannerURL}')`;
    
    const imgEl = document.getElementById('p-image');
    if (data.photoURL) imgEl.src = data.photoURL;

    // B. Fill Text Info
    document.getElementById('p-name').textContent = data.displayName || "Unknown Author";
    document.getElementById('p-role').textContent = data.specialization || "Reporter";
    document.getElementById('p-bio').textContent = data.bio || "No bio available.";
    document.getElementById('p-location').textContent = data.location || "Earth";

    // C. Stats
    const followersCount = data.followers ? data.followers.length : 0;
    const articlesCount = data.articleCount || 0; // Assuming you save this count
    
    document.getElementById('p-followers').textContent = `${followersCount} followers`;
    document.getElementById('p-followers-2').textContent = followersCount;
    
    document.getElementById('p-articles-count').textContent = `${articlesCount} articles`;
    document.getElementById('p-articles-count-2').textContent = articlesCount;

    // Joined Date (Format Firestore Timestamp)
    if (data.joinedDate) {
        const date = data.joinedDate.toDate();
        const options = { month: 'long', year: 'numeric' };
        document.getElementById('p-joined-date').textContent = date.toLocaleDateString('en-US', options);
    }

    // D. Initialize Follow Button
    const followBtn = document.getElementById('main-follow-btn');
    if (currentViewer) {
        // Check if viewer is already following this author
        // We need to fetch viewer's data to check their 'following' array
        const viewerRef = doc(db, "users", currentViewer.email);
        const viewerSnap = await getDoc(viewerRef);
        const viewerData = viewerSnap.data();
        
        if (viewerData.following && viewerData.following.includes(email)) {
            setFollowButtonState(followBtn, true);
        }

        // Attach Click Listener
        followBtn.onclick = () => toggleFollow(followBtn, email);
    } else {
        followBtn.style.display = 'none'; // Hide if not logged in
    }

    // E. Load Articles
    loadAuthorArticles(email);

    // F. Load Sidebar
    loadSidebarSuggestions(email);
}

// ==========================================
// 2. LOAD ARTICLES (Firestore Query)
// ==========================================
async function loadAuthorArticles(email) {
    const container = document.getElementById('author-articles-list');
    container.innerHTML = '';

    // Query articles where authorEmail == email
    const q = query(collection(db, "articles"), where("authorEmail", "==", email), limit(5));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        container.innerHTML = '<div style="color:#777; padding:20px;">No articles yet.</div>';
        return;
    }

    snapshot.forEach(doc => {
        const article = doc.data();
        const html = `
            <a href="../articles/article.html?id=${doc.id}" class="article-card">
                <h3>${article.title}</h3>
                <div class="article-meta">${formatDate(article.datePosted)}</div>
                <p class="article-summary">${article.summary}</p>
            </a>
            <hr class="article-separator">
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// ==========================================
// 3. LOAD SIDEBAR (With Functional Follow Buttons)
// ==========================================
async function loadSidebarSuggestions(currentAuthorEmail) {
    const container = document.getElementById('sidebar-list');
    container.innerHTML = '';

    // 1. Fetch Viewer Data (to check who they follow)
    let followingList = [];
    if (currentViewer) {
        const viewerRef = doc(db, "users", currentViewer.email);
        const viewerSnap = await getDoc(viewerRef);
        if (viewerSnap.exists()) {
            followingList = viewerSnap.data().following || [];
        }
    }

    // 2. Fetch Reporters
    const q = query(collection(db, "users"), where("role", "==", "author"), limit(4));
    const snapshot = await getDocs(q);

    let count = 0;
    snapshot.forEach(doc => {
        const author = doc.data();
        
        // Don't show the author we are currently viewing
        if (author.email !== currentAuthorEmail && count < 3) {
            const div = document.createElement('div');
            div.className = 'reporter-item';
            
            // Check if already following
            const isFollowing = followingList.includes(author.email);
            const btnText = isFollowing ? "Following" : "Follow";
            const btnClass = isFollowing ? "btn-sm-follow following" : "btn-sm-follow";

            div.innerHTML = `
                <div class="reporter-avatar" style="background-image: url('${author.photoURL || '../assets/default-user.png'}')"></div>
                <div class="reporter-info">
                    <h4>${author.displayName}</h4>
                    <p>${author.specialization || "Reporter"}</p>
                </div>
                <button class="${btnClass}">${btnText}</button>
            `;

            // Attach Follow Logic
            const btn = div.querySelector('button');
            btn.onclick = (e) => toggleFollow(e.target, author.email);

            container.appendChild(div);
            count++;
        }
    });
}

// ==========================================
// 4. FOLLOW LOGIC
// ==========================================
async function toggleFollow(btn, targetEmail) {
    if (!currentViewer) return;

    const viewerRef = doc(db, "users", currentViewer.email);
    const targetRef = doc(db, "users", targetEmail);

    const isFollowing = btn.classList.contains('following');

    // Optimistic UI Update
    setFollowButtonState(btn, !isFollowing);

    try {
        if (isFollowing) {
            // Unfollow: Remove target from viewer's 'following', remove viewer from target's 'followers'
            await updateDoc(viewerRef, { following: arrayRemove(targetEmail) });
            await updateDoc(targetRef, { followers: arrayRemove(currentViewer.email) });
        } else {
            // Follow
            await updateDoc(viewerRef, { following: arrayUnion(targetEmail) });
            await updateDoc(targetRef, { followers: arrayUnion(currentViewer.email) });
        }
    } catch (e) {
        console.error("Follow error:", e);
        setFollowButtonState(btn, isFollowing); // Revert on error
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

// Helper
function formatDate(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
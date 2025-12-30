// Article/firebase-db.js

// 1. IMPORT SDKs (All in one place)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, query, where, orderBy, limit, startAt, endAt, 
    getDocs, getDoc, doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, increment, 
    enableIndexedDbPersistence, getCountFromServer 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyC_Q3p2dyKwUOUv5O-gIMNI8vv6RrD0IZY",
    authDomain: "bai-news-9e4cf.firebaseapp.com",
    projectId: "bai-news-9e4cf",
    storageBucket: "bai-news-9e4cf.firebasestorage.app",
    messagingSenderId: "1056453543830",
    appId: "1:1056453543830:web:c40a8c1e5bb582f2c63fb7"
};

// 3. INITIALIZE
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 4. OFFLINE CACHE (Protocol #5)
try { 
    enableIndexedDbPersistence(db).catch(err => console.log("Persistence:", err.code)); 
} catch (e) {}


// ======================================================
// SECTION 1: FEATURED NEWS (Updated for 'isFeatured' flag)
// ======================================================
export async function getFeaturedNews() {
    // Logic: Fetch articles where you specifically set isFeatured = true
    const q = query(
        collection(db, "articles"),
        where("isFeatured", "==", true), 
        limit(2)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


// ======================================================
// SECTION 2: LATEST NEWS (Home Page Ticker)
// ======================================================
export function subscribeLatestNews(callback) {
    const q = query(
        collection(db, "articles"),
        orderBy("datePosted", "desc"),
        limit(5)
    );

    return onSnapshot(q, (snapshot) => {
        const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(articles);
    });
}


// ======================================================
// SECTION 3: PAGINATION (The Serial Number Logic)
// ======================================================

// Get Total Count (To calculate total pages)
export async function getTotalArticleCount() {
    const snapshot = await getCountFromServer(collection(db, "articles"));
    return snapshot.data().count;
}

// Get Specific Page (Using your Formula: Total - 7*(Page-1))
export async function getArticlesBySerial(startSerial) {
    // We want articles with serial number <= startSerial
    // e.g. Start at 443, get 443, 442, 441...
    const q = query(
        collection(db, "articles"),
        where("serialNumber", "<=", startSerial), 
        orderBy("serialNumber", "desc"),           
        limit(7)                                   
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


// ======================================================
// SECTION 4: SINGLE ARTICLE & RELATED
// ======================================================

// Get One Article by ID without showing read count
// export async function getArticleById(articleId) {
//     if (!articleId) return null;
//     const docRef = doc(db, "articles", articleId);
//     const snapshot = await getDoc(docRef);
//     return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
// }
export async function getArticleById(articleId) {
    if (!articleId) return null;
    try {
        console.log(`🔥 [READ COST: 1] Fetching Article ID: ${articleId}`); // <--- LOG
        const docRef = doc(db, "articles", articleId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            return null;
        }
    } catch (e) {
        console.error("Error fetching article:", e);
        return null;
    }
}


// Get Related News (Same Tag)
export async function getRelatedArticles(tags, currentId) {
    if (!tags || tags.length === 0) return [];
    
    const q = query(
        collection(db, "articles"),
        where("tags", "array-contains", tags[0]), // Match first tag
        limit(4) // Fetch 4, remove current, show 3
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.id !== currentId) // Remove the one we are reading
        .slice(0, 3); // Return max 3
}


// ======================================================
// SECTION 5: GLOBAL SEARCH
// ======================================================
export async function searchArticles(term) {
    if (!term) return [];
    
    // Firestore Prefix Search (Case Sensitive)
    const q = query(
        collection(db, "articles"),
        orderBy("title"),
        startAt(term),
        endAt(term + "\uf8ff"),
        limit(8)
    );

    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("Search requires an Index on 'title'. Check Console link.", e);
        return [];
    }
}


// ======================================================
// SECTION 6: USER ACTIONS (Save / Debounce)
// ======================================================
export async function toggleSaveArticle(articleId, isSaving) {
    const user = auth.currentUser;
    if (!user) return alert("Please login to save.");

    const userRef = doc(db, "users", user.uid);
    const articleRef = doc(db, "articles", articleId);

    try {
        if (isSaving) {
            await updateDoc(userRef, { savedArticles: arrayUnion(articleId) });
            await updateDoc(articleRef, { "stats.saves": increment(1) });
        } else {
            await updateDoc(userRef, { savedArticles: arrayRemove(articleId) });
            await updateDoc(articleRef, { "stats.saves": increment(-1) });
        }
    } catch (e) { console.error("Error saving:", e); }
}

export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


// ======================================================
// SECTION 7: CLIENT-SIDE SEARCH & RELATED (The Engine)
// ======================================================

// 1. The "Download Everything" Function (Smart Sync)
export async function fetchAllSearchData() {
    const STORAGE_KEY = 'bai_news_search_cache';
    const META_KEY = 'bai_news_last_serial';

    let localData = [];
    let lastSerial = 0;

    // Load from LocalStorage
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedSerial = localStorage.getItem(META_KEY);
        if (stored) localData = JSON.parse(stored);
        if (storedSerial) lastSerial = parseInt(storedSerial);
    } catch (e) { console.warn("Cache error", e); localData = []; }

    // Check Server for Updates (1 Read)
    let latestServerSerial = 0;
    try {
        console.log("🔥 [READ COST: 1] Checking latest Serial Number..."); // <--- LOG ADDED
        
        const q = query(collection(db, "articles"), orderBy("serialNumber", "desc"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) latestServerSerial = snapshot.docs[0].data().serialNumber || 0;
    } catch (e) {
        console.log("⚠️ Offline or Error. Using Cache."); // <--- LOG ADDED
        window.cachedSearchData = localData; 
        return localData; // Offline mode
    }

    // Sync if needed
    if (latestServerSerial > lastSerial) {
        console.log("Downloading new articles...");
        const updateQ = query(collection(db, "articles"), where("serialNumber", ">", lastSerial));
        const updateSnapshot = await getDocs(updateQ);
        
        const count = updateSnapshot.size;
        console.log(`🔥 [READ COST: ${count}] Downloading ${count} new articles...`); // <--- LOG ADDED
        
        const newArticles = updateSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            searchTitle: (doc.data().title || "").toLowerCase(),
            searchSummary: (doc.data().summary || "").toLowerCase(),
            searchTags: (doc.data().tags || []).map(t => t.toLowerCase())
        }));

        const mergedData = [...newArticles, ...localData];
        // Sort by Date Descending (Newest First)
        mergedData.sort((a, b) => {
            const dateA = a.datePosted && a.datePosted.seconds ? a.datePosted.seconds : new Date(a.datePosted).getTime()/1000;
            const dateB = b.datePosted && b.datePosted.seconds ? b.datePosted.seconds : new Date(b.datePosted).getTime()/1000;
            return dateB - dateA;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedData));
        localStorage.setItem(META_KEY, latestServerSerial.toString());
        localData = mergedData;
    } else {
        console.log("✅ [READ COST: 0] Cache is up to date. Using LocalStorage."); // <--- LOG ADDED
    }

    window.cachedSearchData = localData;
    return localData;
}

// 2. The New "Smart Match" Related Function (0 Reads)
export async function getLocalRelatedArticles(currentTags, currentId) {
    // Ensure we have data
    let data = window.cachedSearchData;
    if (!data) data = await fetchAllSearchData();

    if (!currentTags || currentTags.length === 0) return [];

    // Normalize tags to lowercase for matching
    const normalizedTags = currentTags.map(t => t.toLowerCase());

    // Filter and Score
    const scoredArticles = data
        .filter(article => article.id !== currentId) // Remove current article
        .map(article => {
            // Count how many tags match
            const intersection = article.searchTags.filter(t => normalizedTags.includes(t));
            return { ...article, score: intersection.length };
        })
        .filter(article => article.score > 0) // Must have at least 1 matching tag
        .sort((a, b) => b.score - a.score); // Sort by highest relevance

    // Return top 3
    return scoredArticles.slice(0, 3);
}
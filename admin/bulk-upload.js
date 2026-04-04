import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app);

// Image suggestion map — loaded dynamically from JSON
let IMAGE_SUGGESTIONS = [];

// STATE
let articleQueue = []; // { data: jsonPart, image: url_or_empty }

document.addEventListener('DOMContentLoaded', async () => {
    // Load image tags from JSON
    try {
        const res = await fetch('/assets/tags/img-tags.json');
        IMAGE_SUGGESTIONS = await res.json();
    } catch (e) { console.error('Error loading image tags:', e); }

    const jsonInput = document.getElementById('json-input');
    const jsonTextInput = document.getElementById('json-text-input');
    const btnProcessText = document.getElementById('btn-process-text');

    // UI Elements
    const queueDiv = document.getElementById('article-queue');
    const step2 = document.getElementById('step-2');
    const btnFinal = document.getElementById('btn-final-upload');

    // Popup elements
    const imgPopup = document.getElementById('img-popup');
    const imgPopupClose = document.getElementById('img-popup-close');
    const imgPopupImg = document.getElementById('img-popup-img');
    const imgPopupNoImg = document.getElementById('img-popup-no-img');
    const imgPopupTitle = document.getElementById('img-popup-title');
    const imgPopupSuggestions = document.getElementById('img-popup-suggestions');
    const imgPopupTags = document.getElementById('img-popup-tags');
    let currentPopupIndex = -1;

    // ==========================================
    // 1. PROCESS JSON & SANITIZE
    // ==========================================
    function sanitizeJSON(str) {
        let result = '';
        for (let i = 0; i < str.length; i++) {
            let char = str[i];
            // Skip if already escaped
            if (char === '"' && i > 0 && str[i-1] !== '\\') {
                let prev = str.slice(0, i).trim().slice(-1);
                let next = str.slice(i + 1).trim()[0];
                
                let isStructural = false;
                if (prev === '{' || prev === '[' || prev === ',' || prev === ':') isStructural = true;
                if (next === '}' || next === ']' || next === ',' || next === ':') isStructural = true;
                
                if (!isStructural) {
                    result += '\\"';       // Escape internal quote
                } else {
                    result += char;         // Keep structural quote
                }
            } else {
                result += char;
            }
        }
        return result;
    }

    function handleJSONData(rawData) {
        try {
            if (!Array.isArray(rawData)) throw new Error("JSON must be an array [ ... ]");

            articleQueue = rawData.map(item => {
                let image = item.imageUrl || "";

                // Auto-detect image from tags if no image URL set
                if (!image && item.tags && Array.isArray(item.tags)) {
                    for (const tag of item.tags) {
                        const match = IMAGE_SUGGESTIONS.find(s => s.name.toLowerCase() === tag.toLowerCase());
                        if (match) { image = match.path; break; }
                    }
                }

                return { data: item, image: image };
            });

            renderQueue();
            step2.classList.remove('hidden');
        } catch (err) {
            alert("Error parsing JSON: " + err.message);
        }
    }

    jsonInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        jsonTextInput.value = "";
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const sanitizedStr = sanitizeJSON(ev.target.result);
                const rawData = JSON.parse(sanitizedStr);
                handleJSONData(rawData);
            } catch (err) { 
                console.error("JSON Error:", err);
                alert("Invalid JSON file. Please ensure syntax is correct."); 
            }
            // Reset to allow re-uploading the same file
            jsonInput.value = "";
        };
        reader.readAsText(file);
    };

    btnProcessText.onclick = () => {
        const text = jsonTextInput.value.trim();
        if (!text) return alert("Please paste JSON text first.");
        jsonInput.value = "";
        try {
            const sanitizedStr = sanitizeJSON(text);
            const rawData = JSON.parse(sanitizedStr);
            handleJSONData(rawData);
        } catch (err) { 
            console.error("JSON Error:", err);
            alert("Invalid JSON syntax in text box. Please check format."); 
        }
    };

    // ==========================================
    // 2. RENDER QUEUE
    // ==========================================
    function renderQueue() {
        queueDiv.innerHTML = "";

        articleQueue.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = "upload-item" + (item.image ? " ready" : "");
            row.id = `item-${index}`;

            // Image preview box
            let imgBoxContent;
            if (item.image && item.image.startsWith('http')) {
                imgBoxContent = `<img src="${item.image}" alt="Preview" loading="lazy">`;
            } else if (item.image && item.image.startsWith('/')) {
                imgBoxContent = `<img src="${item.image}" alt="Preview" loading="lazy">`;
            } else {
                imgBoxContent = `<span class="no-preview">No Preview</span>`;
            }

            row.innerHTML = `
                <div class="item-img-box" data-index="${index}">
                    ${imgBoxContent}
                </div>
                <div class="item-info">
                    <h4>${item.data.title || "Untitled"}</h4>
                    <p>Author: ${item.data.authorEmail || "Unknown"}</p>
                </div>
            `;
            queueDiv.appendChild(row);
        });

        // Add click handlers to image boxes
        document.querySelectorAll('.item-img-box').forEach(box => {
            box.addEventListener('click', (e) => {
                const idx = parseInt(box.dataset.index);
                openImagePopup(idx);
            });
        });

        btnFinal.disabled = false;
        btnFinal.innerText = "Upload All Articles";
    }

    // ==========================================
    // 3. IMAGE POPUP LOGIC
    // ==========================================
    function openImagePopup(index) {
        currentPopupIndex = index;
        const item = articleQueue[index];

        imgPopupTitle.textContent = item.data.title || "Article Image";

        if (item.image) {
            imgPopupImg.src = item.image;
            imgPopupImg.classList.remove('hidden');
            imgPopupNoImg.style.display = 'none';
        } else {
            imgPopupImg.src = '';
            imgPopupImg.classList.add('hidden');
            imgPopupNoImg.style.display = '';
        }

        // Render suggestion buttons
        imgPopupSuggestions.innerHTML = '<p style="font-size:0.75rem; color:#888; margin:0 0 8px 0; width:100%;">Image Suggestions:</p>';
        IMAGE_SUGGESTIONS.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'popup-suggest-btn';
            btn.textContent = suggestion.name;

            if (item.image === suggestion.path) {
                btn.classList.add('active');
            }

            btn.addEventListener('click', () => {
                articleQueue[currentPopupIndex].image = suggestion.path;

                // Add image tag to article tags (swap old image tag for new one)
                const IMAGE_TAG_NAMES = IMAGE_SUGGESTIONS.map(s => s.name);
                let currentTags = articleQueue[currentPopupIndex].data.tags || [];
                // Remove any previous image tags
                currentTags = currentTags.filter(t => !IMAGE_TAG_NAMES.includes(t));
                // Add the new image tag
                currentTags.push(suggestion.name);
                articleQueue[currentPopupIndex].data.tags = currentTags;

                imgPopupImg.src = suggestion.path;
                imgPopupImg.classList.remove('hidden');
                imgPopupNoImg.style.display = 'none';

                imgPopupSuggestions.querySelectorAll('.popup-suggest-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                renderQueue();
            });

            imgPopupSuggestions.appendChild(btn);
        });

        imgPopup.classList.remove('hidden');
    }

    imgPopupClose.addEventListener('click', () => {
        imgPopup.classList.add('hidden');
    });

    imgPopup.addEventListener('click', (e) => {
        if (e.target === imgPopup) imgPopup.classList.add('hidden');
    });

    // ==========================================
    // 4. FINAL UPLOAD LOGIC
    // ==========================================
    btnFinal.onclick = async () => {
        btnFinal.disabled = true;
        btnFinal.innerText = "Processing...";
        const logger = document.getElementById('status-log');
        let successCount = 0; let failCount = 0;

        // FETCH HIGHEST SERIAL NUMBER ONCE
        let currentHighestSerial = 0;
        try {
            const q = query(collection(db, "articles"), orderBy("serialNumber", "desc"), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                currentHighestSerial = snap.docs[0].data().serialNumber || 0;
            }
        } catch(e) { console.error("Error fetching max serialNumber:", e); }

        for (let i = 0; i < articleQueue.length; i++) {
            const item = articleQueue[i];
            const data = item.data;

            try {
                // DEFAULT VALUES
                let authorName = data.authorName || "Bitfeed Team";
                let authorId = data.authorId || "admin_default";
                let authorEmail = data.authorEmail || "";

                if (authorEmail && authorEmail.includes('@')) {
                    const authorRef = doc(db, "authors", authorEmail);
                    const authorSnap = await getDoc(authorRef);
                    if (authorSnap.exists()) {
                        authorName = authorSnap.data().displayName || authorName;
                        authorId = authorSnap.data().uid || authorId;
                    }
                }

                const finalDoc = {
                    title: data.title || "Untitled",
                    summary: data.summary || (data.content ? data.content.substring(0, 200) + "..." : "No summary"),
                    content: data.content || "",
                    conciseContent: data.conciseContent || "",
                    tags: data.tags || ["news"],
                    imageUrl: item.image || "",
                    authorEmail: authorEmail,
                    authorName: authorName,
                    authorId: authorId,
                    status: "active",
                    isFeatured: data.isFeatured || false,
                    datePosted: new Date().toISOString(),
                    updatedAt: Date.now(), // Added for Cache Sync
                    serialNumber: currentHighestSerial + 1 + i, // Fixed pagination scaling
                    stats: { views: 0, likes: 0, saves: 0 }
                };

                await addDoc(collection(db, "articles"), finalDoc);
                logger.innerHTML += `✅ Success: ${finalDoc.title}\n`;
                successCount++;
            } catch (err) {
                console.error(err);
                logger.innerHTML += `❌ Failed: ${data.title} (${err.message})\n`;
                failCount++;
            }
        }
        btnFinal.innerText = `Done (${successCount} OK, ${failCount} Failed)`;
    };
});
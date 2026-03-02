import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app);

// Image suggestion map
const IMAGE_SUGGESTIONS = [
    { name: 'Algorithm', path: '/assets/article-img/alg.png' },
    { name: 'Image Model', path: '/assets/article-img/img-m.png' },
    { name: 'LLM', path: '/assets/article-img/llm.png' },
    { name: 'Research', path: '/assets/article-img/research.png' },
    { name: 'Robotics', path: '/assets/article-img/rob.png' },
    { name: 'Security', path: '/assets/article-img/sec.png' },
    { name: 'Video Model', path: '/assets/article-img/vid-m.png' }
];

// STATE
let articleQueue = []; // { data: jsonPart, image: url_or_empty }

document.addEventListener('DOMContentLoaded', () => {
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
    // 1. PROCESS JSON
    // ==========================================
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
                const rawData = JSON.parse(ev.target.result);
                handleJSONData(rawData);
            } catch (err) { alert("Invalid JSON file."); }
        };
        reader.readAsText(file);
    };

    btnProcessText.onclick = () => {
        const text = jsonTextInput.value.trim();
        if (!text) return alert("Please paste JSON text first.");
        jsonInput.value = "";
        try {
            const rawData = JSON.parse(text);
            handleJSONData(rawData);
        } catch (err) { alert("Invalid JSON syntax in text box."); }
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
                imgBoxContent = `<img src="${item.image}" alt="Preview">`;
            } else if (item.image && item.image.startsWith('/')) {
                imgBoxContent = `<img src="${item.image}" alt="Preview">`;
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

        for (let i = 0; i < articleQueue.length; i++) {
            const item = articleQueue[i];
            const data = item.data;

            try {
                // DEFAULT VALUES
                let authorName = data.authorName || "Bai Team";
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
                    serialNumber: Date.now() + i,
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
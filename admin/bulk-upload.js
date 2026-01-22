import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app);

let selectedFile = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Admin Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const snap = await getDoc(doc(db, "users", user.email));
            if (snap.exists() && snap.data().role === 'admin') {
                currentUser = user;
            } else {
                alert("Access Denied: Admins Only");
                window.location.href = "/main/index.html";
            }
        } else {
            window.location.href = "/main/index.html";
        }
    });

    // 2. File Selection Logic
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('json-input');
    const fileNameDisplay = document.getElementById('file-name');
    const uploadBtn = document.getElementById('btn-upload'); // File Upload Button
    const pasteBtn = document.getElementById('btn-paste-upload'); // NEW: Paste Upload Button

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            selectedFile = e.target.files[0];
            fileNameDisplay.innerText = selectedFile.name;
            uploadBtn.disabled = false;
        }
    });

    // 3A. Trigger Upload via FILE
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        initLog("Reading file...");
        uploadBtn.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const jsonContent = JSON.parse(e.target.result);
                await processUpload(jsonContent); // Call the shared function
                uploadBtn.innerText = "File Upload Complete";
            } catch (error) {
                log(`CRITICAL ERROR: Invalid JSON File - ${error.message}`, 'error');
                uploadBtn.disabled = false;
            }
        };
        reader.readAsText(selectedFile);
    });

    // 3B. Trigger Upload via PASTE (NEW FEATURE)
    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            const textArea = document.getElementById('json-paste-area');
            const textContent = textArea.value.trim();

            if (!textContent) {
                alert("Please paste some JSON code first.");
                return;
            }

            initLog("Parsing text...");
            pasteBtn.disabled = true;
            pasteBtn.innerText = "Uploading...";

            try {
                const jsonContent = JSON.parse(textContent);
                await processUpload(jsonContent); // Call the shared function
                pasteBtn.innerText = "Text Upload Complete";
            } catch (error) {
                log(`CRITICAL ERROR: Invalid JSON Text - ${error.message}`, 'error');
                pasteBtn.innerText = "Try Again";
                pasteBtn.disabled = false;
            }
        });
    }
});

// --- SHARED UPLOAD FUNCTION ---
async function processUpload(jsonContent) {
    if (!Array.isArray(jsonContent)) {
        throw new Error("JSON must be an array of article objects [{}, {}]");
    }

    log(`Found ${jsonContent.length} articles. Starting upload...`);

    let successCount = 0;
    let failCount = 0;

    for (const article of jsonContent) {
        try {
            // VALIDATION
            if (!article.title || !article.content) {
                log(`Skipped: Missing title or content`, 'error');
                failCount++;
                continue;
            }

            // PREPARE DATA
            const newDoc = {
                title: article.title,
                summary: article.summary || article.content.substring(0, 100) + "...",
                content: article.content,
                tags: Array.isArray(article.tags) ? article.tags : [],
                
                // Image Handling
                imageUrl: article.imageUrl || "", 
                
                // Author Logic
                authorName: article.authorName || currentUser.displayName || "Bai News Team",
                authorEmail: article.authorEmail || currentUser.email,
                authorId: article.authorId || currentUser.uid, 

                // System Flags
                isFeatured: typeof article.isFeatured !== 'undefined' ? article.isFeatured : false,
                status: "active", 
                datePosted: article.datePosted || new Date().toISOString(),
                timestamp: serverTimestamp(),
                serialNumber: Date.now(),
                stats: { views: 0, likes: 0, saves: 0 }
            };

            await addDoc(collection(db, "articles"), newDoc);
            log(`Uploaded: ${article.title.substring(0, 30)}...`, 'success');
            successCount++;

        } catch (err) {
            log(`Error uploading "${article.title}": ${err.message}`, 'error');
            failCount++;
        }
    }

    log(`-----------------------------------`);
    log(`DONE. Success: ${successCount}, Failed: ${failCount}`);
}

// Helper: Logger
function initLog(msg) {
    const logger = document.getElementById('logger');
    logger.style.display = 'block';
    logger.innerHTML = `<div class="log-line">${msg}</div>`;
}

function log(msg, type = 'normal') {
    const logger = document.getElementById('logger');
    const div = document.createElement('div');
    div.className = `log-line ${type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : ''}`;
    div.innerText = msg;
    logger.appendChild(div);
    logger.scrollTop = logger.scrollHeight;
}
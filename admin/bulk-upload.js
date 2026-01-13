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

    // 2. File Selection
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('json-input');
    const fileNameDisplay = document.getElementById('file-name');
    const uploadBtn = document.getElementById('btn-upload');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            selectedFile = e.target.files[0];
            fileNameDisplay.innerText = selectedFile.name;
            uploadBtn.disabled = false;
        }
    });

    // 3. Upload Logic
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        const logger = document.getElementById('logger');
        logger.style.display = 'block';
        logger.innerHTML = '<div class="log-line">Reading file...</div>';
        uploadBtn.disabled = true;
        uploadBtn.innerText = "Uploading...";

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const jsonContent = JSON.parse(e.target.result);
                
                if (!Array.isArray(jsonContent)) {
                    throw new Error("JSON must be an array of article objects [{}, {}]");
                }

                log(`Found ${jsonContent.length} articles. Starting upload...`);

                let successCount = 0;
                let failCount = 0;

                for (const article of jsonContent) {
                    try {
                        // VALIDATION: Check required fields
                        if (!article.title || !article.content) {
                            log(`Skipped: Missing title or content`, 'error');
                            failCount++;
                            continue;
                        }

                        // PREPARE DATA: Add system fields
                        const newDoc = {
                            title: article.title,
                            summary: article.summary || article.content.substring(0, 100) + "...",
                            content: article.content,
                            // Ensure tags is array
                            tags: Array.isArray(article.tags) ? article.tags : [],
                            imageUrl: article.imageUrl || "", // Must be URL or Base64 in JSON
                            
                            // Author Info (Default to Admin if missing)
                            authorName: article.authorName || "Bai News Team",
                            authorEmail: article.authorEmail || currentUser.email,
                            authorId: currentUser.uid,

                            // System Fields
                            status: "active", // <--- DIRECTLY APPROVED
                            isFeatured: false,
                            datePosted: new Date().toISOString(),
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
                uploadBtn.innerText = "Upload Complete";

            } catch (error) {
                log(`CRITICAL ERROR: ${error.message}`, 'error');
                uploadBtn.innerText = "Failed";
            }
        };
        reader.readAsText(selectedFile);
    });
});

function log(msg, type = 'normal') {
    const logger = document.getElementById('logger');
    const div = document.createElement('div');
    div.className = `log-line ${type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : ''}`;
    div.innerText = msg;
    logger.appendChild(div);
    logger.scrollTop = logger.scrollHeight; // Auto scroll
}
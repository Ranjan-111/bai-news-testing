import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

// STATE VARIABLES
let articleQueue = []; // Holds objects: { data: jsonPart, image: base64_OR_url }
let activeCropIndex = -1; // Tracks which row is being cropped

// Cropper State
let currentScale = 1;
let currentX = 0;
let currentY = 0;
let isDragging = false;
let startX, startY;

document.addEventListener('DOMContentLoaded', () => {
    // Input Selectors
    const jsonInput = document.getElementById('json-input');
    const jsonTextInput = document.getElementById('json-text-input');
    const btnProcessText = document.getElementById('btn-process-text');
    
    // UI Elements
    const queueDiv = document.getElementById('article-queue');
    const step2 = document.getElementById('step-2');
    const btnFinal = document.getElementById('btn-final-upload');

    // Cropper Selectors
    const cropperModal = document.getElementById('cropper-modal');
    const cropperImg = document.getElementById('cropper-img');
    const zoomSlider = document.getElementById('zoom-slider');
    const btnSaveCrop = document.getElementById('btn-save-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const cropContainer = document.querySelector('.crop-container');

    // ==========================================
    // 1. PROCESS JSON (Dual Input Logic)
    // ==========================================

    function handleJSONData(rawData) {
        try {
            if (!Array.isArray(rawData)) throw new Error("JSON must be an array [ ... ]");
            
            // Map data. If imageUrl exists, set it as the 'image' immediately.
            articleQueue = rawData.map(item => ({ 
                data: item, 
                image: (item.imageUrl && item.imageUrl.startsWith('http')) ? item.imageUrl : null 
            }));

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
    // 2. RENDER QUEUE & CROPPER TRIGGER
    // ==========================================

    function renderQueue() {
        queueDiv.innerHTML = "";
        
        articleQueue.forEach((item, index) => {
            const hasLink = item.data.imageUrl && item.data.imageUrl.startsWith('http');
            const row = document.createElement('div');
            row.className = "upload-item";
            if (hasLink || item.image) row.classList.add('ready'); 
            row.id = `item-${index}`;

            let imageSectionHTML = '';
            if (hasLink) {
                // Show URL Preview
                imageSectionHTML = `
                    <div style="flex: 0 0 120px; text-align: center;">
                        <img src="${item.data.imageUrl}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
                        <span style="font-size: 0.7rem; color: #2ecc71; display: block; margin-top: 5px;">✔ Linked</span>
                    </div>`;
            } else {
                // Show Upload/Crop Box
                imageSectionHTML = `
                    <div class="mini-drop" id="drop-box-${index}">
                        <span>${item.image ? '' : 'Drop or Click'}</span>
                        <input type="file" id="file-${index}" accept="image/*" class="hidden">
                        <img id="prev-${index}" src="${item.image || ''}" class="${item.image ? '' : 'hidden'}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>`;
            }

            row.innerHTML = `
                <div class="item-info">
                    <h4>${item.data.title || "Untitled"}</h4>
                    <p>Author: ${item.data.authorEmail || "Unknown"}</p>
                </div>
                ${imageSectionHTML}
            `;
            queueDiv.appendChild(row);

            // Logic for manual image upload and cropping
            if (!hasLink) {
                const dropBox = document.getElementById(`drop-box-${index}`);
                const fileInp = document.getElementById(`file-${index}`);

                dropBox.onclick = () => fileInp.click();

                fileInp.onchange = (e) => {
                    if (e.target.files[0]) processFile(e.target.files[0], index);
                };

                // Drag & Drop
                dropBox.addEventListener('dragover', (e) => { e.preventDefault(); dropBox.style.borderColor = "#d73634"; });
                dropBox.addEventListener('dragleave', () => { dropBox.style.borderColor = "#ccc"; });
                dropBox.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropBox.style.borderColor = "#ccc";
                    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0], index);
                });
            }
        });
        checkReady();
    }

    // Helper: The Missing Process function that triggers the Cropper
    function processFile(file, index) {
        if (!file.type.startsWith('image/')) return alert("Please upload an image.");
        
        activeCropIndex = index; // Set target index
        const reader = new FileReader();
        reader.onload = (e) => {
            cropperImg.src = e.target.result;
            cropperModal.classList.remove('hidden');
            
            // Reset Cropper Defaults
            currentScale = 1; currentX = 0; currentY = 0; zoomSlider.value = 1;
            updateImageTransform();
        };
        reader.readAsDataURL(file);
    }

    // ==========================================
    // 3. CROPPER CORE LOGIC
    // ==========================================

    function updateImageTransform() {
        cropperImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
    }

    cropContainer.onmousedown = (e) => {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        cropContainer.style.cursor = 'grabbing';
    };

    window.onmouseup = () => { isDragging = false; cropContainer.style.cursor = 'grab'; };

    window.onmousemove = (e) => {
        if (!isDragging) return;
        currentX = e.clientX - startX;
        currentY = e.clientY - startY;
        updateImageTransform();
    };

    zoomSlider.oninput = (e) => {
        currentScale = parseFloat(e.target.value);
        updateImageTransform();
    };

    btnSaveCrop.onclick = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800; canvas.height = 450; // Standard size
        const ctx = canvas.getContext('2d');
        const ratio = 800 / cropContainer.clientWidth;
        
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,800,450);
        ctx.save();
        const imgWidth = 800;
        const imgHeight = (cropperImg.naturalHeight / cropperImg.naturalWidth) * 800;

        ctx.translate(currentX * ratio, currentY * ratio);
        ctx.translate(imgWidth/2, imgHeight/2);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-imgWidth/2, -imgHeight/2);
        ctx.drawImage(cropperImg, 0, 0, imgWidth, imgHeight);
        ctx.restore();

        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        
        // Update data and UI
        articleQueue[activeCropIndex].image = base64;
        const row = document.getElementById(`item-${activeCropIndex}`);
        const prev = document.getElementById(`prev-${activeCropIndex}`);
        prev.src = base64;
        prev.classList.remove('hidden');
        row.classList.add('ready');
        
        cropperModal.classList.add('hidden');
        checkReady();
    };

    btnCancelCrop.onclick = () => cropperModal.classList.add('hidden');

    function checkReady() {
        const allFilled = articleQueue.every(item => item.image !== null);
        btnFinal.disabled = !allFilled;
        btnFinal.innerText = allFilled ? "Upload All Articles" : "Add Images to Continue";
    }

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
                    // Multi-Level Content
                    contentBeginner: data.contentBeginner || "",
                    contentPro: data.contentPro || "", 
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

    //to handle the n8n trigger and response
    const btnGenerate = document.getElementById('btn-generate-news');
    const loadingModal = document.getElementById('loading-modal');

    btnGenerate.onclick = async () => {
        // 1. Show loading state
        loadingModal.classList.remove('hidden');
        
        try {
            // 2. Call n8n Production Webhook
            const response = await fetch('http://localhost:5678/webhook/53562d30-4d3d-46c4-b393-27cf17bd5cdd', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-N8N-AUTH': '9B#p(65\UE&5Y' // If you set Header Auth
                }
            });

            if (!response.ok) throw new Error("Failed to reach n8n");

            // 3. Receive the generated news articles
            const generatedNews = await response.json(); 
            
            // 4. Pass the data to your existing handleJSONData function
            handleJSONData(generatedNews);
            
            alert("News generated successfully!");
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            // 5. Hide loading state
            loadingModal.classList.add('hidden');
        }
    };
});
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let imageBase64 = null;
let tags = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. CHECK AUTH
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('inp-author').value = user.displayName || user.email;
        } else {
            alert("You must be logged in.");
            window.location.href = "/main/index.html";
        }
    });

    document.getElementById('inp-date').value = new Date().toISOString();

    // ==========================================
    // 2. IMAGE CROPPER LOGIC (UPDATED & FIXED)
    // ==========================================
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('inp-file');
    const imgPreview = document.getElementById('img-preview');
    const dropContent = document.querySelector('.drop-content');
    
    // Cropper Elements
    const cropperModal = document.getElementById('cropper-modal');
    const cropperImg = document.getElementById('cropper-img');
    const zoomSlider = document.getElementById('zoom-slider');
    const btnSave = document.getElementById('btn-save-crop');
    const btnCancel = document.getElementById('btn-cancel-crop');
    const cropContainer = document.querySelector('.crop-container');

    // Cropper State
    let currentScale = 1;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let startX, startY;

    // --- HELPER: Process the file (used by both Click and Drop) ---
    const processFile = (file) => {
        if (!file) return;

        // --- NEW: 5 MB LIMIT CHECK ---
        const sizeLimit = 5 * 1024 * 1024; // 5 MB in bytes
        if (file.size > sizeLimit) {
            alert("File is too large. Please select an image under 5 MB.");
            return;
        }
        // -----------------------------

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                cropperImg.src = ev.target.result;
                cropperModal.classList.remove('hidden');
                
                // Reset State
                currentScale = 1;
                currentX = 0;
                currentY = 0;
                zoomSlider.value = 1;
                updateImageTransform();
            };
            reader.readAsDataURL(file);
        } else {
            alert("Please select a valid image file.");
        }
    };

    // --- A. FIX: Prevent Double Click Issue ---
    // This stops the click from bubbling up to the dropZone again
    fileInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // --- B. Handle Click Upload ---
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        processFile(file);
        e.target.value = ''; // Reset input so same file can be selected again
    });

    // --- C. Handle Drag & Drop ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        dropZone.classList.add('drag-active'); // Add visual cue
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active'); 

        if (e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    // --- Cropper Mouse/Drag Logic ---
    cropContainer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        cropContainer.style.cursor = 'grabbing'; 
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        cropContainer.style.cursor = 'default'; 
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - startX;
        currentY = e.clientY - startY;
        updateImageTransform();
    });

    // --- Zoom Logic ---
    zoomSlider.addEventListener('input', (e) => {
        currentScale = parseFloat(e.target.value);
        updateImageTransform();
    });

    function updateImageTransform() {
        cropperImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
    }

    // --- Save Logic (Canvas Draw) ---
    btnSave.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');

        const domWidth = cropContainer.clientWidth;
        const ratio = 800 / domWidth; 

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 800, 450);

        ctx.save();
        
        const imgWidth = 800; 
        const imgHeight = (cropperImg.naturalHeight / cropperImg.naturalWidth) * 800;

        ctx.translate(currentX * ratio, currentY * ratio);
        
        ctx.translate(imgWidth / 2, imgHeight / 2);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-imgWidth / 2, -imgHeight / 2);

        ctx.drawImage(cropperImg, 0, 0, imgWidth, imgHeight);
        
        ctx.restore();

        imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        imgPreview.src = imageBase64;
        imgPreview.classList.remove('hidden');
        imgPreview.style.display = 'block';
        dropContent.style.opacity = '0';
        
        cropperModal.classList.add('hidden');
    });

    btnCancel.addEventListener('click', () => {
        cropperModal.classList.add('hidden');
        fileInput.value = ''; 
    });

    // ==========================================
    // 3. TAGS LOGIC
    // ==========================================
    const tagCheckboxes = document.querySelectorAll('.tag-option input');

    tagCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const selected = document.querySelectorAll('.tag-option input:checked');
            
            if (selected.length > 3) {
                e.target.checked = false; 
                alert("You can only select up to 3 tags.");
                return;
            }
            tags = Array.from(selected).map(cb => cb.value);
        });
    });
    
    // ==========================================
    // 4. SUBMIT
    // ==========================================
    const form = document.getElementById('post-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if(!imageBase64) {
            alert("Please upload a cover image.");
            return;
        }

        const btn = form.querySelector('.submit-btn');
        btn.disabled = true;
        btn.innerText = "Sending...";

        try {
            const newArticle = {
                title: document.getElementById('inp-title').value,
                summary: document.getElementById('inp-summary').value,
                content: document.getElementById('inp-content').value, 
                tags: tags,
                imageUrl: imageBase64,
                
                authorEmail: currentUser.email,
                authorName: currentUser.displayName,
                authorId: currentUser.uid, 
                datePosted: new Date().toISOString(),
                timestamp: serverTimestamp(),
                
                status: "pending",
                isFeatured: false,
                serialNumber: Date.now(), 
                stats: { views: 0, likes: 0, saves: 0 }
            };

            await addDoc(collection(db, "articles"), newArticle);

            alert("Article Sent for Approval!");
            window.location.href = "/main/index.html"; 

        } catch (error) {
            console.error("Error posting:", error);
            alert("Failed: " + error.message);
            btn.disabled = false;
            btn.innerText = "Send for Approval";
        }
    });
});
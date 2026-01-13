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

// 2. IMAGE CROPPER LOGIC
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

    // Trigger File Input
    dropZone.addEventListener('click', () => fileInput.click());

    // Handle File Selection -> Open Modal
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
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
        }
        e.target.value = ''; // Reset input so same file can be selected again
    });

// --- Dragging Logic ---
cropContainer.addEventListener('mousedown', (e) => {
    e.preventDefault(); // <--- ADD THIS LINE
    isDragging = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    
    // Optional: distinct cursor style to indicate grabbing
    cropContainer.style.cursor = 'grabbing'; 
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    // Reset cursor style
    cropContainer.style.cursor = 'default'; 
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault(); // Keep this here too
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

    // --- Save Logic (The Magic Part) ---
    btnSave.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');

        // 1. Calculate ratio between the displayed DOM element and the actual 800px canvas
        // The DOM container might be smaller (e.g. 600px on small screens), so we need a multiplier.
        const domWidth = cropContainer.clientWidth;
        const ratio = 800 / domWidth; 

        // 2. Clear canvas with white (optional)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 800, 450);

        // 3. Apply Transformations to Context
        // We move to center, apply offset * ratio, apply scale, move back.
        // Simplified: Translate context by the same amount the image is translated (adjusted for ratio)
        
        ctx.save();
        
        // Move to the position where image starts
        // Note: transform-origin is center in CSS, but top-left default in Canvas.
        // We simulate the visual offset.
        // The image behaves as if it has `width: 100%` of container.
        
        const imgWidth = 800; // Because we map container width to 800
        const imgHeight = (cropperImg.naturalHeight / cropperImg.naturalWidth) * 800;

        // Apply visual translation
        ctx.translate(currentX * ratio, currentY * ratio);
        
        // Apply scaling from the center of the image
        // To zoom from center: translate to center, scale, translate back
        ctx.translate(imgWidth / 2, imgHeight / 2);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-imgWidth / 2, -imgHeight / 2);

        // Draw Image
        ctx.drawImage(cropperImg, 0, 0, imgWidth, imgHeight);
        
        ctx.restore();

        // 4. Save
        imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        // Show Preview
        imgPreview.src = imageBase64;
        imgPreview.classList.remove('hidden');
        imgPreview.style.display = 'block';
        dropContent.style.opacity = '0';
        
        cropperModal.classList.add('hidden');
    });

    btnCancel.addEventListener('click', () => {
        cropperModal.classList.add('hidden');
        fileInput.value = ''; // Clear selection
    });

    // 3. TAGS LOGIC (UPDATED: Checkbox Selection)
    const tagCheckboxes = document.querySelectorAll('.tag-option input');

    tagCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            
            // 1. Calculate current count
            const selected = document.querySelectorAll('.tag-option input:checked');
            
            // 2. Enforce Limit (Max 3)
            if (selected.length > 3) {
                e.target.checked = false; // Uncheck the one just clicked
                alert("You can only select up to 3 tags.");
                return;
            }

            // 3. Update global 'tags' array
            tags = Array.from(selected).map(cb => cb.value);
            
            // Debugging
            console.log("Current Tags:", tags);
        });
    });
    
    // 4. SUBMIT (SAVE AS PENDING)
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
                
                status: "pending", // <--- KEY CHANGE: Not visible yet
                isFeatured: false, // Default
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
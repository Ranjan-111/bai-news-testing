import { 
    getFirestore, 
    collection, 
    query, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    orderBy, 
    limit, 
    getCountFromServer, 
    writeBatch,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { app } from '/Article/firebase-db.js';

const db = getFirestore(app);

// State
let currentArticleId = null;
let currentImageBase64 = null; 

// Cropper State
let currentScale = 1;
let currentX = 0;
let currentY = 0;
let isDragging = false;
let startX, startY;

// Element references
let dropZone, fileInput, imgPreview;
let cropperModal, cropperImg, zoomSlider, btnSave, btnCancel, cropContainer;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Page Data
    loadArticlesLog();
    setupDetailLogic();

    // 2. Element Selectors
    dropZone = document.getElementById('img-drop-zone');
    fileInput = document.getElementById('edit-file-input');
    imgPreview = document.getElementById('edit-img-preview');
    
    // Cropper UI Elements
    cropperModal = document.getElementById('cropper-modal');
    cropperImg = document.getElementById('cropper-img');
    zoomSlider = document.getElementById('zoom-slider');
    btnSave = document.getElementById('btn-save-crop');
    btnCancel = document.getElementById('btn-cancel-crop');
    cropContainer = document.querySelector('.crop-container');

    // Verify all elements exist
    if (!dropZone || !fileInput || !imgPreview || !cropperModal || !cropperImg || !zoomSlider || !btnSave || !btnCancel || !cropContainer) {
        console.error('Some required elements are missing from the DOM');
        return;
    }

    setupImageSelection();
    setupCropperInteractions();
});

// ==========================================
// IMAGE SELECTION LOGIC
// ==========================================
function setupImageSelection() {
    // Trigger Hidden File Input on Click
    dropZone.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Handle File Selection -> Initialize and Open Modal
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select a valid image file');
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                cropperImg.src = ev.target.result;
                
                // Wait for image to load before showing modal
                cropperImg.onload = () => {
                    cropperModal.classList.remove('hidden');
                    
                    // Reset Transformation State for new image
                    currentScale = 1;
                    currentX = 0;
                    currentY = 0;
                    zoomSlider.value = 1;
                    updateImageTransform();
                };
            };
            reader.onerror = () => {
                alert('Error reading file');
                e.target.value = '';
            };
            reader.readAsDataURL(file);
        }
        // Reset input so the same file can be re-selected if needed
        e.target.value = '';
    });
}

// ==========================================
// CROPPER INTERACTION LOGIC
// ==========================================
function setupCropperInteractions() {
    // Handle Image Repositioning (Drag)
    cropContainer.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        isDragging = true;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        cropContainer.style.cursor = 'grabbing';
    });

    // Also handle touch events for mobile
    cropContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX - currentX;
        startY = touch.clientY - currentY;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            cropContainer.style.cursor = 'grab';
        }
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault(); 
        currentX = e.clientX - startX;
        currentY = e.clientY - startY;
        updateImageTransform();
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        currentX = touch.clientX - startX;
        currentY = touch.clientY - startY;
        updateImageTransform();
    });

    // Handle Zooming
    zoomSlider.addEventListener('input', (e) => {
        currentScale = parseFloat(e.target.value);
        updateImageTransform();
    });

    // MODAL ACTION BUTTONS
    btnSave.addEventListener('click', saveCroppedImage);
    btnCancel.addEventListener('click', cancelCrop);
}

// Apply Visual Updates to the UI
function updateImageTransform() {
    if (cropperImg) {
        cropperImg.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
    }
}

// ==========================================
// MODAL ACTION BUTTONS
// ==========================================
function saveCroppedImage() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 500; // Correct 16:10 aspect ratio
        const ctx = canvas.getContext('2d');

        // Calculate scale ratio between the display container and target 800px canvas
        const domWidth = cropContainer.clientWidth;
        const ratio = 800 / domWidth;

        // Background setup
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 800, 500);
        ctx.save();
        
        const imgWidth = 800; 
        const imgHeight = (cropperImg.naturalHeight / cropperImg.naturalWidth) * 800;

        // Apply transformations for the final output
        ctx.translate(currentX * ratio, currentY * ratio);
        ctx.translate(imgWidth / 2, imgHeight / 2);
        ctx.scale(currentScale, currentScale);
        ctx.translate(-imgWidth / 2, -imgHeight / 2);
        
        ctx.drawImage(cropperImg, 0, 0, imgWidth, imgHeight);
        ctx.restore();

        // Save to the global variable required by approveAndPublish()
        currentImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        // Update the form preview to show the user the result
        imgPreview.src = currentImageBase64;
        imgPreview.style.display = 'block';
        
        cropperModal.classList.add('hidden');
    } catch (error) {
        console.error('Error saving cropped image:', error);
        alert('Error processing image. Please try again.');
    }
}

// Close modal without saving
function cancelCrop() {
    cropperModal.classList.add('hidden');
    fileInput.value = ''; // Clear selection
}

// ==========================================
// 1. LIST VIEW LOGIC (All Statuses + 3 Day Logic + Sort)
// ==========================================
async function loadArticlesLog() {
    const listContent = document.getElementById('list-content');
    const loading = document.getElementById('loading');
    
    listContent.innerHTML = '';
    
    try {
        // 1. Fetch ALL articles sorted by date
        const q = query(collection(db, "articles"), orderBy("datePosted", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            loading.style.display = 'none';
            listContent.innerHTML = '<p style="text-align:center; color:#777; margin-top:50px;">No articles found.</p>';
            return;
        }

        // 2. Define Date Boundaries
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(todayStart.getDate() - 1);
        
        const dayBeforeStart = new Date(todayStart);
        dayBeforeStart.setDate(todayStart.getDate() - 2);

        // Buckets
        const todayItems = [];
        const yesterdayItems = [];
        const dayBeforeItems = [];
        
        // Batch for deletion
        const batch = writeBatch(db);
        let hasDeletions = false;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const item = { id: docSnap.id, ...data };
            
            // Normalize Date
            let itemDate;
            if (data.datePosted && data.datePosted.toDate) {
                itemDate = data.datePosted.toDate();
            } else {
                itemDate = new Date(data.datePosted);
            }

            // 3. Categorize
            if (itemDate >= todayStart) {
                todayItems.push(item);
            } else if (itemDate >= yesterdayStart) {
                yesterdayItems.push(item);
            } else if (itemDate >= dayBeforeStart) {
                dayBeforeItems.push(item);
            } else {
                // Older than 3 days -> Delete if pending
                if (data.status === 'pending') {
                    batch.delete(docSnap.ref);
                    hasDeletions = true;
                }
            }
        });

        // Execute Cleanup
        if (hasDeletions) {
            await batch.commit();
        }

        // ---------------------------------------------------------
        // --- NEW: SORT LOGIC (Pending First, Then by Date) ---
        // ---------------------------------------------------------
        const sortPendingFirst = (a, b) => {
            // 1. Status Check: Pending comes before Active
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            
            // 2. If status is same, maintain existing date sort (desc)
            return 0; 
        };

        todayItems.sort(sortPendingFirst);
        yesterdayItems.sort(sortPendingFirst);
        dayBeforeItems.sort(sortPendingFirst);
        // ---------------------------------------------------------


        loading.style.display = 'none';

        // 4. Render UI
        if (todayItems.length > 0) {
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Today</span>`);
            todayItems.forEach(item => listContent.appendChild(createCard(item)));
        }

        if (yesterdayItems.length > 0) {
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Yesterday</span>`);
            yesterdayItems.forEach(item => listContent.appendChild(createCard(item)));
        }

        if (dayBeforeItems.length > 0) {
            const dateLabel = dayBeforeStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">${dateLabel}</span>`);
            dayBeforeItems.forEach(item => listContent.appendChild(createCard(item)));
        }

        if (todayItems.length === 0 && yesterdayItems.length === 0 && dayBeforeItems.length === 0) {
            listContent.innerHTML = '<p style="text-align:center; color:#777; margin-top:50px;">No activity in the last 3 days.</p>';
        }

    } catch (e) {
        console.error(e);
        loading.innerText = "Error loading list.";
    }
}

function createCard(data) {
    const div = document.createElement('div');
    div.className = 'req-card';
    
    let dateObj = data.datePosted && data.datePosted.toDate ? data.datePosted.toDate() : new Date(data.datePosted);
    const dateStr = dateObj.toLocaleDateString('en-GB');

    // Dynamic Status Logic
    const isPending = data.status === 'pending';
    const statusText = isPending ? 'Pending' : 'Approved';
    const statusColorClass = isPending ? 'status-red' : 'status-black';

    div.innerHTML = `
        <img src="${data.imageUrl}" class="card-img" alt="${data.title}">
        <div class="card-content">
            <div class="card-title">${data.title}</div>
            <div class="card-meta">by ${data.authorName} | ${dateStr}</div>
            <div class="card-summary">${data.summary}</div>
            <div class="status-line">Status: <span class="status-val ${statusColorClass}">${statusText}</span></div>
        </div>
    `;

    div.onclick = () => openDetailView(data);
    
    return div;
}

// ==========================================
// 2. DETAIL VIEW LOGIC
// ==========================================
function setupDetailLogic() {
    document.getElementById('back-btn').onclick = closeDetailView;
    document.getElementById('btn-publish').onclick = approveAndPublish;
    document.getElementById('btn-reject-final').onclick = rejectArticle;
}

function openDetailView(data) {
    currentArticleId = data.id;
    currentImageBase64 = data.imageUrl; 

    // Use .innerHTML for rich text fields
    document.getElementById('edit-title').value = data.title || "";
    document.getElementById('edit-content-beginner').value = data.contentBeginner || "";
    document.getElementById('edit-content-intermediate').value = data.content || "";
    document.getElementById('edit-content-pro').value = data.contentPro || "";
    
    // Summary remains a standard textarea
    document.getElementById('edit-summary').value = data.summary || "";

    document.getElementById('edit-author').value = data.authorName;
    document.getElementById('edit-date').value = data.datePosted;
    document.getElementById('edit-img-preview').src = data.imageUrl;
    document.getElementById('check-featured').checked = (data.isFeatured === true);

    // Change Button Text based on status
    const btnApprove = document.getElementById('btn-publish');
    if (data.status === 'active') {
        btnApprove.innerText = "Update Article";
    } else {
        btnApprove.innerText = "Approval & Publish";
    }

    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    window.scrollTo(0,0);
}

function closeDetailView() {
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('list-view').classList.remove('hidden');
    window.scrollTo(0,0);
}

// ==========================================
// 3. ACTIONS (No Popups)
// ==========================================
async function approveAndPublish() {
    const btn = document.getElementById('btn-publish');
    const originalText = btn.innerText;
    btn.innerText = "Publishing...";
    btn.disabled = true;

    try {
        const isFeatured = document.getElementById('check-featured').checked;
        const articlesRef = collection(db, "articles");

        // 1. LIMIT CHECK (Only if creating new or changing status)
        if (originalText.includes("Approval")) {
            const qCount = query(articlesRef, where("status", "==", "active"));
            const snapshot = await getCountFromServer(qCount);
            if (snapshot.data().count >= 420) {
                const qOldest = query(articlesRef, where("status", "==", "active"), orderBy("datePosted", "asc"), limit(1));
                const oldDocs = await getDocs(qOldest);
                if (!oldDocs.empty) await deleteDoc(oldDocs.docs[0].ref);
            }
        }

        // 2. FEATURED CHECK (Max 2 Rule)
        if (isFeatured) {
            const qFeatured = query(articlesRef, where("status", "==", "active"), where("isFeatured", "==", true), orderBy("datePosted", "asc"));
            const featSnap = await getDocs(qFeatured);
            // If already featured, don't count itself
            if (featSnap.size >= 2) {
                // Check if current doc is one of them
                let othersCount = 0;
                featSnap.forEach(doc => { if(doc.id !== currentArticleId) othersCount++; });
                
                if(othersCount >= 2) {
                    await updateDoc(featSnap.docs[0].ref, { isFeatured: false });
                }
            }
        }

        // 3. UPDATE & PUBLISH
        const articleRef = doc(db, "articles", currentArticleId);
        
        await updateDoc(articleRef, {
            title: document.getElementById('edit-title').value,
            summary: document.getElementById('edit-summary').value,
            
            // Save all three versions
            contentBeginner: document.getElementById('edit-content-beginner').value,
            content: document.getElementById('edit-content-intermediate').value,
            contentPro: document.getElementById('edit-content-pro').value,
            
            imageUrl: currentImageBase64, 
            status: "active",
            isFeatured: isFeatured,
            datePosted: new Date().toISOString(), 
            serialNumber: Date.now()
        });

        // Smooth Return
        btn.innerText = "Done";
        setTimeout(() => {
            closeDetailView();
            loadArticlesLog(); 
            btn.disabled = false;
            btn.innerText = originalText;
        }, 500);

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message); 
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function rejectArticle() {
    const btn = document.getElementById('btn-reject-final');
    const originalText = btn.innerText;
    btn.innerText = "Deleting...";
    btn.disabled = true;

    try {
        await deleteDoc(doc(db, "articles", currentArticleId));
        
        setTimeout(() => {
            closeDetailView();
            loadArticlesLog();
            btn.disabled = false;
            btn.innerText = originalText;
        }, 500);

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

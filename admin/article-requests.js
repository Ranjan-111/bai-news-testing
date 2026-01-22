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

document.addEventListener('DOMContentLoaded', () => {
    loadArticlesLog();
    setupDetailLogic();

    // 2. IMAGE CROPPER LOGIC
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('edit-file-input');
    const imgPreview = document.getElementById('edit-img-preview');
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



});

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
                    console.log(`Auto-deleting expired request: ${data.title}`);
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
        <img src="${data.imageUrl}" class="card-img">
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

    const dropZone = document.getElementById('img-drop-zone');
    const fileInput = document.getElementById('edit-file-input');
    const imgPreview = document.getElementById('edit-img-preview');

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                imgPreview.src = ev.target.result;
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > 800) { height *= 800 / width; width = 800; }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    currentImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    document.getElementById('btn-publish').onclick = approveAndPublish;
    document.getElementById('btn-reject-final').onclick = rejectArticle;
}

function openDetailView(data) {
    currentArticleId = data.id;
    currentImageBase64 = data.imageUrl; 

    document.getElementById('edit-title').value = data.title;
    document.getElementById('edit-author').value = data.authorName;
    document.getElementById('edit-date').value = data.datePosted;
    document.getElementById('edit-img-preview').src = data.imageUrl;
    document.getElementById('edit-content').value = data.content;
    document.getElementById('edit-summary').value = data.summary;
    document.getElementById('check-featured').checked = (data.isFeatured === true); // Show current state

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
        // Since we allow editing active articles, we assume limit check 
        // is mostly relevant for new approvals.
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
            content: document.getElementById('edit-content').value,
            summary: document.getElementById('edit-summary').value,
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

// DELETE THIS PART at the very end of your file
if(othersCount >= 2) {
    await updateDoc(featSnap.docs[0].ref, { isFeatured: false });
}
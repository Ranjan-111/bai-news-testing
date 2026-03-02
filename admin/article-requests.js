<<<<<<< HEAD
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
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
    writeBatch,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { app } from '/Article/firebase-db.js';

const db = getFirestore(app);

// State
let currentArticleId = null;
<<<<<<< HEAD
let currentEditTags = []; // free-text tags for editing

// Company names for secondary tag matching
const COMPANY_NAMES = ['Google', 'OpenAI', 'Anthropic', 'Apple', 'Nvidia', 'Meta', 'Microsoft', 'Amazon', 'Tesla', 'Samsung', 'xAI', 'DeepMind'];

// Predefined image tag names for primary tag matching (maps to image file names)
const IMAGE_TAG_MAP = {
    'Algorithm': '/assets/article-img/alg.png',
    'Image Model': '/assets/article-img/img-m.png',
    'LLM': '/assets/article-img/llm.png',
    'Research': '/assets/article-img/research.png',
    'Robotics': '/assets/article-img/rob.png',
    'Security': '/assets/article-img/sec.png',
    'Video Model': '/assets/article-img/vid-m.png'
};
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Page Data
    loadArticlesLog();
    setupDetailLogic();

<<<<<<< HEAD
    // 2. Company Tag Checkboxes (Max 2)
    const companyCheckboxes = document.querySelectorAll('input[name="company-tag"]');
    const companyOtherCb = document.getElementById('company-other-cb');
    const companyOtherInput = document.getElementById('company-other-input');

    companyCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[name="company-tag"]:checked');
            if (checked.length > 2) {
                cb.checked = false;
                alert("You can select a maximum of 2 company tags.");
                return;
            }
            if (companyOtherCb.checked) {
                companyOtherInput.classList.remove('hidden');
                companyOtherInput.focus();
            } else {
                companyOtherInput.classList.add('hidden');
                companyOtherInput.value = '';
            }
        });
    });

    // 2b. IMAGE PREVIEW on radio change
    const imgPreview = document.getElementById('edit-img-preview');
    const noImgText = document.getElementById('no-img-text');

    document.querySelectorAll('input[name="img-suggest"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            imgPreview.src = e.target.value;
            imgPreview.classList.remove('hidden');
            noImgText.style.display = 'none';
        });
    });

    // 2c. TAG SUGGESTIONS (click to add)
    const tagSuggestions = document.getElementById('tag-suggestions');

    document.querySelectorAll('.tag-suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.tag;
            if (val && !currentEditTags.includes(val) && currentEditTags.length < 5) {
                currentEditTags.push(val);
                renderEditTags();
            }
        });
    });

    // 3. TAG EDITING LOGIC (Free-text, max 5)
    const editTagsContainer = document.getElementById('edit-tags-container');
    const editTagInput = document.getElementById('edit-tag-input');

    function renderEditTags() {
        const chips = editTagsContainer.querySelectorAll('.tag-chip-active');
        chips.forEach(chip => chip.remove());

        currentEditTags.forEach((tag, index) => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip-active';
            chip.textContent = tag;
            chip.dataset.index = index;
            chip.addEventListener('click', () => {
                currentEditTags.splice(index, 1);
                renderEditTags();
            });
            editTagsContainer.insertBefore(chip, editTagInput);
        });

        editTagInput.placeholder = currentEditTags.length >= 5 ? '' : 'Type & Press Enter';
    }
    window.renderEditTags = renderEditTags;

    // Show suggestions while typing, hide on Enter
    editTagInput.addEventListener('input', () => {
        if (editTagInput.value.trim().length > 0) {
            tagSuggestions.classList.add('visible');
        } else {
            tagSuggestions.classList.remove('visible');
        }
    });

    editTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = editTagInput.value.trim().replace(/[^a-zA-Z0-9 ]/g, "");
            if (val && !currentEditTags.includes(val) && currentEditTags.length < 5) {
                currentEditTags.push(val);
                renderEditTags();
            }
            editTagInput.value = "";
            tagSuggestions.classList.remove('visible');
        } else if (e.key === 'Backspace' && editTagInput.value === "" && currentEditTags.length > 0) {
            currentEditTags.pop();
            renderEditTags();
        }
    });
});

// Helper: get selected image URL from radio
function getSelectedImageUrl() {
    const selected = document.querySelector('input[name="img-suggest"]:checked');
    return selected ? selected.value : null;
}

// Helper: collect all edit tags (primary image tag + company tags + free-text)
function collectEditTags() {
    const allTags = [];

    // Primary = selected image suggestion
    const primaryRadio = document.querySelector('input[name="img-suggest"]:checked');
    if (primaryRadio) allTags.push(primaryRadio.dataset.tag);

    // Secondary = checked company boxes
    const companyChecked = document.querySelectorAll('input[name="company-tag"]:checked');
    companyChecked.forEach(cb => {
        if (cb.value === '__other__') {
            const otherVal = document.getElementById('company-other-input').value.trim();
            if (otherVal) allTags.push(otherVal);
        } else {
            allTags.push(cb.value);
        }
    });

    // Additional free-text tags
    allTags.push(...currentEditTags);
    return allTags;
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
}

// ==========================================
// 1. LIST VIEW LOGIC (All Statuses + 3 Day Logic + Sort)
// ==========================================
async function loadArticlesLog() {
    const listContent = document.getElementById('list-content');
    const loading = document.getElementById('loading');
<<<<<<< HEAD

    listContent.innerHTML = '';

    try {
=======
    
    listContent.innerHTML = '';
    
    try {
        // 1. Fetch ALL articles sorted by date
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
        const q = query(collection(db, "articles"), orderBy("datePosted", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            loading.style.display = 'none';
            listContent.innerHTML = '<p style="text-align:center; color:#777; margin-top:50px;">No articles found.</p>';
            return;
        }

<<<<<<< HEAD
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(todayStart.getDate() - 1);
        const dayBeforeStart = new Date(todayStart);
        dayBeforeStart.setDate(todayStart.getDate() - 2);

        const todayItems = [];
        const yesterdayItems = [];
        const dayBeforeItems = [];

=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
        const batch = writeBatch(db);
        let hasDeletions = false;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const item = { id: docSnap.id, ...data };
<<<<<<< HEAD

=======
            
            // Normalize Date
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
            let itemDate;
            if (data.datePosted && data.datePosted.toDate) {
                itemDate = data.datePosted.toDate();
            } else {
                itemDate = new Date(data.datePosted);
            }

<<<<<<< HEAD
=======
            // 3. Categorize
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
            if (itemDate >= todayStart) {
                todayItems.push(item);
            } else if (itemDate >= yesterdayStart) {
                yesterdayItems.push(item);
            } else if (itemDate >= dayBeforeStart) {
                dayBeforeItems.push(item);
            } else {
<<<<<<< HEAD
=======
                // Older than 3 days -> Delete if pending
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
                if (data.status === 'pending') {
                    batch.delete(docSnap.ref);
                    hasDeletions = true;
                }
            }
        });

<<<<<<< HEAD
        if (hasDeletions) await batch.commit();

        const sortPendingFirst = (a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return 0;
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
        };

        todayItems.sort(sortPendingFirst);
        yesterdayItems.sort(sortPendingFirst);
        dayBeforeItems.sort(sortPendingFirst);
<<<<<<< HEAD

        loading.style.display = 'none';

        if (todayItems.length > 0) {
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Today <span class="divider-count">${todayItems.length}</span></span>`);
=======
        // ---------------------------------------------------------


        loading.style.display = 'none';

        // 4. Render UI
        if (todayItems.length > 0) {
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Today</span>`);
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
            todayItems.forEach(item => listContent.appendChild(createCard(item)));
        }

        if (yesterdayItems.length > 0) {
<<<<<<< HEAD
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Yesterday <span class="divider-count">${yesterdayItems.length}</span></span>`);
=======
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Yesterday</span>`);
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
            yesterdayItems.forEach(item => listContent.appendChild(createCard(item)));
        }

        if (dayBeforeItems.length > 0) {
            const dateLabel = dayBeforeStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
<<<<<<< HEAD
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">${dateLabel}(2 days ago) <span class="divider-count">${dayBeforeItems.length}</span></span>`);
=======
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">${dateLabel}</span>`);
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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
<<<<<<< HEAD

    let dateObj = data.datePosted && data.datePosted.toDate ? data.datePosted.toDate() : new Date(data.datePosted);
    const dateStr = dateObj.toLocaleDateString('en-GB');

=======
    
    let dateObj = data.datePosted && data.datePosted.toDate ? data.datePosted.toDate() : new Date(data.datePosted);
    const dateStr = dateObj.toLocaleDateString('en-GB');

    // Dynamic Status Logic
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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
<<<<<<< HEAD
=======
    
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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
<<<<<<< HEAD

    // Fill form fields
    document.getElementById('edit-title').value = data.title || "";
    document.getElementById('edit-content-concise').value = data.conciseContent || "";
    document.getElementById('edit-content-technical').value = data.content || "";
    document.getElementById('edit-summary').value = data.summary || "";
    document.getElementById('edit-author').value = data.authorName;
    document.getElementById('edit-date').value = data.datePosted;
    document.getElementById('check-featured').checked = (data.isFeatured === true);

    // Reset all radio and checkbox selections
    document.querySelectorAll('input[name="img-suggest"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="company-tag"]').forEach(c => c.checked = false);

    // Parse existing tags and populate the UI
    const articleTags = data.tags || [];
    const predefinedNames = Object.keys(IMAGE_TAG_MAP);
    currentEditTags = [];

    articleTags.forEach(tag => {
        if (predefinedNames.includes(tag)) {
            // Match image suggestion radio by data-tag
            const radio = document.querySelector(`input[name="img-suggest"][data-tag="${tag}"]`);
            if (radio && !document.querySelector('input[name="img-suggest"]:checked')) {
                radio.checked = true;
            }
        } else if (COMPANY_NAMES.includes(tag)) {
            // Match company checkbox
            const cb = document.querySelector(`input[name="company-tag"][value="${tag}"]`);
            if (cb) cb.checked = true;
        } else {
            if (currentEditTags.length < 3) currentEditTags.push(tag);
        }
    });

    // Render free-text tag chips
    window.renderEditTags();

    // Populate image preview box
    const imgPreview = document.getElementById('edit-img-preview');
    const noImgText = document.getElementById('no-img-text');
    const selectedRadio = document.querySelector('input[name="img-suggest"]:checked');
    if (selectedRadio) {
        imgPreview.src = selectedRadio.value;
        imgPreview.classList.remove('hidden');
        noImgText.style.display = 'none';
    } else {
        imgPreview.classList.add('hidden');
        imgPreview.src = '';
        noImgText.style.display = '';
    }

    // Button text
    const btnApprove = document.getElementById('btn-publish');
    btnApprove.innerText = data.status === 'active' ? "Update Article" : "Approval & Publish";

    document.getElementById('list-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    window.scrollTo(0, 0);
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
}

function closeDetailView() {
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('list-view').classList.remove('hidden');
<<<<<<< HEAD
    window.scrollTo(0, 0);
}

// ==========================================
// 3. ACTIONS
=======
    window.scrollTo(0,0);
}

// ==========================================
// 3. ACTIONS (No Popups)
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
// ==========================================
async function approveAndPublish() {
    const btn = document.getElementById('btn-publish');
    const originalText = btn.innerText;
    btn.innerText = "Publishing...";
    btn.disabled = true;

    try {
        const isFeatured = document.getElementById('check-featured').checked;
        const articlesRef = collection(db, "articles");

<<<<<<< HEAD
        // Limit check
=======
        // 1. LIMIT CHECK (Only if creating new or changing status)
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
        if (originalText.includes("Approval")) {
            const qCount = query(articlesRef, where("status", "==", "active"));
            const snapshot = await getCountFromServer(qCount);
            if (snapshot.data().count >= 420) {
                const qOldest = query(articlesRef, where("status", "==", "active"), orderBy("datePosted", "asc"), limit(1));
                const oldDocs = await getDocs(qOldest);
                if (!oldDocs.empty) await deleteDoc(oldDocs.docs[0].ref);
            }
        }

<<<<<<< HEAD
        // Featured check (max 2)
        if (isFeatured) {
            const qFeatured = query(articlesRef, where("status", "==", "active"), where("isFeatured", "==", true), orderBy("datePosted", "asc"));
            const featSnap = await getDocs(qFeatured);
            if (featSnap.size >= 2) {
                let othersCount = 0;
                featSnap.forEach(doc => { if (doc.id !== currentArticleId) othersCount++; });
                if (othersCount >= 2) {
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
                    await updateDoc(featSnap.docs[0].ref, { isFeatured: false });
                }
            }
        }

<<<<<<< HEAD
        // Get image URL from selected radio
        const imageUrl = getSelectedImageUrl();

        // Update & Publish
        const articleRef = doc(db, "articles", currentArticleId);
        await updateDoc(articleRef, {
            title: document.getElementById('edit-title').value,
            summary: document.getElementById('edit-summary').value,
            conciseContent: document.getElementById('edit-content-concise').value,
            content: document.getElementById('edit-content-technical').value,
            imageUrl: imageUrl || "",
            tags: collectEditTags(),
            status: "active",
            isFeatured: isFeatured,
            datePosted: new Date().toISOString(),
            serialNumber: Date.now()
        });

        btn.innerText = "Done";
        setTimeout(() => {
            closeDetailView();
            loadArticlesLog();
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
            btn.disabled = false;
            btn.innerText = originalText;
        }, 500);

    } catch (e) {
        console.error(e);
<<<<<<< HEAD
        alert("Error: " + e.message);
=======
        alert("Error: " + e.message); 
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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
<<<<<<< HEAD

=======
        
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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

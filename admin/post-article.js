import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
<<<<<<< HEAD
let tags = [];

document.addEventListener('DOMContentLoaded', () => {

=======
let imageBase64 = null;
let tags = [];

document.addEventListener('DOMContentLoaded', () => {
    
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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
<<<<<<< HEAD
    // 2. COMPANY TAG CHECKBOXES (Max 2)
    // ==========================================
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
            // Show/hide Others text input
            if (companyOtherCb.checked) {
                companyOtherInput.classList.remove('hidden');
                companyOtherInput.focus();
            } else {
                companyOtherInput.classList.add('hidden');
                companyOtherInput.value = '';
            }
        });
    });

    // ==========================================
    // 2b. IMAGE PREVIEW on radio change
    // ==========================================
    const imgPreviewBox = document.getElementById('img-preview-box');
    const imgPreview = document.getElementById('img-preview');
    const noImgText = document.getElementById('no-img-text');

    document.querySelectorAll('input[name="img-suggest"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            imgPreview.src = e.target.value;
            imgPreview.classList.remove('hidden');
            noImgText.style.display = 'none';
        });
    });

    // ==========================================
    // 2c. TAG SUGGESTIONS (click to add)
    // ==========================================
    const tagSuggestions = document.getElementById('tag-suggestions');

    document.querySelectorAll('.tag-suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.tag;
            if (val && !tags.includes(val) && tags.length < 5) {
                tags.push(val);
                renderTags();
            }
        });
    });

    // ==========================================
    // 3. TAGS LOGIC (Free-text, max 5)
    // ==========================================
    const tagsContainer = document.getElementById('tags-container');
    const tagInput = document.getElementById('inp-tag-input');
=======
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
        if (file && file.type.startsWith('image/')) {
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
    // 3. TAGS LOGIC (Dynamic Suggestions)
    // ==========================================
    const tagsContainer = document.getElementById('tags-container');
    const tagInput = document.getElementById('inp-tag-input');
    const suggestionsList = document.getElementById('suggestions-list');
    const suggestionsBox = document.getElementById('tag-suggestions-box');

    // Categorized suggestions for contextual logic
    const allSuggestions = ["AI", "Tech", "Finance", "Economy", "India", "Software", "Startup", "Future", "Gadgets", "Market", "Crypto", "Business"];
    
    const contextMap = {
        "AI": ["Software", "Tech", "Future"],
        "Economy": ["Finance", "Market", "India", "Business"],
        "Finance": ["Economy", "Crypto", "Market"],
        "Tech": ["Gadgets", "Software", "AI"],
        "India": ["Economy", "Startup", "Business"]
    };

    // Initially hide the suggestions box
    suggestionsBox.classList.add('hidden');
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7

    function renderTags() {
        const chips = tagsContainer.querySelectorAll('.tag-chip-active');
        chips.forEach(chip => chip.remove());

        tags.forEach((tag, index) => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip-active';
<<<<<<< HEAD
            chip.textContent = tag;
            chip.dataset.index = index;
            chip.addEventListener('click', () => {
                tags.splice(index, 1);
                renderTags();
            });
            tagsContainer.insertBefore(chip, tagInput);
        });

        tagInput.placeholder = tags.length >= 5 ? '' : 'Type & Press Enter';
    }

    // Show suggestions while typing, hide on Enter
    tagInput.addEventListener('input', () => {
        if (tagInput.value.trim().length > 0) {
            tagSuggestions.classList.add('visible');
        } else {
            tagSuggestions.classList.remove('visible');
=======
            chip.innerHTML = `
                ${tag}
                <span class="tag-remove" data-index="${index}">&times;</span>
            `;
            tagsContainer.insertBefore(chip, tagInput);
        });
        
        // Show contextual suggestions after a tag is added
        showContextualSuggestions();
    }

    function showContextualSuggestions() {
        suggestionsList.innerHTML = "";
        let related = new Set();

        // Find related tags based on currently selected tags
        tags.forEach(t => {
            if (contextMap[t]) {
                contextMap[t].forEach(rel => {
                    if (!tags.includes(rel)) related.add(rel);
                });
            }
        });

        if (related.size > 0 && tags.length < 3) {
            suggestionsBox.classList.remove('hidden');
            related.forEach(suggestion => {
                createSuggestionBtn(suggestion);
            });
        } else if (tagInput.value.trim() === "") {
            suggestionsBox.classList.add('hidden');
        }
    }

    function createSuggestionBtn(text) {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "suggestion-btn";
        btn.innerText = text;
        btn.onclick = () => addTag(text);
        suggestionsList.appendChild(btn);
    }

    function addTag(tag) {
        tag = tag.trim().replace(/[^a-zA-Z0-9 ]/g, "");
        if (tag && !tags.includes(tag) && tags.length < 3) {
            tags.push(tag);
            renderTags();
        }
        tagInput.value = "";
        // Keep box visible if there are contextual suggestions, otherwise hide
        if (tags.length >= 3) suggestionsBox.classList.add('hidden');
    }

    tagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-remove')) {
            const index = e.target.getAttribute('data-index');
            tags.splice(index, 1);
            renderTags();
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
        }
    });

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
<<<<<<< HEAD
            const val = tagInput.value.trim().replace(/[^a-zA-Z0-9 ]/g, "");
            if (val && !tags.includes(val) && tags.length < 5) {
                tags.push(val);
                renderTags();
            }
            tagInput.value = "";
            tagSuggestions.classList.remove('visible');
=======
            addTag(tagInput.value);
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
        } else if (e.key === 'Backspace' && tagInput.value === "" && tags.length > 0) {
            tags.pop();
            renderTags();
        }
    });

<<<<<<< HEAD
    // Helper: get the selected image URL from radio buttons
    function getSelectedImageUrl() {
        const selected = document.querySelector('input[name="img-suggest"]:checked');
        return selected ? selected.value : null;
    }

    // Helper: collect all tags (primary image tag + company tags + free-text)
    function collectAllTags() {
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
        allTags.push(...tags);
        return allTags;
    }

    // ==========================================
    // 4. PREVIEW LOGIC
    // ==========================================
    const btnPreview = document.getElementById('btn-preview');
    const previewOverlay = document.getElementById('preview-overlay');
    const btnClosePreview = document.getElementById('btn-close-preview');

    btnPreview.addEventListener('click', () => {
        const titleText = document.getElementById('inp-title').value.trim();
        const contentText = document.getElementById('inp-content').value.trim();
        const imageUrl = getSelectedImageUrl();

        if (!titleText) { alert("Please enter a Title before previewing."); return; }
        if (!contentText) { alert("Please enter Content before previewing."); return; }
        if (!imageUrl) { alert("Please select a primary tag / image before previewing."); return; }

        document.getElementById('preview-headline').innerText = titleText;

        const dateObj = new Date();
        const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        document.getElementById('preview-date').innerText = dateStr;

        const authorName = currentUser ? (currentUser.displayName || currentUser.email) : "Author Name";
        document.getElementById('preview-author-name').innerText = authorName;

        document.getElementById('preview-img').src = imageUrl;

        const formattedContent = contentText.split('\n').map(p => {
            p = p.trim();
            return p ? `<p>${p}</p>` : '';
        }).join('');
        document.getElementById('preview-article-body').innerHTML = formattedContent;

        // Tags
        const previewTagsSection = document.getElementById('preview-tags');
        previewTagsSection.innerHTML = '';
        const allPreviewTags = collectAllTags();
        if (allPreviewTags.length > 0) {
            allPreviewTags.forEach(tag => {
                const tagDiv = document.createElement('div');
                tagDiv.className = 'article-tags';
                tagDiv.innerHTML = `<a href="#">${tag}</a>`;
                previewTagsSection.appendChild(tagDiv);
            });
        }

        previewOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });

    btnClosePreview.addEventListener('click', () => {
        previewOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    });

    // ==========================================
    // 5. SUBMIT
=======
    // Handle Suggestions while typing
    tagInput.addEventListener('input', () => {
        const query = tagInput.value.toLowerCase().trim();
        suggestionsList.innerHTML = "";

        if (query.length > 0 && tags.length < 3) {
            suggestionsBox.classList.remove('hidden');
            const filtered = allSuggestions.filter(s => 
                s.toLowerCase().includes(query) && !tags.includes(s)
            );

            filtered.forEach(suggestion => createSuggestionBtn(suggestion));
        } else {
            // If input is empty, revert to showing contextual suggestions based on existing tags
            showContextualSuggestions();
        }
    });
        
    // ==========================================
    // 4. SUBMIT (Corrected)
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
    // ==========================================
    const form = document.getElementById('post-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

<<<<<<< HEAD
        const imageUrl = getSelectedImageUrl();
        if (!imageUrl) {
            alert("Please select a primary tag / image.");
=======
        if (!imageBase64) {
            alert("Please upload a cover image.");
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
            return;
        }

        const btn = form.querySelector('.submit-btn');
        btn.disabled = true;
        btn.innerText = "Sending...";

        try {
<<<<<<< HEAD
            const targetLevel = document.getElementById('inp-target-level').value;
            const writtenText = document.getElementById('inp-content').value;
            const titleText = document.getElementById('inp-title').value;
            const summaryText = document.getElementById('inp-summary').value;

            const newArticle = {
                title: titleText,
                summary: summaryText,

                content: targetLevel === 'intermediate' ? writtenText : "",
                conciseContent: targetLevel === 'concise' ? writtenText : "",

                tags: collectAllTags(),
                imageUrl: imageUrl,

                authorEmail: currentUser.email,
                authorName: currentUser.displayName,
                authorId: currentUser.uid,
                datePosted: new Date().toISOString(),
                timestamp: serverTimestamp(),

                status: "pending",
                isFeatured: false,
                serialNumber: Date.now(),
=======
            // 2. Capture Data using .innerHTML for rich-text divs
            const targetLevel = document.getElementById('inp-target-level').value;
            const writtenText = document.getElementById('inp-content').value; 
            const titleText = document.getElementById('inp-title').value;     
            const summaryText = document.getElementById('inp-summary').value;    // STANDARD INPUT

            // 3. Construct Article Object
            const newArticle = {
                title: titleText,      // FIXED: Uses the captured innerHTML
                summary: summaryText,  // FIXED: Uses the summary variable
                
                // MAPPING LOGIC
                content: targetLevel === 'intermediate' ? writtenText : "",
                contentBeginner: targetLevel === 'beginner' ? writtenText : "",
                contentPro: targetLevel === 'pro' ? writtenText : "",
                
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
                stats: { views: 0, likes: 0, saves: 0 }
            };

            await addDoc(collection(db, "articles"), newArticle);
<<<<<<< HEAD
            alert("Article Sent for Approval!");
            window.location.href = "/main/index.html";
=======

            alert("Article Sent for Approval! The remaining versions will be generated automatically.");
            window.location.href = "/main/index.html"; 
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7

        } catch (error) {
            console.error("Error posting:", error);
            alert("Failed to send article: " + error.message);
            btn.disabled = false;
            btn.innerText = "Send for Approval";
        }
    });
});
<<<<<<< HEAD
=======



>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7

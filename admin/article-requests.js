import {
    getFirestore,
    collection,
    query,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    orderBy,
    limit,
    getCountFromServer,
    writeBatch,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { app } from '/Article/firebase-db.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

const db = getFirestore(app);

// Global formatting function for Markdown toolbar
window.applyStyle = function(type, textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end, text.length);

    let newText = text;
    let newCursorPos = end;

    switch(type) {
        case 'h1': newText = before + '# ' + selected + after; newCursorPos = end + 2; break;
        case 'h2': newText = before + '## ' + selected + after; newCursorPos = end + 3; break;
        case 'h3': newText = before + '### ' + selected + after; newCursorPos = end + 4; break;
        case 'bold': newText = before + '**' + selected + '**' + after; newCursorPos = end + 2; break;
        case 'italic': newText = before + '_' + selected + '_' + after; newCursorPos = end + 1; break;
        case 'list': newText = before + '- ' + selected + after; newCursorPos = end + 2; break;
        case 'code': newText = before + '`' + selected + '`' + after; newCursorPos = end + 1; break;
        case 'quote': newText = before + '> ' + selected + after; newCursorPos = end + 2; break;
        case 'line': newText = before + '\n---\n' + selected + after; newCursorPos = end + 5; break;
        case 'table': 
            const tableTemplate = "\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n";
            newText = before + tableTemplate + selected + after; 
            newCursorPos = start + tableTemplate.length; 
            break;
    }

    textarea.value = newText;
    textarea.focus();
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;

    // Trigger preview update
    textarea.dispatchEvent(new Event('input'));
};

// State
let currentArticleId = null;
let currentEditTags = []; // free-text tags for editing

// Company names for secondary tag matching
const COMPANY_NAMES = ['Google', 'OpenAI', 'Anthropic', 'Apple', 'Nvidia', 'Meta', 'Microsoft', 'Amazon', 'Tesla', 'Samsung', 'xAI', 'DeepMind'];

// Image tag data — loaded dynamically from JSON
let IMG_TAGS_DATA = [];
let IMAGE_TAG_MAP = {};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Page Data
    loadArticlesLog();
    setupDetailLogic();

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

    // 2b. IMAGE TAGS — DYNAMIC FROM JSON
    const imgPreview = document.getElementById('edit-img-preview');
    const noImgText = document.getElementById('no-img-text');
    const imgSuggestContainer = document.getElementById('edit-img-suggest-options');

    try {
        const imgTagsRes = await fetch('/assets/tags/img-tags.json');
        IMG_TAGS_DATA = await imgTagsRes.json();

        // Build IMAGE_TAG_MAP from fetched data
        IMG_TAGS_DATA.forEach(tag => {
            IMAGE_TAG_MAP[tag.name] = tag.path;
        });

        // Render radio buttons
        IMG_TAGS_DATA.forEach(tag => {
            const id = 'suggest-' + tag.name.toLowerCase().replace(/\s+/g, '-');
            const div = document.createElement('div');
            div.className = 'img-suggest-option';
            div.innerHTML = `
                <input type="radio" name="img-suggest" id="${id}" value="${tag.path}" data-tag="${tag.name}">
                <label for="${id}">${tag.name}</label>
            `;
            imgSuggestContainer.appendChild(div);

            // Attach preview listener
            div.querySelector('input').addEventListener('change', (e) => {
                imgPreview.src = e.target.value;
                imgPreview.classList.remove('hidden');
                noImgText.style.display = 'none';
            });
        });
    } catch (e) { console.error('Error loading image tags:', e); }

    // 2c. TAG SUGGESTIONS (dynamic via typing)
    const tagSuggestions = document.getElementById('tag-suggestions');

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

    // PREDEFINED LOCAL TAGS FOR SUGGESTIONS
    // PREDEFINED TAGS — LOADED FROM JSON
    let PREDEFINED_TAGS = [];
    try {
        const tagsRes = await fetch('/assets/tags/tag-suggestions.json');
        PREDEFINED_TAGS = await tagsRes.json();
    } catch (e) { console.error('Error loading tag suggestions:', e); }

    // Show suggestions while typing, hide on Enter
    let editSuggestionTimeout;

    editTagInput.addEventListener('input', () => {
        const val = editTagInput.value.trim().replace(/[^a-zA-Z0-9 ]/g, "");
        if (val.length > 0) {
            clearTimeout(editSuggestionTimeout);
            editSuggestionTimeout = setTimeout(() => {
                fetchEditSuggestions(val);
            }, 100); // 100ms debounce for local search
        } else {
            tagSuggestions.classList.remove('visible');
        }
    });

    function fetchEditSuggestions(userInput) {
        const query = userInput.toLowerCase();
        // Filter local array
        const results = PREDEFINED_TAGS.filter(tag => tag.toLowerCase().startsWith(query)).slice(0, 8);

        if (results.length > 0) {
            tagSuggestions.innerHTML = '<p style="font-size: 0.8rem; color: #888; margin-bottom: 5px;">Suggestions:</p>';
            results.forEach(word => {
                const span = document.createElement('span');
                span.className = 'tag-suggest-btn';
                span.textContent = word;
                span.dataset.tag = word;

                span.addEventListener('click', () => {
                    if (word && !currentEditTags.includes(word) && currentEditTags.length < 5) {
                        currentEditTags.push(word);
                        renderEditTags();
                    }
                    editTagInput.value = "";
                    tagSuggestions.classList.remove('visible');
                });

                tagSuggestions.appendChild(span);
            });
            tagSuggestions.classList.add('visible');
        } else {
            tagSuggestions.classList.remove('visible');
        }
    }

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

    // MARKDOWN LIVE PREVIEW for both textareas
    marked.setOptions({ breaks: true, gfm: true });

    const conciseTA = document.getElementById('edit-content-concise');
    const technicalTA = document.getElementById('edit-content-technical');
    const concisePreview = document.getElementById('preview-content-concise');
    const technicalPreview = document.getElementById('preview-content-technical');

    if (conciseTA && concisePreview) {
        conciseTA.addEventListener('input', () => {
            const raw = conciseTA.value.trim();
            const label = concisePreview.previousElementSibling;
            if (raw) {
                concisePreview.style.display = 'block';
                if (label) label.style.display = 'block';
                concisePreview.innerHTML = marked.parse(raw);
            } else {
                concisePreview.style.display = 'none';
                if (label) label.style.display = 'none';
                concisePreview.innerHTML = '';
            }
        });
    }
    if (technicalTA && technicalPreview) {
        technicalTA.addEventListener('input', () => {
            const raw = technicalTA.value.trim();
            const label = technicalPreview.previousElementSibling;
            if (raw) {
                technicalPreview.style.display = 'block';
                if (label) label.style.display = 'block';
                technicalPreview.innerHTML = marked.parse(raw);
            } else {
                technicalPreview.style.display = 'none';
                if (label) label.style.display = 'none';
                technicalPreview.innerHTML = '';
            }
        });
    }
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
}

// ==========================================
// 1. LIST VIEW LOGIC (All Statuses + 3 Day Logic + Sort)
// ==========================================
async function loadArticlesLog() {
    const listContent = document.getElementById('list-content');
    const loading = document.getElementById('loading');

    listContent.innerHTML = '';

    try {
        const q = query(collection(db, "articles"), orderBy("datePosted", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            loading.style.display = 'none';
            listContent.innerHTML = '<p style="text-align:center; color:#777; margin-top:50px;">No articles found.</p>';
            return;
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(todayStart.getDate() - 1);
        const dayBeforeStart = new Date(todayStart);
        dayBeforeStart.setDate(todayStart.getDate() - 2);

        const todayItems = [];
        const yesterdayItems = [];
        const dayBeforeItems = [];

        const batch = writeBatch(db);
        let hasDeletions = false;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const item = { id: docSnap.id, ...data };

            let itemDate;
            if (data.datePosted && data.datePosted.toDate) {
                itemDate = data.datePosted.toDate();
            } else {
                itemDate = new Date(data.datePosted);
            }

            if (itemDate >= todayStart) {
                todayItems.push(item);
            } else if (itemDate >= yesterdayStart) {
                yesterdayItems.push(item);
            } else if (itemDate >= dayBeforeStart) {
                dayBeforeItems.push(item);
            } else {
                if (data.status === 'pending') {
                    batch.delete(docSnap.ref);
                    hasDeletions = true;
                }
            }
        });

        if (hasDeletions) await batch.commit();

        const sortPendingFirst = (a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return 0;
        };

        todayItems.sort(sortPendingFirst);
        yesterdayItems.sort(sortPendingFirst);
        dayBeforeItems.sort(sortPendingFirst);

        loading.style.display = 'none';

        if (todayItems.length > 0) {
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Today <span class="divider-count">${todayItems.length}</span></span>`);
            todayItems.forEach(item => listContent.appendChild(createCard(item)));
        }

        if (yesterdayItems.length > 0) {
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">Yesterday <span class="divider-count">${yesterdayItems.length}</span></span>`);
            yesterdayItems.forEach(item => listContent.appendChild(createCard(item)));
        }

        if (dayBeforeItems.length > 0) {
            const dateLabel = dayBeforeStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            listContent.insertAdjacentHTML('beforeend', `<span class="date-divider">${dateLabel}(2 days ago) <span class="divider-count">${dayBeforeItems.length}</span></span>`);
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

    const isPending = data.status === 'pending';
    const statusText = isPending ? 'Pending' : 'Approved';
    const statusColorClass = isPending ? 'status-red' : 'status-black';

    div.innerHTML = `
        <img src="${data.imageUrl}" class="card-img" alt="${data.title}" loading="lazy">
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

    // Render Markdown previews for the loaded content (only show if non-empty)
    const concisePreview = document.getElementById('preview-content-concise');
    const technicalPreview = document.getElementById('preview-content-technical');
    const conciseVal = document.getElementById('edit-content-concise').value.trim();
    const technicalVal = document.getElementById('edit-content-technical').value.trim();

    if (concisePreview) {
        const cLabel = concisePreview.previousElementSibling;
        if (conciseVal) {
            concisePreview.style.display = 'block';
            if (cLabel) cLabel.style.display = 'block';
            concisePreview.innerHTML = marked.parse(conciseVal);
        } else {
            concisePreview.style.display = 'none';
            if (cLabel) cLabel.style.display = 'none';
        }
    }
    if (technicalPreview) {
        const tLabel = technicalPreview.previousElementSibling;
        if (technicalVal) {
            technicalPreview.style.display = 'block';
            if (tLabel) tLabel.style.display = 'block';
            technicalPreview.innerHTML = marked.parse(technicalVal);
        } else {
            technicalPreview.style.display = 'none';
            if (tLabel) tLabel.style.display = 'none';
        }
    }
}

function closeDetailView() {
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('list-view').classList.remove('hidden');
    window.scrollTo(0, 0);
}

// ==========================================
// 3. ACTIONS
// ==========================================
async function approveAndPublish() {
    const btn = document.getElementById('btn-publish');
    const originalText = btn.innerText;
    btn.innerText = "Publishing...";
    btn.disabled = true;

    try {
        const isFeatured = document.getElementById('check-featured').checked;
        const articlesRef = collection(db, "articles");

        // Limit check
        if (originalText.includes("Approval")) {
            const qCount = query(articlesRef, where("status", "==", "active"));
            const snapshot = await getCountFromServer(qCount);
            if (snapshot.data().count >= 420) {
                const qOldest = query(articlesRef, where("status", "==", "active"), orderBy("datePosted", "asc"), limit(1));
                const oldDocs = await getDocs(qOldest);
                if (!oldDocs.empty) await deleteDoc(oldDocs.docs[0].ref);
            }
        }

        // Featured check (max 2)
        if (isFeatured) {
            const qFeatured = query(articlesRef, where("status", "==", "active"), where("isFeatured", "==", true), orderBy("datePosted", "asc"));
            const featSnap = await getDocs(qFeatured);
            if (featSnap.size >= 2) {
                let othersCount = 0;
                featSnap.forEach(doc => { if (doc.id !== currentArticleId) othersCount++; });
                if (othersCount >= 2) {
                    await updateDoc(featSnap.docs[0].ref, { isFeatured: false });
                }
            }
        }

        // Get image URL from selected radio
        const imageUrl = getSelectedImageUrl();

        // Update & Publish
        const articleRef = doc(db, "articles", currentArticleId);

        // Fetch current doc to see if it's already active
        const currentDocSnap = await getDoc(articleRef);
        let status = "pending";
        let existingSerial = 0;
        if(currentDocSnap.exists()) {
             status = currentDocSnap.data().status;
             existingSerial = currentDocSnap.data().serialNumber || 0;
        }

        let finalSerialNumber = existingSerial;
        if (status !== 'active') {
             // It's going from pending to active, assign new serial
             try {
                const qSerial = query(articlesRef, orderBy("serialNumber", "desc"), limit(1));
                const snapSerial = await getDocs(qSerial);
                if (!snapSerial.empty) {
                    finalSerialNumber = (snapSerial.docs[0].data().serialNumber || 0) + 1;
                } else {
                    finalSerialNumber = 1;
                }
            } catch(e) { console.error("Error fetching max serialNumber:", e); }
        }

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
            updatedAt: Date.now(), // Added for Cache Sync
            serialNumber: finalSerialNumber // Fixed pagination
        });

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

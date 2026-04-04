import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

const auth = getAuth(app);
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

let currentUser = null;
let tags = [];

document.addEventListener('DOMContentLoaded', async () => {

    // 1. CHECK AUTH
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('inp-author').value = user.displayName || user.email;
        } else {
            alert("You must be logged in.");
            window.location.href = "/";
        }
    });

    document.getElementById('inp-date').value = new Date().toISOString();

    // MARKDOWN LIVE PREVIEW — two separate textboxes
    marked.setOptions({ breaks: true, gfm: true });

    function setupPreview(textareaId, previewId, labelId) {
        const ta = document.getElementById(textareaId);
        const preview = document.getElementById(previewId);
        const label = document.getElementById(labelId);
        if (ta && preview) {
            ta.addEventListener('input', () => {
                const raw = ta.value.trim();
                if (raw) {
                    preview.style.display = 'block';
                    if (label) label.style.display = 'block';
                    preview.innerHTML = marked.parse(raw);
                } else {
                    preview.style.display = 'none';
                    if (label) label.style.display = 'none';
                    preview.innerHTML = '';
                }
            });
        }
    }
    setupPreview('inp-content-concise', 'preview-concise', 'preview-label-concise');
    setupPreview('inp-content-technical', 'preview-technical', 'preview-label-technical');

    // ==========================================
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
    // 2b. IMAGE TAGS — DYNAMIC FROM JSON
    // ==========================================
    const imgPreviewBox = document.getElementById('img-preview-box');
    const imgPreview = document.getElementById('img-preview');
    const noImgText = document.getElementById('no-img-text');
    const imgSuggestContainer = document.getElementById('img-suggest-options');

    try {
        const imgTagsRes = await fetch('/assets/tags/img-tags.json');
        const imgTags = await imgTagsRes.json();

        imgTags.forEach(tag => {
            const id = 'post-suggest-' + tag.name.toLowerCase().replace(/\s+/g, '-');
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

    // ==========================================
    // 2c. TAG SUGGESTIONS (removed static buttons — now dynamic via typing)
    // ==========================================
    const tagSuggestions = document.getElementById('tag-suggestions');

    // ==========================================
    // 3. TAGS LOGIC (Free-text, max 5)
    // ==========================================
    const tagsContainer = document.getElementById('tags-container');
    const tagInput = document.getElementById('inp-tag-input');

    function renderTags() {
        const chips = tagsContainer.querySelectorAll('.tag-chip-active');
        chips.forEach(chip => chip.remove());

        tags.forEach((tag, index) => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip-active';
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

    // PREDEFINED TAGS — LOADED FROM JSON
    let PREDEFINED_TAGS = [];
    try {
        const tagsRes = await fetch('/assets/tags/tag-suggestions.json');
        PREDEFINED_TAGS = await tagsRes.json();
    } catch (e) { console.error('Error loading tag suggestions:', e); }

    // Show suggestions while typing, hide on Enter
    let suggestionTimeout;

    tagInput.addEventListener('input', () => {
        const val = tagInput.value.trim().replace(/[^a-zA-Z0-9 ]/g, "");
        if (val.length > 0) {
            clearTimeout(suggestionTimeout);
            suggestionTimeout = setTimeout(() => {
                fetchSuggestions(val);
            }, 100); // 100ms debounce for local search
        } else {
            tagSuggestions.classList.remove('visible');
        }
    });

    function fetchSuggestions(userInput) {
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
                    if (word && !tags.includes(word) && tags.length < 5) {
                        tags.push(word);
                        renderTags();
                    }
                    tagInput.value = "";
                    tagSuggestions.classList.remove('visible');
                });
                tagSuggestions.appendChild(span);
            });
            tagSuggestions.classList.add('visible');
        } else {
            tagSuggestions.classList.remove('visible');
        }
    }

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = tagInput.value.trim().replace(/[^a-zA-Z0-9 ]/g, "");
            if (val && !tags.includes(val) && tags.length < 5) {
                tags.push(val);
                renderTags();
            }
            tagInput.value = "";
            tagSuggestions.classList.remove('visible');
        } else if (e.key === 'Backspace' && tagInput.value === "" && tags.length > 0) {
            tags.pop();
            renderTags();
        }
    });

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
    // 4. PREVIEW LOGIC (Redirect to article.html)
    // ==========================================
    const btnPreview = document.getElementById('btn-preview');

    btnPreview.addEventListener('click', () => {
        const titleText = document.getElementById('inp-title').value.trim();
        const contentText = document.getElementById('inp-content').value.trim();
        const summaryText = document.getElementById('inp-summary').value.trim();
        const targetLevel = document.getElementById('inp-target-level').value;
        const imageUrl = getSelectedImageUrl();

        if (!titleText) { alert("Please enter a Title before previewing."); return; }
        if (!contentText) { alert("Please enter Content before previewing."); return; }
        if (!imageUrl) { alert("Please select a primary tag / image before previewing."); return; }

        const authorNameStr = currentUser ? (currentUser.displayName || currentUser.email) : "Author Name";

        // Construct article object mimicking DB structure
        const previewData = {
            id: 'preview',
            title: titleText,
            summary: summaryText,
            content: targetLevel === 'intermediate' ? contentText : "",
            conciseContent: targetLevel === 'concise' ? contentText : "",
            imageUrl: imageUrl,
            tags: collectAllTags(),
            authorName: authorNameStr,
            authorEmail: currentUser ? currentUser.email : "",
            datePosted: new Date().toISOString() // Fake date
        };

        // Save to sessionStorage
        sessionStorage.setItem('previewArticle', JSON.stringify(previewData));

        // Open in same tab
        window.location.href = '/article?preview=true';
    });


    // ==========================================
    // 5. SUBMIT
    // ==========================================
    const form = document.getElementById('post-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const imageUrl = getSelectedImageUrl();
        if (!imageUrl) {
            alert("Please select a primary tag / image.");
            return;
        }

        const btn = form.querySelector('.submit-btn');
        btn.disabled = true;
        btn.innerText = "Sending...";

        try {
            const conciseText = document.getElementById('inp-content-concise').value;
            const technicalText = document.getElementById('inp-content-technical').value;
            const titleText = document.getElementById('inp-title').value;
            const summaryText = document.getElementById('inp-summary').value;

            // FETCH HIGHEST SERIAL NUMBER
            let newSerialNumber = 1;
            try {
                const q = query(collection(db, "articles"), orderBy("serialNumber", "desc"), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    newSerialNumber = (snap.docs[0].data().serialNumber || 0) + 1;
                }
            } catch(e) { console.error("Error fetching max serialNumber:", e); }

            const newArticle = {
                title: titleText,
                summary: summaryText,

                content: technicalText,
                conciseContent: conciseText,

                tags: collectAllTags(),
                imageUrl: imageUrl,

                authorEmail: currentUser.email,
                authorName: currentUser.displayName,
                authorId: currentUser.uid,
                datePosted: new Date().toISOString(),
                timestamp: serverTimestamp(),
                updatedAt: Date.now(), // Added for Cache Sync

                status: "pending",
                isFeatured: false,
                serialNumber: newSerialNumber, // Fixed pagination tracking
                stats: { views: 0, likes: 0, saves: 0 }
            };

            await addDoc(collection(db, "articles"), newArticle);
            alert("Article Sent for Approval!");
            window.location.href = "/";

        } catch (error) {
            console.error("Error posting:", error);
            alert("Failed to send article: " + error.message);
            btn.disabled = false;
            btn.innerText = "Send for Approval";
        }
    });
});

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '/Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
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

    // PREDEFINED LOCAL TAGS FOR SUGGESTIONS
    const PREDEFINED_TAGS = [
        "Algorithms", "Image Modal", "Video Modal", "LLMs", "Research", "Google", "AI Agents",
        "Artificial Intelligence", "Machine Learning", "Deep Learning", "Neural Networks",
        "Generative AI", "NLP", "Computer Vision", "Robotics", "Automation",
        "Startup", "Funding", "Venture Capital", "SaaS", "Entrepreneurship", "Fintech",
        "Tech", "Software", "Hardware", "Cloud Computing", "Cybersecurity", "Blockchain",
        "OpenAI", "Anthropic", "Meta", "Microsoft", "Apple", "Nvidia", "Data Science",
        "Analytics", "Web3", "Crypto", "AR/VR", "IoT", "5G", "Quantum Computing",
        "Open Source", "Ethics", "Regulation", "Dataset", "Benchmark", "Training", "Multimodal"
    ];

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
        window.location.href = '/articles/article.html?preview=true';
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
                stats: { views: 0, likes: 0, saves: 0 }
            };

            await addDoc(collection(db, "articles"), newArticle);
            alert("Article Sent for Approval!");
            window.location.href = "/main/index.html";

        } catch (error) {
            console.error("Error posting:", error);
            alert("Failed to send article: " + error.message);
            btn.disabled = false;
            btn.innerText = "Send for Approval";
        }
    });
});

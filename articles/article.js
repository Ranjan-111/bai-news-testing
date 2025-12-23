// ==========================================
// FOLLOW BUTTON LOGIC
// ==========================================
function initFollowButton() {
    const followBtn = document.querySelector('.follow-btn');
    const authorNameEl = document.querySelector('.author-name');

    // Safety check: only run if button exists on this page
    if (!followBtn || !authorNameEl) return;

    const authorName = authorNameEl.textContent.trim();
    const storageKey = `isFollowing_${authorName}`; // Unique key: "isFollowing_Priyanshu"

    // 1. CHECK STATE ON LOAD (Zero Delay)
    if (localStorage.getItem(storageKey) === 'true') {
        setFollowedState();
    }

    // 2. HANDLE CLICK
    followBtn.addEventListener('click', () => {
        const isCurrentlyFollowing = followBtn.classList.contains('following');

        if (isCurrentlyFollowing) {
            // UNFOLLOW
            setUnfollowedState();
            localStorage.removeItem(storageKey);
        } else {
            // FOLLOW
            setFollowedState();
            localStorage.setItem(storageKey, 'true');
        }
    });

    // --- Helpers ---
    function setFollowedState() {
        followBtn.textContent = 'Following';
        followBtn.classList.add('following');
    }

    function setUnfollowedState() {
        followBtn.textContent = 'Follow';
        followBtn.classList.remove('following');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // ... your other init functions ...
    initFollowButton();
});







document.addEventListener("DOMContentLoaded", () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);

    // 1. WhatsApp
    const wa = document.getElementById('share-wa');
    if(wa) wa.href = `https://api.whatsapp.com/send?text=${title}%20${url}`;

    // 2. X (Twitter)
    const x = document.getElementById('share-x');
    if(x) x.href = `https://twitter.com/intent/tweet?text=${title}&url=${url}`;

    // 3. LinkedIn
    const li = document.getElementById('share-li');
    if(li) li.href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;

    // 4. Copy Link
    const copyBtn = document.getElementById('share-copy');
    if(copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href);
            alert("Link copied!"); // Or use your Toast
        });
    }
});
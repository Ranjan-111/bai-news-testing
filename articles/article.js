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








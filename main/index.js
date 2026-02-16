// Import auth and db from your config file
import { getFeaturedNews, subscribeLatestNews, auth, db } from '/Article/firebase-db.js';

// Import Auth Listener
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Import Firestore functions (doc, getDoc were missing)
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. TYPEWRITER AUTH GUARD ---
    onAuthStateChanged(auth, (user) => {
        const typeElement = document.querySelector('.typewrite');
        const wrap = typeElement ? typeElement.querySelector('.wrap') : null;
        const hasPlayed = sessionStorage.getItem('typewriterPlayed');

        // ONLY animate if user is logged in AND hasn't seen it this session
        if (user && !hasPlayed) {
            // Clear the hardcoded text before starting the animation
            if (wrap) wrap.innerHTML = ''; 
            
            initTypewriter();
            sessionStorage.setItem('typewriterPlayed', 'true');
        } else {
            // Fallback: If guest or already played, ensure hardcoded text stays visible 
            // and remove the typing cursor border
            if (wrap) {
                wrap.style.borderRight = "none";
            }
        }
    });
    // --- 2. FEATURED NEWS LOGIC ---
    const featSkeleton = document.getElementById('featured-skeleton');
    const featReal = document.getElementById('featured-real');

    try {
        const featuredArticles = await getFeaturedNews();
        if (featuredArticles.length >= 1) updateFeaturedCard('.Article.LEFT', featuredArticles[0]);
        if (featuredArticles.length >= 2) updateFeaturedCard('.Article.RIGHT', featuredArticles[1]);

        if (featSkeleton) featSkeleton.classList.add('hidden');
        if (featReal) {
            featReal.classList.remove('hidden');
            featReal.classList.add('fade-in');
        }
    } catch (e) { 
        console.error("Featured News Error:", e);
        if (featSkeleton) featSkeleton.classList.add('hidden');
    }

    // --- 3. LATEST NEWS TICKER ---
    initLatestNews();

    // --- 4. PROMO LOGIC (Banner & Popup) ---
    initPromoSystem();
});

document.addEventListener('keydown', function(e) {
  // 1. Identify if the user is typing in an input, textarea, or contentEditable element
  const isTyping = e.target.tagName === 'INPUT' || 
                   e.target.tagName === 'TEXTAREA' || 
                   e.target.isContentEditable;

  // 2. If they ARE typing, do nothing and let the letter appear in the box
  if (isTyping) return;

  const pressedKeys = {};

  // 3. Define your lowercase shortcuts
  switch (e.key.toLowerCase()) {
    case 's':
      window.location.href = '/students/Students.html';
      break;
    case 'i':
      window.location.href = '/others/x-error.html';
      break;
    case 'm':
      window.location.href = '/articles/multi-article.html';
      break;
  }
});

function initPromoSystem() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Check User Role in DB
                const userRef = doc(db, "users", user.email);
                const snap = await getDoc(userRef);

                if (snap.exists()) {
                    const data = snap.data();
                    
                    // Normalize role to lowercase to avoid "Admin" vs "admin" bugs
                    const userRole = data.role ? data.role.toLowerCase() : "reader";
                    
                    console.log(`👤 Logged in as: ${user.email} | Role: ${userRole}`);

                    // SHOW POPUP ONLY IF:
                    // 1. Not an Author
                    // 2. Not an Admin
                    // 3. Not a Pending Applicant (reporter_candidate)
                    if (userRole !== 'author' && userRole !== 'admin' && userRole !== 'reporter_candidate') {
                        showPromos();
                    } else {
                        console.log("✅ Promo hidden for this role.");
                    }
                }
            } catch (e) {
                console.error("Error checking role:", e);
            }
        }
    });
}
function showPromos() {
    const banner = document.getElementById('promo-banner');
    const popup = document.getElementById('apply-popup');
    const closeBtn = document.getElementById('close-apply-popup');

    // 1. Show Banner immediately
    if (banner) banner.classList.remove('hidden');

    // 2. Show Popup with slight delay (for better UX)
    if (popup) {
        setTimeout(() => {
            // Optional: Check session storage so it doesn't pop up every single refresh
            if (!sessionStorage.getItem('hideApplyPopup')) {
                popup.classList.remove('hidden');
            }
        }, 1000); // 2 second delay

        
    }
}

function updateFeaturedCard(selector, data) {
    const card = document.querySelector(selector);
    if (!card) return;

    const img = card.querySelector('.img');
    if (img && data.imageUrl) img.src = data.imageUrl;

    const title = card.querySelector('h3');
    if (title) title.innerText = capitalizeWords(data.title);

    const dateEl = card.querySelector('.date');
    if (dateEl && data.datePosted) {
        let dateObj = typeof data.datePosted.toDate === 'function' ? data.datePosted.toDate() : new Date(data.datePosted);
        dateEl.innerText = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const summaryEl = card.querySelector('.info p:not(.date)');
    if (summaryEl && data.summary) summaryEl.innerText = data.summary;

    card.style.cursor = "pointer";
    card.onclick = () => window.location.href = `/articles/article.html?id=${data.id}`;
}

function initLatestNews() {
    const container = document.getElementById('latest-news-container');
    
    // Select the Wrappers
    const skeletonView = document.getElementById('latest-skeleton-view');
    const realView = document.getElementById('latest-real-view');

    if (!container) return;

    // --- A. MOBILE TAP LOGIC ---
    container.addEventListener('click', function(e) {
        if (window.innerWidth > 600) return; // Only for Mobile

        const card = e.target.closest('.news-card');
        if (!card) return; 

        // Check if clicked the Headline Link
        const link = card.querySelector('a');
        if (link && link.contains(e.target)) {
            // IF CLOSED: Stop link, open details
            if (!card.classList.contains('active')) {
                e.preventDefault(); 
                // Close others (Accordion style)
                document.querySelectorAll('.news-card.active').forEach(c => {
                    c.classList.remove('active');
                });
                card.classList.add('active');
            }
            // IF OPEN: Do nothing (let link go to page)
        }
    });

    // --- B. LOAD DATA ---
    subscribeLatestNews((articles) => {
        container.innerHTML = ''; 
        
        if (articles.length === 0) { 
            container.innerHTML = '<p style="padding:20px;">No updates yet.</p>'; 
        } else {
            articles.forEach(article => {
                let dateObj = typeof article.datePosted.toDate === 'function' ? article.datePosted.toDate() : new Date(article.datePosted);
                const timeAgo = getTimeAgo(dateObj);
                const dateString = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                const html = `
                    <section class="timeline-item">
                        <section class="time">${timeAgo}</section>
                        <section class="news-card">
                            <a href="/articles/article.html?id=${article.id}" style="text-decoration:none; color:inherit;">
                                <h3>${capitalizeWords(article.title)}</h3>
                            </a>
                            <section class="details">
                                <p><em>Reported: ${dateString}</em></p>
                                <p><em>${article.summary}</em></p>
                            </section>
                        </section>
                    </section>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }

        // --- C. SWAP VIEWS ---
        // 1. Unhide the container itself (just in case)
        container.classList.remove('hidden');

        // 2. Hide Skeleton Wrapper
        if (skeletonView) skeletonView.classList.add('hidden');
        
        // 3. Show Real Wrapper
        if (realView) {
            realView.classList.remove('hidden');
            realView.classList.add('fade-in');
        }
    });
}

function capitalizeWords(str) {
  const words = str.split(" ");

  for (let i = 0; i < words.length; i++) {
    words[i] =
      words[i].charAt(0).toUpperCase() +
      words[i].slice(1).toLowerCase();
  }

  return words.join(" ");
}


function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 3600;
    if (interval > 24) return Math.floor(interval / 24) + " days";
    if (interval > 1) return Math.floor(interval) + " hours";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins";
    return "Just now";
}


// --- STEPPED SCROLL LOGIC ---
const sections = [
    { selector: '.HOME' },
    { selector: '.page1' }, // Featured Section
    { selector: '.PAGE:nth-of-type(2)' }, // Latest News
    { selector: '.PAGE:nth-of-type(3)' }  // Top News
];

let currentSectionIndex = 0;
let isSteppedScrolling = true;

document.addEventListener('keydown', (e) => {
    // Don't interfere if user is typing
    const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
    if (isTyping) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (isSteppedScrolling) {
            e.preventDefault(); // Prevent default jumpy scroll

            if (e.key === 'ArrowDown') {
                if (currentSectionIndex < sections.length - 1) {
                    currentSectionIndex++;
                    scrollToSection(currentSectionIndex);
                } else {
                    // At the very bottom? Allow normal scrolling behavior now
                    isSteppedScrolling = false;
                }
            } else if (e.key === 'ArrowUp') {
                if (currentSectionIndex > 0) {
                    currentSectionIndex--;
                    scrollToSection(currentSectionIndex);
                }
            }
        } else {
            // If we reached the end of steps and user scrolls back up
            if (e.key === 'ArrowUp' && window.scrollY < document.body.scrollHeight - window.innerHeight) {
                // Re-enable stepped scrolling when heading back up
                // Optional: currentSectionIndex = sections.length - 1;
                // isSteppedScrolling = true;
            }
        }
    }
});

function scrollToSection(index) {
    const target = document.querySelector(sections[index].selector);
    if (target) {
        target.scrollIntoView({
            behavior: 'smooth',
            block: 'center' // This puts the section in the middle of the screen
        });
    }
}

// Reset index if user scrolls manually with mouse
window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + window.innerHeight / 2;
    sections.forEach((sec, idx) => {
        const el = document.querySelector(sec.selector);
        if (el) {
            const offsetTop = el.offsetTop;
            const offsetBottom = offsetTop + el.offsetHeight;
            if (scrollPos >= offsetTop && scrollPos <= offsetBottom) {
                currentSectionIndex = idx;
                // Re-engage stepped logic if they scrolled back into range
                isSteppedScrolling = true; 
            }
        }
    });
});


// --- TYPEWRITER LOGIC ---
var TxtType = function(el, toRotate, period) {
    this.toRotate = toRotate;
    this.el = el;
    this.loopNum = 0;
    this.period = parseInt(period, 10) || 2000;
    this.txt = '';
    this.isDeleting = false;
    this.isFinished = false; // Added to stop the loop
    this.tick();
};

TxtType.prototype.tick = function() {
    if (this.isFinished) return;

    var i = this.loopNum;
    var fullTxt = this.toRotate[i];

    if (this.isDeleting) {
        this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
        this.txt = fullTxt.substring(0, this.txt.length + 1);
    }

    // Convert dots to red spans
    let displayTxt = this.txt.replace(/\./g, '<span class="red-dot">.</span>');
    this.el.innerHTML = '<span class="wrap">' + displayTxt + '</span>';

    var that = this;
    var delta = 150 - Math.random() * 100;

    if (this.isDeleting) { delta /= 2; }

    // Logic to handle sequence
    if (!this.isDeleting && this.txt === fullTxt) {
        // If it's the last item in the array, stop here
        if (this.loopNum === this.toRotate.length - 1) {
            this.isFinished = true;
            // Remove the blinking cursor after finishing
            setTimeout(() => {
                this.el.querySelector('.wrap').style.borderRight = "none";
            }, 1000);
            return;
        }
        delta = this.period;
        this.isDeleting = true;
    } else if (this.isDeleting && this.txt === '') {
        this.isDeleting = false;
        this.loopNum++;
        delta = 500;
    }

    setTimeout(function() {
        that.tick();
    }, delta);
};

// Modify the initialization to run when the page is ready
function initTypewriter() {
    var elements = document.getElementsByClassName('typewrite');
    for (var i = 0; i < elements.length; i++) {
        var toRotate = elements[i].getAttribute('data-type');
        var period = elements[i].getAttribute('data-period');
        if (toRotate) {
            new TxtType(elements[i], JSON.parse(toRotate), period);
        }
    }
}
// ==========================================
// 0. FIREBASE CONFIGURATION & IMPORTS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, signInAnonymously, updateProfile} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_Q3p2dyKwUOUv5O-gIMNI8vv6RrD0IZY",
  authDomain: "bai-news-9e4cf.firebaseapp.com",
  projectId: "bai-news-9e4cf",
  storageBucket: "bai-news-9e4cf.firebasestorage.app",
  messagingSenderId: "1056453543830",
  appId: "1:1056453543830:web:c40a8c1e5bb582f2c63fb7"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ==========================================
// AUTH LOGIC (Login & UI Updates)
// ==========================================

// 1. LISTEN FOR CLICKS (Event Delegation)
// We do this because 'google-login-btn' doesn't exist when page loads
document.addEventListener('click', (e) => {
    // Check if user clicked the Google Button
    if (e.target.closest('#google-login-btn')) {
        handleGoogleLogin();
    }
});

// 2. THE LOGIN FUNCTION
function handleGoogleLogin() {
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;
            console.log("Login Success:", user.displayName);
            
            // A. Close the Popup
            const overlay = document.getElementById('popupOverlay');
            if(overlay) overlay.classList.remove('active');

            // B. Update the UI immediately (Turn button black)
            updateUIForUser(user);
            
            // Note: We DO NOT use window.location.href here. 
            // We want to stay on the page and show the user they are subscribed.
        })
        .catch((error) => {
            console.error("Error:", error.message);
            alert("Login Failed: " + error.message);
        });
}

// 3. CHECK LOGIN STATE (Runs on page load)
onAuthStateChanged(auth, (user) => {
    const subscribeBtn = document.getElementById('openPopupBtn');
    
    if (user) {
        // User is logged in -> Set Black Button
        updateUIForUser(user);
    } else {
        // User is logged out -> Set Red Button
        resetUI();
    }

    // FIX: Now that the correct color is set, REVEAL the button
    if (subscribeBtn) {
        subscribeBtn.classList.add('auth-ready');
    }
});

// 4. FUNCTION TO UPDATE THE BUTTON (Red -> Black)
function updateUIForUser(user) {
    const subscribeBtn = document.getElementById('openPopupBtn');
    if (subscribeBtn) {
        // Change Styles to Black
        subscribeBtn.style.backgroundColor = "#000"; 
        subscribeBtn.style.color = "#fff";
        
        // Change Text
        // We use innerHTML to keep the styling, or just text
        subscribeBtn.innerHTML = '<span class="text">Subscribed</span>';
        
        // Optional: Disable click so popup doesn't open again
        subscribeBtn.style.pointerEvents = "none";
    }
}

function resetUI() {
    const subscribeBtn = document.getElementById('openPopupBtn');
    if (subscribeBtn) {
        subscribeBtn.style.backgroundColor = ""; // Revert to CSS default (Red)
        subscribeBtn.style.color = ""; 
        subscribeBtn.innerHTML = '<span class="text">Subscribe</span> <span class="icon"><svg viewBox="0 0 448 512" class="bell"><path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"></path></svg></span>';
        subscribeBtn.style.pointerEvents = "auto";
    }
}


// ==================------------------======================








// ==========================================
// 1. MASTER LAYOUT LOADER (Executes First)
// ==========================================
async function loadLayout() {
    try {
        const response = await fetch('../layout/layout.html');
        if (!response.ok) throw new Error('Could not load layout.html');
        
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // A. Inject Header
        const headerContent = doc.getElementById('source-header').innerHTML;
        document.getElementById('global-header').innerHTML = headerContent;

        // B. Inject Footer
        const footerContent = doc.getElementById('source-footer').innerHTML;
        document.getElementById('global-footer').innerHTML = footerContent;

        // C. Inject Popup (Append to bottom)
        const popupContent = doc.getElementById('source-popup').innerHTML;
        document.body.insertAdjacentHTML('beforeend', popupContent);

        // D. INJECT SEARCH WRAPPER (New!)
        const searchContent = doc.getElementById('source-search').innerHTML;
        document.body.insertAdjacentHTML('beforeend', searchContent);

        // E. START LOGIC (Now that all elements exist)
        initGlobalLogic();

    } catch (error) {
        console.error('Error loading layout:', error);
    }
}

// ==========================================
// 2. GLOBAL INIT (The Coordinator)
// ==========================================
function initGlobalLogic() {
    // 1. Initialize Popup
    initPopupLogic();

    // 2. Initialize Search (We call the new function here!)
    initSearchLogic();

    // 3. Highlight Sidebar Link
    const currentPage = window.location.pathname.split("/").pop() || 'index.html';
    const menuLinks = document.querySelectorAll('.menu-item');
    menuLinks.forEach(link => {
        if (link.getAttribute('href').split('/').pop() === currentPage) {
            link.classList.add('active-page');
        }
    });

    // 4. Hamburger Menu Logic
    const btn = document.querySelector('.menu__icon');
    if (btn) {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
    }
}

// ==========================================
// 3. SEARCH LOGIC (Consolidated Function)
// ==========================================
function initSearchLogic() {
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchPopupContainer = document.getElementById('search-popup-container');
    const filterOptionsContainer = document.getElementById('filter-options-container');
    const searchInput = document.getElementById('searchInput');
    const resultsBox = document.getElementById('search-results-box');
    const filterCheckboxes = document.querySelectorAll('input[name="filter-tags"]');

    if (!searchToggleBtn || !searchInput) return; // Safety Exit

    // --- A. TOGGLE BUTTON VISUALS ---
    const imgSearch = searchToggleBtn.querySelector('.search-icon');
    const imgFilterEmpty = searchToggleBtn.querySelector('.filter-icon1');
    const imgFilterFilled = searchToggleBtn.querySelector('.filter-icon2');
    let clickCount = 0;

    function updateImages(showImage) {
        if (imgSearch) imgSearch.style.display = 'none';
        if (imgFilterEmpty) imgFilterEmpty.style.display = 'none';
        if (imgFilterFilled) imgFilterFilled.style.display = 'none';

        if (showImage === 1 && imgSearch) imgSearch.style.display = 'block';
        if (showImage === 2 && imgFilterEmpty) imgFilterEmpty.style.display = 'block';
        if (showImage === 3 && imgFilterFilled) imgFilterFilled.style.display = 'block';
    }
    updateImages(1);

    // --- B. TOGGLE CLICK HANDLER ---
    searchToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clickCount++;

        if (clickCount === 1) { // Open Search
            searchWrapper.classList.add('active');
            searchPopupContainer.classList.add('active');
            filterOptionsContainer.classList.remove('visible');
            updateImages(2);
        } else { // Toggle Filter
            if (clickCount % 2 === 0) {
                filterOptionsContainer.classList.add('visible');
                updateImages(3);
            } else {
                filterOptionsContainer.classList.remove('visible');
                updateImages(2);
            }
        }
    });

    // --- C. CLOSE ON CLICK OUTSIDE ---
    document.addEventListener('click', (e) => {
        if (!searchWrapper || !searchWrapper.classList.contains('active')) return;

        if (!searchWrapper.contains(e.target)) {
            // Clicked completely outside
            searchWrapper.classList.remove('active');
            searchPopupContainer.classList.remove('active');
            filterOptionsContainer.classList.remove('visible');
            resultsBox.classList.remove('active'); // Close results too
            clickCount = 0;
            updateImages(1);
        } else if (!filterOptionsContainer.contains(e.target) && e.target !== searchToggleBtn && !resultsBox.contains(e.target)) {
            // Clicked inside search but not on filter/results
            if (filterOptionsContainer.classList.contains('visible')) {
                filterOptionsContainer.classList.remove('visible');
                clickCount = 1;
                updateImages(2);
            }
        }
    });

    // --- D. PERFORM SEARCH (Typing + Filters) ---
    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        
        // Get Selected Tags
        const selectedTags = Array.from(filterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value.toLowerCase());

        // Hide if empty
        if (query.length === 0) {
             resultsBox.classList.remove('active');
             resultsBox.innerHTML = "";
             return;
        }

        // Check Data
        if (typeof articleDatabase === 'undefined') {
            console.warn("Search Error: articleDatabase not found.");
            return;
        }

        // Filter Data
        const filteredData = articleDatabase.filter(article => {
            const plainTitle = article.title.replace(/(<([^>]+)>)/gi, "").toLowerCase();
            const plainSummary = article.summary.replace(/(<([^>]+)>)/gi, "").toLowerCase();
            const articleTags = (article.tags || "").toLowerCase();

            const matchesText = plainTitle.includes(query) || plainSummary.includes(query);
            const matchesTags = selectedTags.length === 0 || 
                                selectedTags.some(tag => articleTags.includes(tag));

            return matchesText && matchesTags;
        });

        displaySearchResults(filteredData, query);
    }

    // Connect Listeners
    searchInput.addEventListener('input', performSearch);
    filterCheckboxes.forEach(cb => cb.addEventListener('change', performSearch));
    
    // Stop clicks inside specific boxes from closing the UI
    if (searchPopupContainer) searchPopupContainer.addEventListener('click', e => e.stopPropagation());
    if (filterOptionsContainer) filterOptionsContainer.addEventListener('click', e => e.stopPropagation());
    if (resultsBox) resultsBox.addEventListener('click', e => e.stopPropagation());

    // --- E. DISPLAY RESULTS ---
    function displaySearchResults(data, query) {
        if (data.length === 0) {
            resultsBox.innerHTML = `<div style="text-align:center; color:#888; padding:10px;">No matching results.</div>`;
            resultsBox.classList.add('active');
            return;
        }

        const html = data.map(article => {
            const plainTitle = article.title.replace(/(<([^>]+)>)/gi, "");
            const plainSummary = article.summary.replace(/(<([^>]+)>)/gi, "");
            const hlTitle = highlightText(plainTitle, query);
            const hlSummary = highlightText(plainSummary, query);

            return `
            <a href="../docs/index.html" class="result-card">
                <h4>${hlTitle}</h4>
                <p>${hlSummary}</p>
                <span class="result-date">${article.date}</span>
            </a>
            `;
        }).join('');

        resultsBox.innerHTML = html;
        resultsBox.classList.add('active');
    }

    function highlightText(text, query) {
        if (!query) return text;
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        return text.replace(regex, '<span class="highlight-red">$1</span>');
    }
}







// ==========================================
// 3. DETAILED POPUP LOGIC
// ==========================================
function initPopupLogic() {

    // --- A. VARIABLES & ELEMENTS ---
    const closeBtn = document.getElementById('closePopupBtn');
    const overlay = document.getElementById('popupOverlay');

    const viewOptions = document.getElementById('view-options');
    const viewEmail = document.getElementById('view-email');
    const viewOtp = document.getElementById('view-otp');

    const btnToEmail = document.getElementById('btn-to-email');
    const btnBack = document.getElementById('btn-back'); 
    const formEmail = document.getElementById('form-email');
    const inputEmail = document.getElementById('email-input');
    const displayEmail = document.getElementById('display-email');
    const newsletterCheck = document.getElementById('newsletter-check');
    const checkboxRow = document.querySelector('.checkbox-row');
    
    const otpInputs = document.querySelectorAll('.otp-digit');
    const otpToast = document.getElementById('otp-toast');
    const resendWrapper = document.querySelector('.resend-wrapper');
    const resendTimerDisplay = document.getElementById('resend-timer');
    const resendText = document.getElementById('resend-text');

    // ==========================================
    // TOGGLE: SIGN UP <-> SIGN IN
    // ==========================================
    
    // 1. Select Elements
    const toggleLink = document.getElementById('toggle-auth-mode');
    const footerPrompt = document.getElementById('text-footer-prompt');
    
    const txtGoogle = document.getElementById('text-google');
    const txtTwitter = document.getElementById('text-twitter');
    const txtEmail = document.getElementById('text-email');

    let isLoginMode = false; // False = Sign Up Mode (Default)

    // 2. The Toggle Function
    if (toggleLink) {
        toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode; // Switch true/false

            if (isLoginMode) {
                // --- SWITCH TO LOGIN MODE Change Text ---
                if(txtGoogle) txtGoogle.textContent = "Sign in with Google";
                if(txtTwitter) txtTwitter.textContent = "Sign in with X";
                if(txtEmail) txtEmail.textContent = "Sign in with email";
                
                if(footerPrompt) footerPrompt.textContent = "New here? ";
                toggleLink.textContent = "Create an account";

                // 2. Hide Newsletter Checkbox (Don't need it for login)
                if(checkboxRow) checkboxRow.classList.add('hidden');
                
            } else {
                // --- SWITCH TO SIGN UP MODE ---
                if(txtGoogle) txtGoogle.textContent = "Sign up with Google";
                if(txtTwitter) txtTwitter.textContent = "Sign up with X";
                if(txtEmail) txtEmail.textContent = "Sign up with email";
                
                if(footerPrompt) footerPrompt.textContent = "Already have an account? ";
                toggleLink.textContent = "Sign in";

                // 2. Show Newsletter Checkbox
                if(checkboxRow) checkboxRow.classList.remove('hidden');
                
                // Reset Title
                // if(popTitle) popTitle.innerHTML = 'b<span class="text-red">ai</span>.news';
            }
        });
    }

    let timerInterval = null;

    // --- B. HELPER: RESET STATE ---
    function resetPopupState() {
        if (!overlay) return;
        
        overlay.classList.remove('active');
        
        // Reset Views
        if(viewOptions) viewOptions.classList.add('hidden');
        if(viewEmail) viewEmail.classList.add('hidden');
        if(viewOtp) viewOtp.classList.add('hidden');

        isLoginMode = false;
        if(toggleLink) toggleLink.textContent = "Sign in";

        // Clear Inputs
        if(inputEmail) inputEmail.value = "";
        otpInputs.forEach(input => input.value = "");

        //Uncheck the box
        if(newsletterCheck) newsletterCheck.checked = false;

        // Reset Timer
        if (timerInterval) clearInterval(timerInterval);

        // RESET TO DEFAULT (Sign Up Mode)
        isLoginMode = false;
        if(toggleLink) toggleLink.textContent = "Sign in";
        if(footerPrompt) footerPrompt.textContent = "Already have an account? ";
        if(checkboxRow) checkboxRow.classList.remove('hidden');
        
        // Reset Button Text
        if(txtGoogle) txtGoogle.textContent = "Sign up with Google";
        if(txtTwitter) txtTwitter.textContent = "Sign up with X";
        if(txtEmail) txtEmail.textContent = "Sign up with email";
    }

    // --- C. OPEN POPUP (Event Delegation) ---
    // This makes sure the button works even though it was injected via JS
    document.addEventListener('click', (e) => {
        // Check if the clicked element is (or is inside) the Open Button
        if (e.target.closest('#openPopupBtn')) {
            resetPopupState(); // Clean slate
            if (overlay) overlay.classList.add('active');
            if (viewOptions) viewOptions.classList.remove('hidden');
        }
    });

    // --- D. CLOSE HANDLERS ---
    if (closeBtn) closeBtn.addEventListener('click', resetPopupState);
    
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) resetPopupState();
        });
    }

    // --- E. NAVIGATION HANDLERS ---
    if (btnToEmail) {
        btnToEmail.addEventListener('click', () => {
            viewOptions.classList.add('hidden');
            viewEmail.classList.remove('hidden');
            if(inputEmail) inputEmail.focus();
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            viewEmail.classList.add('hidden');
            viewOptions.classList.remove('hidden');
        });
    }

// --- F. NEW TIMER FUNCTION (With Locking Logic) ---
    function startOtpTimer() {
        // We use the variables you already selected at the top of initPopupLogic
        if (!resendWrapper || !resendTimerDisplay) return;

        // 1. LOCK THE BUTTON (Visuals)
        resendWrapper.style.pointerEvents = "none"; // Stop clicks
        resendWrapper.style.opacity = "0.75";        // Fade it out
        resendWrapper.classList.add('disabled');    // Add status class
        
        // Optional: Change cursor
        resendWrapper.style.cursor = "default";
        if(resendText) resendText.textContent = "resend ";

        let timeLeft = 30; // 30 Seconds

        // 2. START COUNTDOWN
        // Clear any existing timer using the variable defined at line 378
        if (timerInterval) clearInterval(timerInterval);
        
        // Show initial text
        resendTimerDisplay.style.display = "inline";
        resendTimerDisplay.textContent = "(00:30)"; 

        timerInterval = setInterval(() => {
            timeLeft--;
            
            // Format "00:09"
            const seconds = timeLeft < 10 ? `0${timeLeft}` : timeLeft;
            resendTimerDisplay.textContent = `(${seconds}s)`;

            // 3. UNLOCK WHEN FINISHED
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                
                // Restore Clickability
                resendWrapper.style.pointerEvents = "auto"; 
                resendWrapper.style.opacity = "1";          
                resendWrapper.style.cursor = "pointer";
                resendWrapper.classList.remove('disabled');
                
                // Reset Text
                resendTimerDisplay.style.display = "none"; 
                if(resendText) resendText.textContent = "resend";
            }
        }, 1000);
    }

    // --- G. SUBMIT EMAIL -> SHOW OTP ---
    if (formEmail) {
        formEmail.addEventListener('submit', (e) => {
            e.preventDefault();
            if (inputEmail && inputEmail.value.trim() !== "") {
                // Update Display Email
                if(displayEmail) displayEmail.textContent = inputEmail.value;
                
                // Switch Views
                viewEmail.classList.add('hidden');
                viewOtp.classList.remove('hidden');
                
                // Focus & Start Timer
                if(otpInputs[0]) otpInputs[0].focus();
                startOtpTimer();
            }
        });
    }

    // --- H. RESEND CLICK (Delegated & Functional) ---
    // We listen on the document so it works even if elements refresh
    document.addEventListener('click', (e) => {
        // Target the wrapper div provided in your HTML
        const wrapper = e.target.closest('.resend-wrapper');

        if (wrapper) {
            // Safety Check: If it's disabled (greyed out), stop.
            if (wrapper.style.pointerEvents === 'none' || wrapper.classList.contains('disabled')) {
                return;
            }

            // 1. ACTION: Send the email
            // We use the email input variable defined at top of function
            if (inputEmail && inputEmail.value) {
                console.log("Resending code to:", inputEmail.value);
                sendOTP(inputEmail.value); // Calls your existing send function
                
                // Show Toast (Optional feedback)
                if(otpToast) {
                    otpToast.textContent = "Code Resent!";
                    otpToast.classList.add('show');
                    setTimeout(() => otpToast.classList.remove('show'), 2000);
                }
            }

            // 2. ACTION: Restart the timer lock
            startOtpTimer();
        }
    });

    // --- I. OTP INPUT LOGIC ---
    otpInputs.forEach((input, index) => {
        // Typing
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, ''); // Numbers only
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        // Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    // --- J. EDIT EMAIL (Back to View 2) ---
    if (displayEmail) {
        displayEmail.addEventListener('click', () => {
            viewOtp.classList.add('hidden');
            viewEmail.classList.remove('hidden');
            
            // Clear timer and inputs
            if (timerInterval) clearInterval(timerInterval);
            otpInputs.forEach(input => input.value = "");
            if(inputEmail) inputEmail.focus();
        });
    }

    // ==========================================
    // GOOGLE APPS SCRIPT AUTH LOGIC
    // ==========================================

    // 1. CONFIGURATION
    // PASTE YOUR GOOGLE SCRIPT URL HERE
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwZ5TN8yWPNlKnqWIwZY1EETxkp8X_MtHKanSD9m5KtexX23zTFlH-Hs9M_RUz03Oq0-w/exec"; 

    let generatedOTP = null; // To store the code we sent

    // 2. SEND OTP FUNCTION
    function sendOTP(email) {
        // A. Generate a random 6-digit number
        generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        console.log("Dev Check (Code):", generatedOTP); // For testing

        // B. Show user we are working
        const toast = document.getElementById('otp-toast'); // Ensure you have this HTML element
        if(toast) { 
            toast.textContent = "Sending Code..."; 
            toast.classList.add('show'); 
        }

        // C. Send to Google
        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            // We send it as text/plain to avoid CORS "preflight" issues with Google
            body: JSON.stringify({ email: email, otp: generatedOTP }),
        })
        .then(response => response.text()) // Read response as text
        .then(result => {
            console.log("Google Response:", result);
            
            // Update UI
            if(toast) { 
                toast.textContent = "Code Sent!"; 
                setTimeout(() => toast.classList.remove('show'), 3000);
            }
        })
        .catch(error => {
            console.error("Error sending email:", error);
            alert("Could not send email. Check console.");
        });
    }

// 3. VERIFY OTP FUNCTION
    function verifyOTP() {
        // 1. Get the numbers from boxes
        let enteredCode = "";
        const inputs = document.querySelectorAll('.otp-digit');
        inputs.forEach(input => enteredCode += input.value);

        console.log("Checking:", enteredCode, "vs", generatedOTP); 

        // 2. Check Match
        if (enteredCode === generatedOTP) {
            
            // 3. Authenticate
            signInAnonymously(auth)
                .then((result) => {
                    const userEmail = document.getElementById('email-input').value;
                    const derivedName = userEmail.split('@')[0];

                    // --- CHECKBOX LOGIC START ---
                    // We only care about the newsletter if they are SIGNING UP (not login)
                    if (!isLoginMode && newsletterCheck && newsletterCheck.checked) {
                        console.log("User joined the mailing list!");
                        localStorage.setItem('baiNewsletter', 'true');
                    } else if (!isLoginMode) {
                        localStorage.setItem('baiNewsletter', 'false');
                    }
                    // --- CHECKBOX LOGIC END ---

                    // B. Update Profile
                    updateProfile(result.user, { 
                        displayName: derivedName 
                    }).then(() => {
                        
                        // C. UPDATE UI
                        if (typeof updateUIForUser === "function") {
                            updateUIForUser(result.user);
                        }
                        
                        // D. CLOSE POPUP
                        resetPopupState(); 
                        
                        // --- CUSTOM MESSAGE BASED ON MODE ---
                        if (isLoginMode) {
                            alert("Welcome back! You have successfully signed in.");
                        } else {
                            // If they checked the box, mention it
                            if (newsletterCheck && newsletterCheck.checked) {
                                alert("Account Created! You are subscribed to updates.");
                            } else {
                                alert("Account Created Successfully!");
                            }
                        }
                    });
                })
                .catch((error) => {
                    console.error("Firebase Auth Error:", error);
                    alert("Login failed: " + error.message);
                });

        } else {
            alert("Incorrect Code. Please try again.");
            // Clear inputs on fail
            inputs.forEach(input => input.value = "");
            // Focus back on first box
            if(inputs.length > 0) inputs[0].focus();
        }
    }

    // ==========================================
    // Connect the Buttons
    // ==========================================


    // A. When user submits the Email Form

    if (formEmail) {
        formEmail.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = inputEmail.value.trim();
            
            if (email) {
                // 1. Switch View (Hide Email Form, Show OTP Form)
                document.getElementById('view-email').classList.add('hidden');
                document.getElementById('view-otp').classList.remove('hidden');
                
                // 2. Send the Code!
                sendOTP(email);
                
                // 3. Start Timer (Optional)
                startOtpTimer(); 
            }
        });
    }

    // B. When user types in OTP boxes (Auto-Verify)
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            // Auto-focus next box
            if (input.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            
            // Check if all filled -> Verify automatically
            // We delay slightly to let the last number appear
            if (index === 5 && input.value !== "") {
                setTimeout(verifyOTP, 100); 
            }
        });
    });

    // ==========================================
    // FIX: LISTEN FOR CLICKS ON THE "CREATE" BUTTON
    // ==========================================
    document.addEventListener('click', (e) => {
        // Check if the thing clicked is the verify button (or inside it)
        if (e.target.closest('#btn-verify-otp')) {
            e.preventDefault(); // Stop page reload
            
            console.log("Create Button Clicked! (Via Delegation)");
            
            // Run the verification function
            verifyOTP();
        }
    });
}

// ==========================================
// 4. EXECUTE ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', loadLayout);
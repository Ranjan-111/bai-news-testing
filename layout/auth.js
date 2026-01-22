import { auth, app } from '/Article/firebase-db.js'; // Added 'app' here
// ADDED: fetchSignInMethodsForEmail, deleteUser
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut, 
    signInAnonymously, 
    updateProfile, 
    updateEmail,
    fetchSignInMethodsForEmail, 
    deleteUser 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// ADDED: Firestore imports needed for the Role Check
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { saveUserToDB } from '/admin/user-db.js';

const db = getFirestore(app); // Initialize DB here
const provider = new GoogleAuthProvider();

// ==========================================
// AUTH LOGIC (Login & UI Updates)
// ==========================================

// 1. LISTEN FOR CLICKS (Event Delegation)
document.addEventListener('click', (e) => {
    if (e.target.closest('#google-login-btn')) {
        handleGoogleLogin();
    }
});

// 2. THE LOGIN FUNCTION
function handleGoogleLogin() {
    signInWithPopup(auth, provider)
        .then(async (result) => {
            const user = result.user;
            console.log("Login Success:", user.displayName);

            const newsletterBox = document.getElementById('newsletter-check');
            const isSubscribed = newsletterBox ? newsletterBox.checked : false;
            await saveUserToDB(user, isSubscribed);

            const overlay = document.getElementById('popupOverlay');
            if (overlay) overlay.classList.remove('active');
            updateUIForUser(user);
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
        updateUIForUser(user);
    } else {
        resetUI();
    }

    if (subscribeBtn) {
        subscribeBtn.classList.add('auth-ready');
    }
});

// =========================================================
// 4. FUNCTION TO UPDATE THE UI (Button & Profile Popup)
// =========================================================
async function updateUIForUser(user) {
    const subscribeBtn = document.getElementById('openPopupBtn');
    const profileTrigger = document.getElementById('profileTrigger');
    const mediaQuery = window.matchMedia('(max-width: 550px)');
    
    if (user && user.email) {
        
        // 1. CHECK ROLE FROM DB
        let isAuthor = false;
        let isAdmin = false;

        try {
            const userRef = doc(db, "users", user.email);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                const role = data.role ? data.role.toLowerCase() : "";
                
                if (role === 'author') isAuthor = true;
                if (role === 'admin') isAdmin = true;
            }
        } catch (e) {
            console.log("Role check failed", e);
        }

        // 2. CONFIGURE BUTTON (Dashboard / Create Post / Subscribed)
        if (subscribeBtn) {
            subscribeBtn.classList.add('auth-ready'); 
            
            if (isAdmin) {
                // --- ADMIN VIEW: DASHBOARD ---
                subscribeBtn.style.backgroundColor = "#000";
                subscribeBtn.style.color = "#fff";
                subscribeBtn.innerHTML = '<span style="position: relative; transform: translateX(30px); color: white; font-family: Helvetica Neue, Helvetica, Arial, sans-serif; font-size: 1.4em; font-weight: 200; letter-spacing: 1.5px;">Dashboard</span>';
                subscribeBtn.style.pointerEvents = "auto";
                subscribeBtn.style.display = "flex"; 
                
                subscribeBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = "/admin/dashboard.html";
                };

            } else if (isAuthor) {
                // --- AUTHOR VIEW: CREATE POST ---
                subscribeBtn.style.backgroundColor = "#000";
                subscribeBtn.style.color = "#fff";
                subscribeBtn.innerHTML = '<span style="position: relative; transform: translateX(35px); color: white; font-family: Helvetica Neue, Helvetica, Arial, sans-serif; font-size: 1.4em; font-weight: 200; letter-spacing: 1.5px;">create post</span>';
                subscribeBtn.style.pointerEvents = "auto";
                subscribeBtn.style.display = "flex"; 
                
                subscribeBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = "/admin/post-article.html";
                };

            } else {
                // --- READER VIEW: SUBSCRIBED ---
                subscribeBtn.style.backgroundColor = "#000";
                subscribeBtn.style.color = "#fff";
                subscribeBtn.innerHTML = '<span class="text">Subscribed</span>';
                subscribeBtn.style.pointerEvents = "none";
                
                // Hide on mobile if subscribed
                if (mediaQuery.matches) { subscribeBtn.style.display = "none"; }
                else { subscribeBtn.style.display = "flex"; }
            }
        }

        // 3. CONFIGURE PROFILE POPUP
        if (profileTrigger) {
            profileTrigger.style.display = 'flex';
            initProfilePopupLogic(user, isAdmin);
        }

    } else {
        resetUI(); // Fallback if user object is invalid
    }
}

function resetUI() {
    const subscribeBtn = document.getElementById('openPopupBtn');
    if (subscribeBtn) {
        subscribeBtn.style.backgroundColor = ""; 
        subscribeBtn.style.color = "";
        subscribeBtn.innerHTML = '<span class="text">Subscribe</span> <span class="icon"><svg viewBox="0 0 448 512" class="bell"><path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"></path></svg></span>';
        subscribeBtn.style.pointerEvents = "auto";
    }
}

// ==========================================
// 3. DETAILED POPUP LOGIC
// ==========================================
export function initPopupLogic() {

    const closeBtn = document.getElementById('closePopupBtn');
    const overlay = document.getElementById('popupOverlay');

    const viewOptions = document.getElementById('view-options');
    const viewEmail = document.getElementById('view-email');
    const viewOtp = document.getElementById('view-otp');

    const popBody = document.querySelector('.pop-body');
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

    const toggleLink = document.getElementById('toggle-auth-mode');
    const footerPrompt = document.getElementById('text-footer-prompt');
    const txtGoogle = document.getElementById('text-google');
    const txtTwitter = document.getElementById('text-twitter');
    const txtEmail = document.getElementById('text-email');

    let isLoginMode = false;
    let timerInterval = null;

    if (toggleLink) {
        toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;

            if (isLoginMode) {
                if (txtGoogle) txtGoogle.textContent = "Sign in with Google";
                if (txtTwitter) txtTwitter.textContent = "Sign in with X";
                // if (txtEmail) txtEmail.textContent = "Sign in with email";
                if (txtEmail) {btnToEmail.style.display = "none";
                                popBody.style.marginTop = "33px";}
                if (footerPrompt) footerPrompt.textContent = "New here? ";
                toggleLink.textContent = "Create an account";
                if (checkboxRow) checkboxRow.classList.add('hidden');
            } else {
                if (txtGoogle) txtGoogle.textContent = "Sign up with Google";
                if (txtTwitter) txtTwitter.textContent = "Sign up with X";
                if (txtEmail) txtEmail.textContent = "Sign up with email";
                if (footerPrompt) footerPrompt.textContent = "Already have an account? ";
                toggleLink.textContent = "Sign in";
                if (checkboxRow) checkboxRow.classList.remove('hidden');
            }
        });
    }

    function resetPopupState() {
        if (!overlay) return;
        overlay.classList.remove('active');
        if (viewOptions) viewOptions.classList.add('hidden');
        if (viewEmail) viewEmail.classList.add('hidden');
        if (viewOtp) viewOtp.classList.add('hidden');

        isLoginMode = false;
        if (toggleLink) toggleLink.textContent = "Sign in";

        if (inputEmail) inputEmail.value = "";
        otpInputs.forEach(input => input.value = "");
        if (newsletterCheck) newsletterCheck.checked = false;
        if (timerInterval) clearInterval(timerInterval);

        if (footerPrompt) footerPrompt.textContent = "Already have an account? ";
        if (checkboxRow) checkboxRow.classList.remove('hidden');
        if (txtGoogle) txtGoogle.textContent = "Sign in with Google";
        if (txtTwitter) txtTwitter.textContent = "Sign in with X";
        if (txtEmail) txtEmail.textContent = "Sign in with email";
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#openPopupBtn')) {
            resetPopupState();
            if (overlay) overlay.classList.add('active');
            if (viewOptions) viewOptions.classList.remove('hidden');
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', resetPopupState);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) resetPopupState();
        });
    }

    if (btnToEmail) {
        btnToEmail.addEventListener('click', () => {
            viewOptions.classList.add('hidden');
            viewEmail.classList.remove('hidden');
            if (inputEmail) inputEmail.focus();
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            viewEmail.classList.add('hidden');
            viewOptions.classList.remove('hidden');
        });
    }

    function startOtpTimer() {
        if (!resendWrapper || !resendTimerDisplay) return;

        resendWrapper.style.pointerEvents = "none"; 
        resendWrapper.style.opacity = "0.75";        
        resendWrapper.classList.add('disabled');    
        resendWrapper.style.cursor = "default";
        if (resendText) resendText.textContent = "resend ";

        let timeLeft = 30; 
        if (timerInterval) clearInterval(timerInterval);

        resendTimerDisplay.style.display = "inline";
        resendTimerDisplay.textContent = "(00:30)";

        timerInterval = setInterval(() => {
            timeLeft--;
            const seconds = timeLeft < 10 ? `0${timeLeft}` : timeLeft;
            resendTimerDisplay.textContent = `(${seconds}s)`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                resendWrapper.style.pointerEvents = "auto";
                resendWrapper.style.opacity = "1";
                resendWrapper.style.cursor = "pointer";
                resendWrapper.classList.remove('disabled');
                resendTimerDisplay.style.display = "none";
                if (resendText) resendText.textContent = "resend";
            }
        }, 1000);
    }

    if (formEmail) {
        formEmail.addEventListener('submit', (e) => {
            e.preventDefault();
            if (inputEmail && inputEmail.value.trim() !== "") {
                if (displayEmail) displayEmail.textContent = inputEmail.value;
                viewEmail.classList.add('hidden');
                viewOtp.classList.remove('hidden');
                if (otpInputs[0]) otpInputs[0].focus();
                startOtpTimer();
            }
        });
    }

    document.addEventListener('click', (e) => {
        const wrapper = e.target.closest('.resend-wrapper');
        if (wrapper) {
            if (wrapper.style.pointerEvents === 'none' || wrapper.classList.contains('disabled')) return;
            
            if (inputEmail && inputEmail.value) {
                console.log("Resending code to:", inputEmail.value);
                sendOTP(inputEmail.value);
                if (otpToast) {
                    otpToast.textContent = "Code Resent!";
                    otpToast.classList.add('show');
                    setTimeout(() => otpToast.classList.remove('show'), 2000);
                }
            }
            startOtpTimer();
        }
    });

    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, ''); 
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    if (displayEmail) {
        displayEmail.addEventListener('click', () => {
            viewOtp.classList.add('hidden');
            viewEmail.classList.remove('hidden');
            if (timerInterval) clearInterval(timerInterval);
            otpInputs.forEach(input => input.value = "");
            if (inputEmail) inputEmail.focus();
        });
    }

    otpInputs.forEach((input) => {
        input.addEventListener('paste', (e) => {
            e.preventDefault(); 
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const cleanPaste = paste.replace(/[^0-9]/g, '').slice(0, 6);

            if (cleanPaste) {
                cleanPaste.split('').forEach((char, index) => {
                    if (otpInputs[index]) otpInputs[index].value = char;
                });
                const nextIndex = cleanPaste.length;
                if (nextIndex < otpInputs.length) {
                    otpInputs[nextIndex].focus();
                } else {
                    otpInputs[otpInputs.length - 1].focus();
                    if (cleanPaste.length === 6) setTimeout(verifyOTP, 100);
                }
            }
        });
    });

    // ==========================================
    // GOOGLE APPS SCRIPT AUTH LOGIC
    // ==========================================
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyL2BWoLKA7nNoAEV80NeaU66zp3p-drCsQKHOgAfw43FPWH3f5XcNTBYlJUGtzCyaGzg/exec";
    let generatedOTP = null; 

    function sendOTP(email) {
        generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        // console.log("Dev Check (Code):", generatedOTP); 

        const toast = document.getElementById('otp-toast'); 
        if (toast) {
            toast.textContent = "Sending Code...";
            toast.classList.add('show');
        }

        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ email: email, otp: generatedOTP }),
        })
            .then(response => response.text()) 
            .then(result => {
                if (toast) {
                    toast.textContent = "Code Sent!";
                    setTimeout(() => toast.classList.remove('show'), 3000);
                }
            })
            .catch(error => {
                console.error("Error sending email:", error);
                alert("Could not send email. Check console.");
            });
    }


    // ==========================================
    //  FIXED VERIFY OTP FUNCTION
    // ==========================================
    function verifyOTP() {
        let enteredCode = "";
        const inputs = document.querySelectorAll('.otp-digit');
        inputs.forEach(input => enteredCode += input.value);

        if (enteredCode === generatedOTP) {
            
            // Start the Anonymous Login + Upgrade Flow
            signInAnonymously(auth)
                .then(async (result) => {
                    const user = result.user;
                    const userEmail = document.getElementById('email-input').value;
                    const derivedName = userEmail.split('@')[0];
                    const isSubscribed = (!isLoginMode && newsletterCheck) ? newsletterCheck.checked : false;

                    try {
                        // Force token refresh
                        await user.getIdToken(true);

                        // 1. Set Name
                        await updateProfile(user, { displayName: derivedName });

                        // 2. Set Email (THIS WILL FAIL IF EMAIL EXISTS)
                        await updateEmail(user, userEmail);

                        // 3. Save to DB
                        const userWithEmail = { ...user, email: userEmail, displayName: derivedName };
                        await saveUserToDB(userWithEmail, isSubscribed);

                        // 4. Success UI
                        if (typeof updateUIForUser === "function") updateUIForUser(userWithEmail);
                        resetPopupState();
                        if (isLoginMode) alert("Welcome back! You have successfully signed in.");

                    } catch (error) {
                        console.error("Link Error:", error.code);

                        // --- CRITICAL ERROR HANDLING FOR EXISTING USERS ---
                        if (error.code === 'auth/email-already-in-use') {
                            
                            // A. Check if they have Google linked
                            try {
                                const methods = await fetchSignInMethodsForEmail(auth, userEmail);
                                if (methods && methods.includes('google.com')) {
                                    alert(`You already have an account with Google for ${userEmail}. Please click 'Sign in with Google' instead.`);
                                } else {
                                    alert(`The email ${userEmail} is already registered. Please sign in with your Password or Google account.`);
                                }
                            } catch (e) {
                                // Fallback if enumeration protection is on
                                alert("This email is already registered. Please sign in using Google or your password.");
                            }

                            // B. CLEANUP: Delete the temp anonymous user so they aren't stuck
                            try { await deleteUser(user); } catch(e) { console.log("Cleanup error", e); }
                            
                            // C. Reset UI
                            resetPopupState();

                        } else if (error.code === 'auth/operation-not-allowed') {
                            alert("Config Error: Please enable Anonymous Auth & Email Auth in Firebase Console.");
                        } else {
                            alert("Error: " + error.message);
                        }
                    }
                })
                .catch((error) => {
                    console.error("Auth Error:", error);
                    alert("Login failed: " + error.message);
                });

        } else {
            alert("Incorrect Code. Please try again.");
            inputs.forEach(input => input.value = "");
            if (inputs.length > 0) inputs[0].focus();
        }
    }

    // Connect Submit Listener
    if (formEmail) {
        formEmail.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = inputEmail.value.trim();
            if (email) {
                document.getElementById('view-email').classList.add('hidden');
                document.getElementById('view-otp').classList.remove('hidden');
                sendOTP(email);
                startOtpTimer();
            }
        });
    }

    // Auto-verify
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (input.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            if (index === 5 && input.value !== "") {
                setTimeout(verifyOTP, 100);
            }
        });
    });

    // Verify Button Click
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-verify-otp')) {
            e.preventDefault(); 
            verifyOTP();
        }
    });
}

// ==========================================
// PROFILE POPUP LOGIC (Updated for Dashboard)
// ==========================================
function initProfilePopupLogic(user, isAdmin = false) {
    const trigger = document.getElementById('profileTrigger');
    const popup = document.getElementById('profilePopup');
    const nameDisplay = document.getElementById('profileName');
    const signoutBtn = document.getElementById('btn-signout');

    if (!trigger || !popup) return;

    // 1. Set Name
    if (user && nameDisplay) {
        const displayName = user.displayName || user.email.split('@')[0];
        nameDisplay.textContent = displayName;
    }

    // 2. CLEANUP: Remove old injected admin links (to prevent duplicates)
    popup.querySelectorAll('.admin-dashboard-link').forEach(el => el.remove());

    // 3. INJECT ADMIN LINKS
    if (isAdmin) {
        // A. Hide "Help" for Admin
        const allLinks = popup.querySelectorAll('.profile-menu-item');
        allLinks.forEach(link => {
            if (link.textContent.toLowerCase().trim() === 'help') {
                link.style.display = 'none';
            }
        });

        // B. Add "Dashboard" Link
        const profileLink = popup.querySelector('a[href*="user.html"]'); // Find 'Profile' link
        
        if (profileLink) {
            const dashboardLink = document.createElement('a');
            dashboardLink.className = 'profile-menu-item admin-dashboard-link';
            dashboardLink.href = '/admin/dashboard.html'; // <--- New Dashboard Page
            dashboardLink.innerText = 'Dashboard';
            dashboardLink.style.color = '#d73634'; // Red highlight
            dashboardLink.style.fontWeight = '500';

            profileLink.after(dashboardLink); 
        }
    }

    // 4. Toggle Logic
    trigger.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        popup.classList.toggle('active');
    };

    // 5. Signout Logic
    if (signoutBtn) {
        signoutBtn.onclick = async (e) => {
            e.preventDefault();
            await logoutUser(); 
        };
    }

    // 6. Close on Outside Click
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !trigger.contains(e.target)) {
            popup.classList.remove('active');
        }
    });
}

export async function logoutUser() {
    try {
        await signOut(auth);
        console.log("User Logged Out");
        window.location.reload(); 
    } catch (error) {
        console.error("Logout Error:", error);
    }
}
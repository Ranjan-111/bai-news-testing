import { getFirestore, doc, setDoc, getDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";import { app } from '../Article/firebase-db.js'; 

const db = getFirestore(app);

// ==========================================
// 1. SAVE LOGGED-IN USER (READERS ONLY)
// ==========================================
export async function saveUserToDB(user, subscribedToNewsletter) {
    if (!user || !user.email) return;

    // Use Email as the Unique ID
    const cleanEmail = user.email.toLowerCase().trim();
    const userRef = doc(db, "users", cleanEmail);
    
    try {
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            // UPDATE EXISTING READER
            const existingData = userSnap.data();
            
            // Logic: If they were 'guest', upgrade to 'reader'. Otherwise keep existing role (e.g. 'reader' or 'admin')
            const currentRole = existingData.role === 'guest' ? 'reader' : existingData.role;

            await setDoc(userRef, {
                uid: user.uid, 
                email: cleanEmail,
                displayName: user.displayName || existingData.displayName || "Anonymous",
                photoURL: user.photoURL || existingData.photoURL || "../assets/default-user.png",
                authProvider: user.providerData[0]?.providerId || "anonymous/otp",
                role: currentRole, 
                lastLogin: serverTimestamp(),
                // Keep subscription unless changed
                isNewsletterSubscribed: subscribedToNewsletter || existingData.isNewsletterSubscribed || false
            }, { merge: true });

            console.log(`✅ Reader Updated: ${currentRole}`);
        } else {
            // CREATE NEW READER
            await setDoc(userRef, {
                uid: user.uid,
                email: cleanEmail,
                displayName: user.displayName || "Anonymous",
                photoURL: user.photoURL || "../assets/default-user.png",
                authProvider: user.providerData[0]?.providerId || "anonymous/otp",
                role: "reader", // Default role for new signups
                isNewsletterSubscribed: subscribedToNewsletter,
                
                // READER SPECIFIC FIELDS
                savedArticles: [],
                following: [],
                
                // METADATA
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
            console.log("✅ New Reader Account Created");
        }
    } catch (e) {
        console.error("❌ Error saving user:", e);
    }
}

// ==========================================
// 2. SAVE FOOTER SUBSCRIBER
// ==========================================
export async function saveToNewsletterList(email) {
    if (!email) return;

    const cleanEmail = email.toLowerCase().trim();
    const userRef = doc(db, "users", cleanEmail);

    try {
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            // Just enable newsletter
            await setDoc(userRef, {
                isNewsletterSubscribed: true,
                lastNewsletterInteraction: serverTimestamp()
            }, { merge: true });
            console.log("✅ Existing user subscribed");
        } else {
            // Create Guest Reader
            await setDoc(userRef, {
                email: cleanEmail,
                role: "guest",
                isNewsletterSubscribed: true,
                createdAt: serverTimestamp(),
                displayName: "Guest Subscriber"
            });
            console.log("✅ New Guest Subscriber Added");
        }
        alert("Subscribed successfully!");
    } catch (e) {
        console.error("❌ Subscription Error:", e);
        alert("Could not subscribe. Try again.");
    }
}

// ==========================================
// 3. SUBMIT AUTHOR REQUEST (User -> Admin)
// ==========================================
export async function submitAuthorRequest(formData) {
    // formData object should look like:
    // { 
    //   uid: "...", 
    //   email: "...", 
    //   displayName: "...", 
    //   specialization: "...", 
    //   bio: "...", 
    //   sampleArticleLink: "..." 
    // }

    if (!formData.email || !formData.uid) {
        alert("Error: You must be logged in to apply.");
        return;
    }

    try {
        // We save to a separate 'author_requests' collection
        // This keeps the 'authors' collection clean for only approved reporters.
        await addDoc(collection(db, "author_requests"), {
            ...formData,
            status: "pending",
            submittedAt: serverTimestamp()
        });

        console.log("✅ Application Submitted");
        return { success: true };
    } catch (e) {
        console.error("❌ Error submitting application:", e);
        return { success: false, error: e.message };
    }
}
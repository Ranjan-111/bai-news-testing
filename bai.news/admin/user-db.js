import { getFirestore, doc, setDoc, getDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";import { app } from '/Article/firebase-db.js'; 

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
                photoURL: user.photoURL || existingData.photoURL || "/assets/default-user.png",
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
                photoURL: user.photoURL || "/assets/default-user.png",
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

// PASTE YOUR NEW SCRIPT URL HERE
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMXzcNfBZfGUZE-nI5T-8au-it3ujcH6nGgCOepw1tvbcuo4Or-BO7z9RRuDA9RaOmIg/exec"; 

export async function submitAuthorRequest(formData) {
    if (!formData.email) return { success: false };

    try {
        // 1. SAVE TO FIRESTORE (Authors Collection)
        // We use 'authors' so the Admin Panel can find them easily
        // We do NOT save the heavy Base64 files to DB to save costs.
        const { sampleBase64, ...dbData } = formData; 

        await setDoc(doc(db, "authors", formData.email), {
            ...dbData,
            status: "pending", // Waiting for approval
            role: "reporter_candidate",
            articleCount: 0,
            followers: [],
            joinedDate: serverTimestamp()
        });

        // 2. SEND EMAIL TO ADMIN (With Files)
        // We send the Base64 data here so it arrives in your inbox
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "cors", 
            headers: { "Content-Type": "text/plain" }, // Use text/plain to avoid preflight issues
            body: JSON.stringify({
                type: "application",
                name: formData.displayName,
                email: formData.email,
                specialization: formData.specialization,
                location: formData.location,
                portfolio: formData.portfolioLink,
                // Send File Data
                photoBase64: formData.photoURL.startsWith('data:') ? formData.photoURL : null,
                sampleBase64: formData.sampleBase64,
                sampleName: formData.sampleName
            })
        });

        console.log("✅ Application Submitted & Email Sent");
        return { success: true };

    } catch (e) {
        console.error("❌ Error submitting:", e);
        return { success: false, error: e.message };
    }
}
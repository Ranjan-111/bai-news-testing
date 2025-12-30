import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from '../Article/firebase-db.js'; 

const db = getFirestore(app);

// ==========================================
// 1. SAVE LOGGED-IN USER (Scenario A: Real Login)
// ==========================================
export async function saveUserToDB(user, subscribedToNewsletter) {
    if (!user || !user.email) return;

    // Use Email as the Unique ID (lowercase to avoid duplicates)
    const cleanEmail = user.email.toLowerCase().trim();
    const userRef = doc(db, "users", cleanEmail);
    
    try {
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            // CASE 1: User Exists - Update Login Time & Role logic
            const existingData = userSnap.data();
            const currentRole = existingData.role === 'guest' ? 'reader' : existingData.role;

            await setDoc(userRef, {
                uid: user.uid, 
                email: cleanEmail,
                displayName: user.displayName || existingData.displayName || "Anonymous",
                photoURL: user.photoURL || existingData.photoURL || "../assets/default-user.png",
                authProvider: user.providerData[0]?.providerId || "anonymous/otp",
                role: currentRole, 
                lastLogin: serverTimestamp(),
                // Keep existing subscription status unless they explicitly check it now
                isNewsletterSubscribed: subscribedToNewsletter || existingData.isNewsletterSubscribed || false
            }, { merge: true });

            console.log(`✅ User DB Updated: ${currentRole}`);
        } else {
            // CASE 2: Brand New User
            await setDoc(userRef, {
                uid: user.uid,
                email: cleanEmail,
                displayName: user.displayName || "Anonymous",
                photoURL: user.photoURL || "../assets/default-user.png",
                authProvider: user.providerData[0]?.providerId || "anonymous/otp",
                role: "reader", 
                isNewsletterSubscribed: subscribedToNewsletter,
                stats: { posts: 0, followers: 0 }, // Init stats
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
            console.log("✅ New User Account Created");
        }
    } catch (e) {
        console.error("❌ Error saving user:", e);
    }
}

// ==========================================
// 2. SAVE FOOTER SUBSCRIBER (Scenario B: Just Email)
// ==========================================
export async function saveToNewsletterList(email) {
    if (!email) return;

    const cleanEmail = email.toLowerCase().trim();
    const userRef = doc(db, "users", cleanEmail);

    try {
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            // CASE 1: Already in DB -> Just enable newsletter
            await setDoc(userRef, {
                isNewsletterSubscribed: true,
                lastNewsletterInteraction: serverTimestamp()
            }, { merge: true });
            console.log("✅ Existing user subscribed");
        } else {
            // CASE 2: New Guest -> Create Skeleton Account
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
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Use your existing app configuration
import { app } from '../Article/firebase-db.js';

const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 🔒 ADMIN SECURITY CHECK
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user && user.email) {
        console.log("Checking Admin Privileges for:", user.email);
        
        // Check the database for the 'role'
        const cleanEmail = user.email.toLowerCase().trim();
        const userRef = doc(db, "users", cleanEmail);
        
        try {
            const snap = await getDoc(userRef);
            
            // IF USER IS ADMIN -> DO NOTHING (Let them stay)
            if (snap.exists() && snap.data().role === 'admin') {
                console.log("✅ Admin Access Granted.");
                
                // Optional: If you have an Upload Button, you can enable it here
                // const btn = document.getElementById('upload-btn');
                // if(btn) btn.disabled = false;
                
            } else {
                // IF NOT ADMIN -> KICK THEM OUT
                alert("⛔️ ACCESS DENIED: You do not have permission to view this page.");
                window.location.href = "../main/index.html";
            }
        } catch (error) {
            console.error("Auth Check Error:", error);
            window.location.href = "../main/index.html";
        }

    } else {
        // IF NOT LOGGED IN -> KICK THEM OUT
        console.log("User not logged in. Redirecting...");
        window.location.href = "../main/index.html"; // Redirect to Home
    }
});


import { db } from '../Article/firebase-db.js';
import { collection, doc, setDoc, Timestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const sampleArticles = [
    {
        title: "The Rise of AI: Transforming Industries",
        summary: "Artificial Intelligence is revolutionizing healthcare and finance.",
        content: "<p>Detailed content about AI...</p>",
        datePosted: Timestamp.fromDate(new Date("2025-08-18")),
        tags: ["tech", "ai"],
        authorId: "Priyanshu",
        isFeatured: true, 
        imageUrl: "../assets/img1.jpg", 
        stats: { likes: 120, saves: 45, views: 1050 }
    },
    {
        title: "Sustainable Tech: A Greener Future",
        summary: "Innovations helping combat climate change.",
        content: "<p>Detailed content about Green Tech...</p>",
        datePosted: Timestamp.fromDate(new Date("2025-08-17")),
        tags: ["environment", "tech"],
        authorId: "Harsh",
        isFeatured: true, 
        imageUrl: "../assets/img2.jpg", 
        stats: { likes: 85, saves: 12, views: 600 }
    },
    {
        title: "Blockchain Beyond Crypto",
        summary: "Supply chain and healthcare uses for blockchain.",
        content: "<p>Detailed content about Blockchain...</p>",
        datePosted: Timestamp.fromDate(new Date("2025-08-16")),
        tags: ["tech", "crypto"],
        authorId: "Priyanshu",
        isFeatured: false,
        imageUrl: "../assets/img1.jpg", 
        stats: { likes: 200, saves: 80, views: 2200 }
    },
    // ... Add as many as you want here ...
];

window.uploadData = async function() {
    console.log("Starting Upload...");
    document.getElementById('status').innerText = "Uploading (Batching)...";

    const batch = writeBatch(db);
    
    // START SERIAL NUMBERS FROM 1 (Or 440 if you want)
    let currentSerial = 1; 

    sampleArticles.forEach((article) => {
        // Create a ref. We let Firestore generate the ID, but we force the serialNumber
        const newRef = doc(collection(db, "articles")); 
        
        batch.set(newRef, {
            ...article,
            serialNumber: currentSerial // THIS IS THE KEY YOU NEED
        });

        console.log(`Prepared: ${article.title} as Serial #${currentSerial}`);
        currentSerial++;
    });

    await batch.commit();
    
    document.getElementById('status').innerText = "Done! Articles have Serial Numbers.";
    alert("Upload Complete. Highest Serial: " + (currentSerial - 1));
};
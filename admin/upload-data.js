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
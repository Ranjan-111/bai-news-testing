import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from '/Article/firebase-db.js';
import { submitAuthorRequest } from '/admin/user-db.js';

const auth = getAuth(app);
let currentUser = null;
let profilePhotoBase64 = null; // Store image data
let sampleFileBase64 = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Check Login & Auto-fill
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('inp-email').value = user.email;
            if(user.displayName) document.getElementById('inp-name').value = user.displayName;
        } else {
            alert("Please sign in to apply.");
            window.location.href = "/main/index.html";
        }
    });

    // 2. Handle Profile Photo Upload (Preview + Base64)
    const dropZonePhoto = document.getElementById('drop-zone-photo');
    const inputPhoto = document.getElementById('inp-file-photo');
    const previewPhoto = document.getElementById('preview-photo');

    dropZonePhoto.addEventListener('click', () => inputPhoto.click());
    
    inputPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                profilePhotoBase64 = e.target.result; // Save Data URL
                previewPhoto.src = e.target.result;
                previewPhoto.classList.remove('hidden');
                dropZonePhoto.querySelector('.drop-content').style.opacity = '0';
            };
            reader.readAsDataURL(file);
        }
    });

    // 3. Handle Sample File Upload (Visual + Base64)
    const dropZoneSample = document.getElementById('drop-zone-sample');
    const inputSample = document.getElementById('inp-file-sample');
    const previewSample = document.getElementById('preview-sample-text');

    dropZoneSample.addEventListener('click', () => inputSample.click());

    inputSample.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            previewSample.textContent = "Selected: " + file.name;
            previewSample.classList.remove('hidden');
            dropZoneSample.querySelector('.drop-content').style.opacity = '0';

            // READ FILE AS BASE64
            const reader = new FileReader();
            reader.onload = (ev) => {
                sampleFileBase64 = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

// 4. Handle Submit
    const form = document.getElementById('apply-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- DEFINE VARIABLES HERE ---
        const btn = document.getElementById('btn-submit');
        const status = document.getElementById('status-msg');
        
        // Disable button & show loading text
        btn.disabled = true;
        btn.innerText = "Submitting...";
        if (status) status.innerText = ""; // Safety check

        const formData = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: document.getElementById('inp-name').value,
            dob: document.getElementById('inp-dob').value,
            location: document.getElementById('inp-location').value,
            specialization: document.getElementById('inp-spec').value,
            portfolioLink: document.getElementById('inp-link').value,
            photoURL: profilePhotoBase64 || currentUser.photoURL,
            sampleBase64: sampleFileBase64,
            sampleName: inputSample.files[0] ? inputSample.files[0].name : "sample.pdf"
        };

        const result = await submitAuthorRequest(formData);

        if (result.success) {
            status.innerText = "✅ Application Sent! We will review it shortly.";
            status.style.color = "green";
            form.reset();
            
            // Reset Previews
            const previewPhoto = document.getElementById('preview-photo');
            const previewSample = document.getElementById('preview-sample-text');
            if(previewPhoto) previewPhoto.classList.add('hidden');
            if(previewSample) previewSample.classList.add('hidden');
            document.querySelectorAll('.drop-content').forEach(el => el.style.opacity = '1');
            
            // Re-enable button
            btn.disabled = false;
            btn.innerText = "Submit";
        } else {
            status.innerText = "❌ Error: " + (result.error || "Unknown error");
            status.style.color = "red";
            btn.disabled = false;
            btn.innerText = "Submit";
        }
    });
});
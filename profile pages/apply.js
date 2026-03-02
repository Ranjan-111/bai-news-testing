import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from '/Article/firebase-db.js';
import { submitAuthorRequest } from '/admin/user-db.js';

const auth = getAuth(app);
let currentUser = null;
let profilePhotoBase64 = null; // Store image data
let sampleFileBase64 = null;

document.addEventListener('DOMContentLoaded', () => {
<<<<<<< HEAD

=======
    
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
    // 1. Check Login & Auto-fill
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('inp-email').value = user.email;
<<<<<<< HEAD
            if (user.displayName) document.getElementById('inp-name').value = user.displayName;
=======
            if(user.displayName) document.getElementById('inp-name').value = user.displayName;
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
        } else {
            alert("Please sign in to apply.");
            window.location.href = "/main/index.html";
        }
    });

<<<<<<< HEAD
    // 2. Handle Profile Photo Upload (with Cropper)
=======
    // 2. Handle Profile Photo Upload (Preview + Base64)
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
    const dropZonePhoto = document.getElementById('drop-zone-photo');
    const inputPhoto = document.getElementById('inp-file-photo');
    const previewPhoto = document.getElementById('preview-photo');

<<<<<<< HEAD
    // Cropper elements
    const cropperModal = document.getElementById('cropper-modal');
    const cropperImg = document.getElementById('cropper-img');
    const zoomSlider = document.getElementById('zoom-slider');
    const btnSaveCrop = document.getElementById('btn-save-crop');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const cropContainer = document.querySelector('.crop-container');

    // Cropper state
    let cropScale = 1, cropX = 0, cropY = 0;
    let dragging = false, dragStartX, dragStartY;

    function updateCropTransform() {
        cropperImg.style.transform = `translate(${cropX}px, ${cropY}px) scale(${cropScale})`;
    }

    dropZonePhoto.addEventListener('click', () => inputPhoto.click());

    inputPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            cropperImg.src = ev.target.result;
            cropperModal.classList.remove('hidden');
            // Reset cropper
            cropScale = 1; cropX = 0; cropY = 0; zoomSlider.value = 1;
            updateCropTransform();
        };
        reader.readAsDataURL(file);
    });

    // Drag to pan
    cropContainer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        dragStartX = e.clientX - cropX;
        dragStartY = e.clientY - cropY;
        cropContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        dragging = false;
        if (cropContainer) cropContainer.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        cropX = e.clientX - dragStartX;
        cropY = e.clientY - dragStartY;
        updateCropTransform();
    });

    // Touch support for mobile
    cropContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        dragging = true;
        const touch = e.touches[0];
        dragStartX = touch.clientX - cropX;
        dragStartY = touch.clientY - cropY;
    });

    window.addEventListener('touchend', () => { dragging = false; });

    window.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        const touch = e.touches[0];
        cropX = touch.clientX - dragStartX;
        cropY = touch.clientY - dragStartY;
        updateCropTransform();
    });

    // Zoom slider
    zoomSlider.addEventListener('input', (e) => {
        cropScale = parseFloat(e.target.value);
        updateCropTransform();
    });

    // Save cropped image (1:1 @ 400x400)
    btnSaveCrop.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        const ratio = 400 / cropContainer.clientWidth;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 400);
        ctx.save();

        const imgWidth = 400;
        const imgHeight = (cropperImg.naturalHeight / cropperImg.naturalWidth) * 400;

        ctx.translate(cropX * ratio, cropY * ratio);
        ctx.translate(imgWidth / 2, imgHeight / 2);
        ctx.scale(cropScale, cropScale);
        ctx.translate(-imgWidth / 2, -imgHeight / 2);
        ctx.drawImage(cropperImg, 0, 0, imgWidth, imgHeight);
        ctx.restore();

        profilePhotoBase64 = canvas.toDataURL('image/jpeg', 0.85);
        previewPhoto.src = profilePhotoBase64;
        previewPhoto.classList.remove('hidden');
        dropZonePhoto.querySelector('.drop-content').style.opacity = '0';

        cropperModal.classList.add('hidden');
    });

    // Cancel crop
    btnCancelCrop.addEventListener('click', () => {
        cropperModal.classList.add('hidden');
=======
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
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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

<<<<<<< HEAD
    // 4. Handle Submit
    const form = document.getElementById('apply-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- DEFINE VARIABLES HERE ---
        const btn = document.getElementById('btn-submit');
        const status = document.getElementById('status-msg');

=======
// 4. Handle Submit
    const form = document.getElementById('apply-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- DEFINE VARIABLES HERE ---
        const btn = document.getElementById('btn-submit');
        const status = document.getElementById('status-msg');
        
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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
<<<<<<< HEAD

            // Reset Previews
            const previewPhoto = document.getElementById('preview-photo');
            const previewSample = document.getElementById('preview-sample-text');
            if (previewPhoto) previewPhoto.classList.add('hidden');
            if (previewSample) previewSample.classList.add('hidden');
            document.querySelectorAll('.drop-content').forEach(el => el.style.opacity = '1');

=======
            
            // Reset Previews
            const previewPhoto = document.getElementById('preview-photo');
            const previewSample = document.getElementById('preview-sample-text');
            if(previewPhoto) previewPhoto.classList.add('hidden');
            if(previewSample) previewSample.classList.add('hidden');
            document.querySelectorAll('.drop-content').forEach(el => el.style.opacity = '1');
            
>>>>>>> c585c7018a2d3e0b95ac9c5a56fba3db88c989f7
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
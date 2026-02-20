document.addEventListener('DOMContentLoaded', () => {
    loadStudentResources();
});

async function loadStudentResources() {
    const tableBody = document.getElementById('student-table-body');

    try {
        const response = await fetch('resources/resources-data.json');
        const data = await response.json();

        // 1. Filter by a specific tag (e.g., 'credits')
        // 2. Use .slice(-3) to get the LAST 3 items
        // 3. .reverse() if you want the very latest item at the top
        const latestResources = data.all_items
            .filter(item => item.tags.includes('credits'))
            .slice(-5)
            .reverse();

        tableBody.innerHTML = '';

        latestResources.forEach((item, index) => {
            const row = document.createElement('tr');

            // Add fade-in animation similar to your resources page
            row.style.animation = `fadeIn 0.4s ease-in ${index * 0.1}s both`;

            row.innerHTML = `
                <td data-label="Resource">${item.resource}</td>
                <td data-label="Value">${item.value}</td>
                <td data-label="Description">${item.description}</td>
                <td><a href="${item.link}" target="_blank" class="apply-link">Apply Now</a></td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading student resources:', error);
        tableBody.innerHTML = '<tr><td colspan="4">Failed to load resources.</td></tr>';
    }
}


// --- STEPPED SCROLL LOGIC FOR STUDENTS PAGE ---
const sections = [
    { selector: '.HOME' },
    { selector: '.AI_intro' },       // ai.learn section
    { selector: '.resources-section' } // free.resources section
];

let currentSectionIndex = 0;
let isSteppedScrolling = true;

document.addEventListener('keydown', (e) => {
    // Prevent interference if user is typing in a search bar or input (if any added later)
    const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
    if (isTyping) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (isSteppedScrolling) {
            e.preventDefault(); // Stop the default jumpy scroll

            if (e.key === 'ArrowDown') {
                if (currentSectionIndex < sections.length - 1) {
                    currentSectionIndex++;
                    scrollToSection(currentSectionIndex);
                } else {
                    // Reach the end of the table? Allow normal scrolling for the footer
                    isSteppedScrolling = false;
                }
            } else if (e.key === 'ArrowUp') {
                if (currentSectionIndex > 0) {
                    currentSectionIndex--;
                    scrollToSection(currentSectionIndex);
                }
            }
        }
    }
});

function scrollToSection(index) {
    const target = document.querySelector(sections[index].selector);
    if (target) {
        target.scrollIntoView({
            behavior: 'smooth',
            block: 'center' // Centers the section in the viewport
        });
    }
}

// Reset the index if the user scrolls manually using the mouse wheel
window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + window.innerHeight / 2;
    sections.forEach((sec, idx) => {
        const el = document.querySelector(sec.selector);
        if (el) {
            const offsetTop = el.offsetTop;
            const offsetBottom = offsetTop + el.offsetHeight;
            if (scrollPos >= offsetTop && scrollPos <= offsetBottom) {
                currentSectionIndex = idx;
                isSteppedScrolling = true;
            }
        }
    });
});
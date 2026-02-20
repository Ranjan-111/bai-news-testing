// resources.js - Dynamic table population with category filtering

let allResources = {};
let currentCategory = 'credits';

// Add these variables at the top
const itemsPerPage = 16;
let currentPage = 1;
let filteredResources = []; // To hold current category items
let centerPage = 1;

// DOM Elements
const tableBody = document.getElementById('table-body');
const resourcesTable = document.getElementById('resources-table');
const loadingState = document.getElementById('loading');
const noResults = document.getElementById('no-results');
const totalValueDisplay = document.getElementById('total-value');
const tabButtons = document.querySelectorAll('.tab-btn');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadResources();
    setupTabListeners();

    // --- KEYBOARD NAVIGATION FOR CATEGORIES ---

    // Define the order of categories as they appear in your HTML
    const categories = ['credits', 'discounts', 'courses'];

    document.addEventListener('keydown', (e) => {
        // 1. Identify current index
        let currentIndex = categories.indexOf(currentCategory);

        // 2. Handle Right Arrow (Next Category)
        if (e.key === 'ArrowRight') {
            if (currentIndex < categories.length - 1) {
                const nextCategory = categories[currentIndex + 1];
                switchCategory(nextCategory);
            }
        }

        // 3. Handle Left Arrow (Previous Category)
        if (e.key === 'ArrowLeft') {
            if (currentIndex > 0) {
                const prevCategory = categories[currentIndex - 1];
                switchCategory(prevCategory);
            }
        }
    });

    /**
     * Helper function to programmatically trigger a category switch
     * This reuses your existing displayResources logic and updates UI state
     */
    function switchCategory(category) {
        // Update the global state
        currentCategory = category;

        // Update the UI (Active Tab Styling)
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-category') === category) {
                btn.classList.add('active');
                // Ensure the tab is visible if it's a scrolling container on mobile
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                btn.classList.remove('active');
            }
        });

        // Reset pagination to page 1 for the new category
        centerPage = 1;
        currentPage = 1;

        // Trigger the existing data display logic
        displayResources(category);
    }
});

// Load resources from JSON file
async function loadResources() {
    try {
        const response = await fetch('resources-data.json');
        if (!response.ok) {
            throw new Error('Failed to load resources');
        }
        allResources = await response.json();
        displayResources(currentCategory);
    } catch (error) {
        console.error('Error loading resources:', error);
        showError();
    }
}

// Setup tab click listeners
function setupTabListeners() {
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active state from all tabs
            tabButtons.forEach(b => {
                b.classList.remove('active');
            });

            // Add active state to clicked tab
            btn.classList.add('active');

            // Get category and display
            currentCategory = btn.getAttribute('data-category');
            displayResources(currentCategory);
        });
    });
}

// Update displayResources to handle pagination logic
function displayResources(category) {
    loadingState.style.display = 'block';
    resourcesTable.style.display = 'none';
    noResults.style.display = 'none';

    setTimeout(() => {
        // Filter by tags (based on your previous request)
        filteredResources = allResources.all_items.filter(item =>
            item.tags.includes(category)
        );

        if (filteredResources.length === 0) {
            showNoResults();
            return;
        }

        renderPage(1); // Always start at page 1 when switching tabs
        loadingState.style.display = 'none';
        resourcesTable.style.display = 'table';
    }, 300);
}

function renderPage(page) {
    currentPage = page;
    tableBody.innerHTML = '';

    // Calculate start and end indexes
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredResources.slice(start, end);

    pageItems.forEach((resource, index) => {
        const row = createTableRow(resource, index);
        tableBody.appendChild(row);
    });

    renderPaginationButtons();
}

function renderPaginationButtons() {
    const container = document.getElementById('pages-container');
    const totalPages = Math.ceil(filteredResources.length / itemsPerPage);
    if (!container) return;
    container.innerHTML = '';

    // If only 1 page, hide the whole bar
    const paginationBar = document.querySelector('.pagination-bar');
    if (totalPages <= 1) {
        paginationBar.style.display = 'none';
        return;
    }
    paginationBar.style.display = 'flex';

    // Helper to create the circles (Active, Inactive, or Placeholder)
    const createBtn = (text, type, onClick) => {
        const btn = document.createElement(type === 'placeholder' ? 'div' : 'button');
        btn.className = `page-circle ${type}`;
        if (type !== 'placeholder') {
            btn.textContent = text;
            btn.onclick = onClick;
        } else {
            // Placeholder takes up space but is invisible
            btn.style.width = "3.5rem";
            btn.style.visibility = "hidden";
        }
        container.appendChild(btn);
    };

    // Slot 1: Previous Number
    const prevNum = centerPage - 1;
    if (prevNum >= 1) {
        createBtn(prevNum, (prevNum === currentPage) ? 'active' : 'inactive', () => goToPage(prevNum));
    } else {
        createBtn('', 'placeholder', null);
    }

    // Slot 2: Center Number (Active)
    createBtn(centerPage, (centerPage === currentPage) ? 'active' : 'inactive', () => goToPage(centerPage));

    // Slot 3: Next Number
    const nextNum = centerPage + 1;
    if (nextNum <= totalPages) {
        createBtn(nextNum, (nextNum === currentPage) ? 'active' : 'inactive', () => goToPage(nextNum));
    } else {
        createBtn('', 'placeholder', null);
    }

    // Update Arrow Functionality
    const totalPagesForArrows = totalPages; // Capture in closure
    document.getElementById('prev-page').onclick = () => changePage('prev', totalPagesForArrows);
    document.getElementById('next-page').onclick = () => changePage('next', totalPagesForArrows);
}

// Create a table row element
function createTableRow(resource, index) {
    const row = document.createElement('tr');
    row.style.animation = `fadeIn 0.4s ease-in ${index * 0.05}s both`;

    // Resource name cell
    const nameCell = document.createElement('td');
    nameCell.textContent = resource.resource;
    row.appendChild(nameCell);

    // Value cell
    const valueCell = document.createElement('td');
    valueCell.textContent = resource.value;
    row.appendChild(valueCell);

    // Description cell
    const descCell = document.createElement('td');
    descCell.textContent = resource.description;
    row.appendChild(descCell);

    // Updated Apply link cell
    const actionCell = document.createElement('td');
    const link = document.createElement('a');
    link.href = resource.link || '#'; // Use the new link key
    link.target = "_blank";           // Open in new tab
    link.className = 'apply-link';
    link.setAttribute('aria-label', `Apply for ${resource.resource}`);
    link.textContent = 'Apply Now';

    actionCell.appendChild(link);
    row.appendChild(actionCell);

    return row;
}

function goToPage(num) {
    centerPage = num; // Set the clicked number as the new center
    currentPage = num; // Update actual page
    renderPage(num);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changePage(direction, totalPages) {
    if (direction === 'prev' && centerPage > 1) {
        centerPage--;
        renderPaginationButtons();
    } else if (direction === 'next' && centerPage < totalPages) {
        centerPage++;
        renderPaginationButtons();
    }
}

// Calculate total value of resources
function calculateTotalValue(resources) {
    let total = 0;
    let hasNonNumeric = false;

    resources.forEach(resource => {
        const value = resource.value;
        // Extract numeric value from string like "$100", "$200K+", "85% off"
        const numericMatch = value.match(/\$?([\d,]+)/);
        if (numericMatch) {
            let amount = parseFloat(numericMatch[1].replace(/,/g, ''));
            // Handle K notation (thousands)
            if (value.includes('K')) {
                amount *= 1000;
            }
            total += amount;
        } else {
            hasNonNumeric = true;
        }
    });

    // Format and display total
    if (total > 0) {
        const formattedTotal = total >= 1000
            ? `$${(total / 1000).toFixed(1)}K${hasNonNumeric ? '+' : ''}`
            : `$${total.toFixed(0)}${hasNonNumeric ? '+' : ''}`;
        totalValueDisplay.textContent = formattedTotal;
    } else {
        totalValueDisplay.textContent = 'Varies';
    }
}

// Handle apply button click
function handleApplyClick(resource) {
    console.log('Apply clicked for:', resource.resource);
    // You can add your apply logic here
    // For example: open a modal, redirect to application page, etc.
    alert(`Application process for ${resource.resource} would start here.\n\nValue: ${resource.value}\n${resource.description}`);
}

// Show no results state
function showNoResults() {
    loadingState.style.display = 'none';
    resourcesTable.style.display = 'none';
    noResults.style.display = 'block';
    totalValueDisplay.textContent = '$0';
}

// Show error state
function showError() {
    loadingState.innerHTML = '<p style="color: #d73634;">Failed to load resources. Please try again later.</p>';
    totalValueDisplay.textContent = '$0';
}

// Optional: Add search/filter functionality
function filterResources(searchTerm) {
    const resources = allResources[currentCategory];
    if (!resources) return;

    const filtered = resources.filter(resource =>
        resource.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Clear and populate with filtered results
    tableBody.innerHTML = '';
    filtered.forEach((resource, index) => {
        const row = createTableRow(resource, index);
        tableBody.appendChild(row);
    });

    calculateTotalValue(filtered);
}

// Export functions if needed for external use
window.resourcesApp = {
    filterResources,
    loadResources,
    displayResources
};
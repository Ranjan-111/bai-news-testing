/**
 * Shared Markdown Renderer Module
 * 
 * Centralizes all marked.js configuration, content normalization,
 * Markdown-to-HTML rendering, Chart.js premium chart initialization,
 * drag-to-resize charts, alignment (left/right/full), and settings UI.
 */

import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

// ═══════════════════════════════════════════════════════════════
// Premium Chart Palette — Red/Pink theme from graph-editor.html
// ═══════════════════════════════════════════════════════════════
const CHART_PALETTE = ['#a83c3c', '#d73634', '#e8c5c5', '#c26d6d', '#8b3a3a',
                       '#e09999', '#b85555', '#6b2a2a', '#f0bfbf', '#f5e5e5'];

// Resize constraints
const MIN_CHART_WIDTH  = 250;
const MIN_CHART_HEIGHT = 180;
const MAX_CHART_HEIGHT = 800;

// Unique ID counter for radio groups (multiple charts on one page)
let chartUID = 0;

// ═══════════════════════════════════════════════════════════════
// Marked Configuration
// ═══════════════════════════════════════════════════════════════
marked.use({
    breaks: true,
    gfm: true,
    renderer: {
        code({ text, lang }) {
            if (lang === 'chart') {
                const safeJson = text.replace(/'/g, '&#39;');
                return `<div class="premium-chart-container"><canvas class="article-chart" data-config='${safeJson}'></canvas></div>`;
            }
            return false;
        }
    }
});

// ═══════════════════════════════════════════════════════════════
// Content Normalization
// ═══════════════════════════════════════════════════════════════
export function normalizeContent(text) {
    if (!text) return '';
    return text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

// ═══════════════════════════════════════════════════════════════
// Markdown Rendering
// ═══════════════════════════════════════════════════════════════
export function renderMarkdown(text) {
    if (!text) return "";
    return marked.parse(normalizeContent(text));
}

// ═══════════════════════════════════════════════════════════════
// Settings Icon SVG (gear icon)
// ═══════════════════════════════════════════════════════════════
const GEAR_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

// ═══════════════════════════════════════════════════════════════
// Build Chart.js Config (with type mapping)
// ═══════════════════════════════════════════════════════════════
function buildChartConfig(config, overrides) {
    const rawType = config.type || 'bar';
    const data = config.data || {};
    const userOptions = config.options || {};

    let chartType = rawType;
    let indexAxis = 'x';
    let stacked = false;
    let fill = false;

    if (rawType === 'horizontalBar') { chartType = 'bar'; indexAxis = 'y'; }
    else if (rawType === 'stackedBar') { chartType = 'bar'; stacked = true; }
    else if (rawType === 'area') { chartType = 'line'; fill = true; }

    const showLegend = overrides.legend !== undefined ? overrides.legend : true;
    const showGrid = overrides.grid !== undefined ? overrides.grid : true;

    const datasets = (data.datasets || []).map((ds, i) => {
        const color = CHART_PALETTE[i % CHART_PALETTE.length];
        const colorAlpha = color + '55';
        const base = { ...ds };

        if (['pie', 'doughnut', 'polarArea'].includes(chartType)) {
            base.backgroundColor = base.backgroundColor ||
                (data.datasets[0].data || []).map((_, j) => CHART_PALETTE[j % CHART_PALETTE.length] + 'cc');
            base.borderColor = base.borderColor || '#ffffff';
            base.borderWidth = base.borderWidth || 2;
        } else if (chartType === 'line') {
            base.borderColor = base.borderColor || color;
            base.backgroundColor = base.backgroundColor || colorAlpha;
            base.borderWidth = base.borderWidth || 2.5;
            base.pointBackgroundColor = base.pointBackgroundColor || color;
            base.pointBorderColor = '#fff';
            base.pointRadius = base.pointRadius || 4;
            base.pointHoverRadius = base.pointHoverRadius || 6;
            base.tension = base.tension !== undefined ? base.tension : 0.35;
            if (fill || rawType === 'area') base.fill = true;
            else if (base.fill === undefined) base.fill = false;
        } else if (chartType === 'radar') {
            base.borderColor = base.borderColor || color;
            base.backgroundColor = base.backgroundColor || colorAlpha;
            base.borderWidth = 2;
            base.pointBackgroundColor = base.pointBackgroundColor || color;
        } else if (chartType === 'scatter' || chartType === 'bubble') {
            base.backgroundColor = base.backgroundColor || color + 'aa';
            base.borderColor = base.borderColor || color;
            base.borderWidth = 1.5;
        } else {
            base.backgroundColor = base.backgroundColor || color + 'cc';
            base.borderColor = base.borderColor || color;
            base.borderWidth = base.borderWidth || 1;
            base.borderRadius = base.borderRadius || 4;
        }
        return base;
    });

    // Resolve title — supports both string ("My Title") and v2 object ({display, text})
    let titleText = '';
    if (typeof userOptions.title === 'string') {
        titleText = userOptions.title;
    } else if (userOptions.title && typeof userOptions.title === 'object') {
        titleText = userOptions.title.text || '';
    }

    const fullOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
            title: {
                display: !!titleText,
                text: titleText,
                font: { size: 16, weight: '600', family: 'Inter, sans-serif' },
                color: '#333',
                padding: { bottom: 16 }
            },
            legend: {
                display: showLegend,
                position: 'top',
                labels: {
                    font: { size: 12, family: 'Inter, sans-serif' },
                    color: '#555',
                    padding: 16,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(139, 58, 58, 0.92)',
                titleFont: { size: 13, family: 'Inter, sans-serif', weight: '600' },
                bodyFont: { size: 12, family: 'Inter, sans-serif' },
                titleColor: '#fff',
                bodyColor: '#f5e5e5',
                padding: 12,
                cornerRadius: 8,
                borderColor: '#a83c3c44',
                borderWidth: 1,
                displayColors: true,
                boxPadding: 4
            }
        }
    };

    if (!['pie', 'doughnut', 'polarArea', 'radar'].includes(chartType)) {
        fullOptions.indexAxis = indexAxis;
        fullOptions.scales = {
            x: {
                grid: { display: showGrid, color: '#f0dede', drawBorder: false },
                ticks: { font: { size: 12, family: 'Inter, sans-serif' }, color: '#8b6666' },
                stacked: stacked
            },
            y: {
                grid: { display: showGrid, color: '#f0dede', drawBorder: false },
                ticks: { font: { size: 12, family: 'Inter, sans-serif' }, color: '#8b6666' },
                beginAtZero: true,
                stacked: stacked
            }
        };
    }

    if (chartType === 'radar') {
        fullOptions.scales = {
            r: {
                grid: { color: showGrid ? '#e8d5d5' : 'transparent' },
                ticks: { font: { size: 10 }, color: '#a88888', backdropColor: 'transparent' },
                pointLabels: { font: { size: 12, family: 'Inter, sans-serif' }, color: '#6b3a3a' },
                beginAtZero: true
            }
        };
    }

    if (chartType === 'polarArea') {
        fullOptions.scales = {
            r: {
                grid: { color: showGrid ? '#e8d5d5' : 'transparent' },
                ticks: { font: { size: 10 }, color: '#a88888', backdropColor: 'transparent' },
                beginAtZero: true
            }
        };
    }

    return { type: chartType, data: { labels: data.labels, datasets }, options: fullOptions };
}

// ═══════════════════════════════════════════════════════════════
// Inject Settings UI + Resize Handle + Alignment
// ═══════════════════════════════════════════════════════════════
function injectSettingsUI(container, canvas, config, chartIndex, sourceTa) {
    const uid = chartUID++;
    
    // Parse layout defaults
    const layoutConfig = config._layout || {};
    let currentAlign = layoutConfig.align || 'full';
    let isLegendVisible = layoutConfig.legend !== undefined ? layoutConfig.legend : true;
    let isGridVisible = layoutConfig.grid !== undefined ? layoutConfig.grid : true;

    // Apply init dimensions to container immediately
    if (layoutConfig.width) {
        container.style.width = typeof layoutConfig.width === 'number' ? layoutConfig.width + 'px' : layoutConfig.width;
    }
    if (layoutConfig.height) {
        container.style.height = typeof layoutConfig.height === 'number' ? layoutConfig.height + 'px' : layoutConfig.height;
    }

    // ── Settings toggle button (gear icon) ──
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'chart-settings-toggle';
    toggleBtn.title = 'Chart Options';
    toggleBtn.innerHTML = GEAR_SVG;
    toggleBtn.type = 'button';

    // ── Settings panel ──
    const panel = document.createElement('div');
    panel.className = 'chart-settings-panel';
    panel.innerHTML = `
        <div class="cs-toggles">
            <label class="cs-toggle"><input type="checkbox" class="cs-legend" ${isLegendVisible ? 'checked' : ''}> Show Legend</label>
            <label class="cs-toggle"><input type="checkbox" class="cs-grid-opt" ${isGridVisible ? 'checked' : ''}> Show Grid</label>
        </div>
        <div class="cs-align-group">
            <div class="cs-align-label">Alignment</div>
            <div class="cs-align-options">
                <label class="cs-align-opt">
                    <input type="radio" name="cs-align-${uid}" value="full" ${currentAlign === 'full' ? 'checked' : ''}>
                    <span class="cs-align-pill">Full</span>
                </label>
                <label class="cs-align-opt">
                    <input type="radio" name="cs-align-${uid}" value="left" ${currentAlign === 'left' ? 'checked' : ''}>
                    <span class="cs-align-pill">Left</span>
                </label>
                <label class="cs-align-opt">
                    <input type="radio" name="cs-align-${uid}" value="right" ${currentAlign === 'right' ? 'checked' : ''}>
                    <span class="cs-align-pill">Right</span>
                </label>
            </div>
        </div>
    `;

    // ── Resize handle (position changes based on alignment) ──
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'chart-resize-handle';

    // Insert elements
    container.insertBefore(toggleBtn, container.firstChild);
    container.insertBefore(panel, canvas);
    container.appendChild(resizeHandle);
    
    // ── Save Function ──
    function saveLayoutToMarkdown(updates) {
        if (!sourceTa) return;
        
        if (!config._layout) config._layout = {};
        Object.assign(config._layout, updates);

        const currentText = sourceTa.value;
        let cIdx = 0;
        
        const newText = currentText.replace(/```chart\s*([\s\S]*?)```/g, (match) => {
            if (cIdx === chartIndex) {
                 cIdx++;
                 return "```chart\n" + JSON.stringify(config, null, 2) + "\n```";
            }
            cIdx++;
            return match;
        });

        if (newText !== currentText) {
            sourceTa.value = newText;
        }
    }

    // ── Toggle panel visibility ──
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('active');
        toggleBtn.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            panel.classList.remove('active');
            toggleBtn.classList.remove('active');
        }
    });

    // ── Input references ──
    const legendCb = panel.querySelector('.cs-legend');
    const gridCb = panel.querySelector('.cs-grid-opt');
    const alignRadios = panel.querySelectorAll(`input[name="cs-align-${uid}"]`);

    // ── Re-render chart (legend/grid changes) ──
    function reRenderChart() {
        if (canvas.__chartInstance) {
            canvas.__chartInstance.destroy();
            canvas.__chartInstance = null;
        }
        const overrides = { legend: legendCb.checked, grid: gridCb.checked };
        try {
            canvas.__chartInstance = new Chart(canvas, buildChartConfig(config, overrides));
        } catch (e) {
            console.warn('Chart re-render error:', e);
        }
        
        saveLayoutToMarkdown({
            legend: legendCb.checked,
            grid: gridCb.checked
        });
    }

    legendCb.addEventListener('change', reRenderChart);
    gridCb.addEventListener('change', reRenderChart);

    // ═════════════════════════════════════════════════════════
    // ResizeObserver — smoothly re-fits the chart canvas
    // whenever the container dimensions change.
    // Paused during manual drag to prevent Chart.js conflicts.
    // ═════════════════════════════════════════════════════════
    let resizeRAF;
    let observerActive = true;
    const observer = new ResizeObserver(() => {
        if (!observerActive) return;
        cancelAnimationFrame(resizeRAF);
        resizeRAF = requestAnimationFrame(() => {
            if (canvas.__chartInstance) canvas.__chartInstance.resize();
        });
    });
    observer.observe(container);

    // ═════════════════════════════════════════════════════════
    // ALIGNMENT — Full / Left / Right
    // ═════════════════════════════════════════════════════════
    function applyAlignment(align, isInit = false) {
        currentAlign = align;

        container.classList.remove('chart-align-left', 'chart-align-right');
        resizeHandle.classList.remove('handle-left');

        if (align === 'left') {
            container.classList.add('chart-align-left');
            if (!isInit) container.style.width = '50%';
        } else if (align === 'right') {
            container.classList.add('chart-align-right');
            if (!isInit) container.style.width = '50%';
            resizeHandle.classList.add('handle-left');
        } else {
            if (!isInit) container.style.width = '';
        }

        // Let layout settle, then resize chart
        requestAnimationFrame(() => {
            if (canvas.__chartInstance) canvas.__chartInstance.resize();
        });
    }

    // Apply startup alignment classes without overriding dimensions
    applyAlignment(currentAlign, true);

    alignRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                applyAlignment(radio.value);
                saveLayoutToMarkdown({
                    align: radio.value
                });
            }
        });
    });

    // ═════════════════════════════════════════════════════════
    // DRAG-TO-RESIZE
    //
    // Handle is at bottom-right for Full/Left alignment,
    // and bottom-left for Right alignment.
    //
    // When handle is on the LEFT side (Right-aligned chart):
    //   - Dragging left  → width increases
    //   - Dragging right → width decreases
    // ═════════════════════════════════════════════════════════
    let isResizing = false;
    let startX, startY, startW, startH;

    function getMaxWidth() {
        const parent = container.parentElement;
        if (!parent) return 1200;
        return parent.clientWidth;
    }

    function onDocMouseMove(e) {
        if (!isResizing) return;

        const maxW = getMaxWidth();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW;
        if (currentAlign === 'right') {
            // Handle on left: drag left = bigger
            newW = startW - dx;
        } else {
            // Handle on right: drag right = bigger
            newW = startW + dx;
        }

        newW = Math.max(MIN_CHART_WIDTH, Math.min(newW, maxW));
        const newH = Math.max(MIN_CHART_HEIGHT, Math.min(startH + dy, MAX_CHART_HEIGHT));

        container.style.width = newW + 'px';
        container.style.height = newH + 'px';
    }

    function onDocMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        container.classList.remove('chart-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Remove global listeners
        document.removeEventListener('mousemove', onDocMouseMove);
        document.removeEventListener('mouseup', onDocMouseUp);

        // Resume observer + final chart resize
        observerActive = true;
        if (canvas.__chartInstance) canvas.__chartInstance.resize();
        
        // Calculate width as responsive percentage
        const parentW = getMaxWidth();
        const rawW = parseFloat(container.style.width) || container.offsetWidth;
        const targetPercent = Math.round((rawW / parentW) * 1000) / 10; // e.g. 85.4
        
        saveLayoutToMarkdown({
            width: targetPercent + "%",
            height: Math.round(parseFloat(container.style.height) || container.offsetHeight)
        });
    }

    function onDocTouchMove(e) {
        if (!isResizing) return;
        const t = e.touches[0];
        onDocMouseMove({ clientX: t.clientX, clientY: t.clientY });
    }

    function onDocTouchEnd() {
        onDocMouseUp();
        document.removeEventListener('touchmove', onDocTouchMove);
        document.removeEventListener('touchend', onDocTouchEnd);
    }

    // Mousedown — start drag, attach global listeners
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = container.offsetWidth;
        startH = container.offsetHeight;
        container.classList.add('chart-resizing');
        document.body.style.cursor = currentAlign === 'right' ? 'nesw-resize' : 'nwse-resize';
        document.body.style.userSelect = 'none';

        // Pause observer during drag to prevent Chart.js conflicts
        observerActive = false;

        document.addEventListener('mousemove', onDocMouseMove);
        document.addEventListener('mouseup', onDocMouseUp);
        e.preventDefault();
        e.stopPropagation();
    });

    // Touch support
    resizeHandle.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        isResizing = true;
        startX = t.clientX;
        startY = t.clientY;
        startW = container.offsetWidth;
        startH = container.offsetHeight;
        container.classList.add('chart-resizing');

        observerActive = false;

        document.addEventListener('touchmove', onDocTouchMove, { passive: true });
        document.addEventListener('touchend', onDocTouchEnd);
        e.preventDefault();
    }, { passive: false });
}

// ═══════════════════════════════════════════════════════════════
// Chart.js Premium Initialization
// ═══════════════════════════════════════════════════════════════
export function initPremiumCharts(container) {
    if (!container || typeof Chart === 'undefined') return;

    const sourceId = container.dataset.sourceTextarea;
    const sourceTa = sourceId ? document.getElementById(sourceId) : null;

    const canvases = container.querySelectorAll('.article-chart');
    canvases.forEach((canvas, index) => {
        if (canvas.__chartInstance) {
            canvas.__chartInstance.destroy();
            canvas.__chartInstance = null;
        }

        let config;
        try {
            config = JSON.parse(canvas.getAttribute('data-config'));
        } catch (e) {
            console.warn('Invalid chart JSON:', e);
            const wrapper = canvas.closest('.premium-chart-container');
            if (wrapper) {
                wrapper.innerHTML =
                    '<p style="color:#a88888;font-size:0.85rem;text-align:center;padding:1rem;">⚠ Invalid chart configuration</p>';
            }
            return;
        }

        const chartContainer = canvas.closest('.premium-chart-container');
        
        // Use saved layout if it exists
        const layout = config._layout || {};
        const overrides = { 
            legend: layout.legend !== undefined ? layout.legend : true, 
            grid: layout.grid !== undefined ? layout.grid : true 
        };
        const chartConfig = buildChartConfig(config, overrides);

        try {
            canvas.__chartInstance = new Chart(canvas, chartConfig);
        } catch (e) {
            console.warn('Chart render error:', e);
            return;
        }

        if (chartContainer && !chartContainer.querySelector('.chart-settings-toggle')) {
            injectSettingsUI(chartContainer, canvas, config, index, sourceTa);
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// Live Preview Setup
// ═══════════════════════════════════════════════════════════════
export function setupMarkdownPreview(textareaId, previewId, labelId) {
    const ta = document.getElementById(textareaId);
    const preview = document.getElementById(previewId);
    const label = labelId ? document.getElementById(labelId) : null;

    if (!ta || !preview) return;
    
    // Link preview back to editor so charts can update text on-the-fly
    preview.dataset.sourceTextarea = textareaId;

    let debounceTimer;
    ta.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const raw = ta.value;
            if (raw.trim()) {
                preview.style.display = 'block';
                if (label) label.style.display = 'block';
                preview.innerHTML = marked.parse(normalizeContent(raw));
                initPremiumCharts(preview);
            } else {
                preview.style.display = 'none';
                if (label) label.style.display = 'none';
                preview.innerHTML = '';
            }
        }, 300);
    });
}

// ═══════════════════════════════════════════════════════════════
// Static Preview Rendering
// ═══════════════════════════════════════════════════════════════
export function renderStaticPreview(value, preview) {
    if (!preview) return;

    const label = preview.previousElementSibling;
    if (value && value.trim()) {
        preview.style.display = 'block';
        if (label) label.style.display = 'block';
        preview.innerHTML = marked.parse(normalizeContent(value));
        initPremiumCharts(preview);
    } else {
        preview.style.display = 'none';
        if (label) label.style.display = 'none';
    }
}

export { marked };

/**
 * Shared Markdown Editor Toolbar Module
 * 
 * Provides the applyStyle function used by the Markdown formatting
 * toolbar (bold, italic, headings, lists, code, tables, and Chart.js chart templates).
 * Attach to window so HTML onclick handlers can invoke it directly.
 */

/**
 * Apply a Markdown formatting style to a textarea.
 * This is bound to `window.applyStyle` so inline HTML onclick handlers work.
 * 
 * @param {string} type       - The formatting type
 * @param {string} textareaId - The ID of the textarea to format
 */
window.applyStyle = function(type, textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end, text.length);

    let newText = text;
    let newCursorPos = end;

    switch(type) {
        case 'h1': newText = before + '# ' + selected + after; newCursorPos = end + 2; break;
        case 'h2': newText = before + '## ' + selected + after; newCursorPos = end + 3; break;
        case 'h3': newText = before + '### ' + selected + after; newCursorPos = end + 4; break;
        case 'bold': newText = before + '**' + selected + '**' + after; newCursorPos = end + 2; break;
        case 'italic': newText = before + '_' + selected + '_' + after; newCursorPos = end + 1; break;
        case 'list': newText = before + '- ' + selected + after; newCursorPos = end + 2; break;
        case 'code': newText = before + '`' + selected + '`' + after; newCursorPos = end + 1; break;
        case 'quote': newText = before + '> ' + selected + after; newCursorPos = end + 2; break;
        case 'hr': newText = before + '\n---\n' + selected + after; newCursorPos = end + 5; break;
        case 'table': {
            const tableTemplate = "\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n";
            newText = before + tableTemplate + selected + after; 
            newCursorPos = start + tableTemplate.length; 
            break;
        }

        // ═══════════════════════════════════════════════════
        // Chart.js Templates — all 11 chart types
        // ═══════════════════════════════════════════════════

        case 'bar': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "bar",
                data: {
                    labels: ["Category A", "Category B", "Category C", "Category D", "Category E", "Category F"],
                    datasets: [{ label: "Value", data: [200, 150, 100, 100, 96, 120] }]
                },
                options: { title: "Comparison Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'hbar': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "horizontalBar",
                data: {
                    labels: ["Category A", "Category B", "Category C", "Category D", "Category E", "Category F"],
                    datasets: [{ label: "Value", data: [200, 150, 100, 100, 96, 120] }]
                },
                options: { title: "Horizontal Bar Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'stacked': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "stackedBar",
                data: {
                    labels: ["Q1", "Q2", "Q3", "Q4"],
                    datasets: [
                        { label: "Cloud Credits", data: [120, 150, 180, 200] },
                        { label: "Dev Tools", data: [80, 90, 70, 110] },
                        { label: "Design Tools", data: [40, 55, 60, 75] }
                    ]
                },
                options: { title: "Stacked Bar Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'line': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "line",
                data: {
                    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                    datasets: [
                        { label: "Sign Ups", data: [65, 120, 180, 240, 310, 420] },
                        { label: "Active Users", data: [40, 85, 130, 190, 260, 350] }
                    ]
                },
                options: { title: "Trend Line" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'area': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "area",
                data: {
                    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                    datasets: [
                        { label: "Revenue", data: [300, 450, 520, 680, 750, 920] },
                        { label: "Expenses", data: [200, 300, 350, 400, 420, 500] }
                    ]
                },
                options: { title: "Area Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'pie': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "pie",
                data: {
                    labels: ["Cloud Credits", "Dev Tools", "Design", "Education", "Domains", "Other"],
                    datasets: [{ data: [35, 25, 15, 12, 8, 5] }]
                },
                options: { title: "Composition" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'doughnut': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "doughnut",
                data: {
                    labels: ["GitHub", "JetBrains", "AWS", "Figma", "Notion", "Other"],
                    datasets: [{ data: [30, 22, 18, 14, 10, 6] }]
                },
                options: { title: "Doughnut Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'radar': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "radar",
                data: {
                    labels: ["Cloud", "IDE", "Design", "Database", "CI/CD", "Hosting"],
                    datasets: [
                        { label: "Free Tier", data: [85, 90, 70, 60, 80, 75] },
                        { label: "Student Pack", data: [95, 100, 90, 85, 95, 90] }
                    ]
                },
                options: { title: "Radar Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'polar': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "polarArea",
                data: {
                    labels: ["Cloud", "Dev Tools", "Design", "Database", "CI/CD", "Analytics"],
                    datasets: [{ data: [85, 92, 78, 65, 88, 72] }]
                },
                options: { title: "Polar Area Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'scatter': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "scatter",
                data: {
                    datasets: [{
                        label: "Data Points",
                        data: [
                            { x: 10, y: 20 }, { x: 25, y: 45 }, { x: 40, y: 35 },
                            { x: 55, y: 60 }, { x: 70, y: 55 }, { x: 85, y: 80 }
                        ]
                    }]
                },
                options: { title: "Scatter Plot" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
        case 'bubble': {
            const tmpl = '\n```chart\n' + JSON.stringify({
                type: "bubble",
                data: {
                    datasets: [{
                        label: "Resource Popularity",
                        data: [
                            { x: 20, y: 30, r: 15 }, { x: 40, y: 10, r: 10 },
                            { x: 30, y: 50, r: 20 }, { x: 60, y: 40, r: 12 },
                            { x: 50, y: 60, r: 18 }, { x: 80, y: 20, r: 8 }
                        ]
                    }]
                },
                options: { title: "Bubble Chart" }
            }, null, 2) + '\n```\n';
            newText = before + tmpl + selected + after;
            newCursorPos = start + tmpl.length;
            break;
        }
    }

    textarea.value = newText;
    textarea.focus();
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;

    // Trigger preview update
    textarea.dispatchEvent(new Event('input'));
};

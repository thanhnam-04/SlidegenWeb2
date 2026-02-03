// Global variables
let slidePairs = [];
let analysisResults = {
    total_slides: 0,
    average_score: 0.0,
    slides: [],
    summary: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        critical: 0
    },
    all_errors: []
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    const folderInput = document.getElementById('folderInput');
    const zipInput = document.getElementById('zipInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const newAnalysisBtn = document.getElementById('newAnalysisBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const exportBtn = document.getElementById('exportBtn');
    const filterSeverity = document.getElementById('filterSeverity');
    const searchError = document.getElementById('searchError');

    folderInput.addEventListener('change', handleFolderSelect);
    zipInput.addEventListener('change', handleZipSelect);
    analyzeBtn.addEventListener('click', analyzeAllSlides);
    newAnalysisBtn.addEventListener('click', resetAnalysis);
    downloadReportBtn.addEventListener('click', downloadReport);
    exportBtn.addEventListener('click', exportToCSV);
    filterSeverity.addEventListener('change', filterErrors);
    searchError.addEventListener('input', filterErrors);
    
    // Modal close handlers
    document.getElementById('closeModal')?.addEventListener('click', () => {
        document.getElementById('errorDetailsModal').style.display = 'none';
    });
    
    document.getElementById('closeSlidePreview')?.addEventListener('click', () => {
        document.getElementById('slidePreviewModal').style.display = 'none';
        document.getElementById('slidePreviewFrame').src = '';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const errorModal = document.getElementById('errorDetailsModal');
        const slideModal = document.getElementById('slidePreviewModal');
        if (e.target === errorModal) {
            errorModal.style.display = 'none';
        }
        if (e.target === slideModal) {
            slideModal.style.display = 'none';
            document.getElementById('slidePreviewFrame').src = '';
        }
    });
});

// Handle folder selection - expect structure: slide_01/input.html + output.html
async function handleFolderSelect(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
        alert('Không tìm thấy file nào!');
        return;
    }
    
    // Parse folder structure
    const slideFolders = {};
    files.forEach(file => {
        const pathParts = file.webkitRelativePath.split('/');
        if (pathParts.length >= 2) {
            const folderName = pathParts[pathParts.length - 2];
            const fileName = pathParts[pathParts.length - 1];
            
            if (fileName === 'input.html' || fileName === 'output.html') {
                if (!slideFolders[folderName]) {
                    slideFolders[folderName] = {};
                }
                slideFolders[folderName][fileName] = file;
            }
        }
    });
    
    // Find valid pairs
    slidePairs = [];
    for (const [folderName, files] of Object.entries(slideFolders)) {
        if (files['input.html'] && files['output.html']) {
            slidePairs.push({
                name: folderName,
                inputFile: files['input.html'],
                outputFile: files['output.html']
            });
        }
    }
    
    if (slidePairs.length === 0) {
        alert('Không tìm thấy cặp slide hợp lệ!\n\nCấu trúc yêu cầu:\nslide_01/\n  ├── input.html\n  └── output.html');
        return;
    }
    
    slidePairs.sort((a, b) => a.name.localeCompare(b.name));
    showFileInfo(slidePairs);
}

// Handle ZIP file selection
async function handleZipSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const zip = await JSZip.loadAsync(file);
        const slideFolders = {};
        
        for (const [filepath, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            
            const pathParts = filepath.split('/');
            if (pathParts.length >= 2) {
                const folderName = pathParts[pathParts.length - 2];
                const fileName = pathParts[pathParts.length - 1];
                
                if (fileName === 'input.html' || fileName === 'output.html') {
                    if (!slideFolders[folderName]) {
                        slideFolders[folderName] = {};
                    }
                    const content = await zipEntry.async('text');
                    slideFolders[folderName][fileName] = {
                        name: fileName,
                        content: content,
                        isZip: true
                    };
                }
            }
        }
        
        // Find valid pairs
        slidePairs = [];
        for (const [folderName, files] of Object.entries(slideFolders)) {
            if (files['input.html'] && files['output.html']) {
                slidePairs.push({
                    name: folderName,
                    inputFile: files['input.html'],
                    outputFile: files['output.html']
                });
            }
        }
        
        if (slidePairs.length === 0) {
            alert('Không tìm thấy cặp slide hợp lệ trong ZIP!');
            return;
        }
        
        slidePairs.sort((a, b) => a.name.localeCompare(b.name));
        showFileInfo(slidePairs);
    } catch (error) {
        alert('Lỗi khi đọc file ZIP: ' + error.message);
    }
}

// Show file information and structure preview
function showFileInfo(pairs) {
    const fileInfo = document.getElementById('fileInfo');
    const fileCount = document.getElementById('fileCount');
    const structurePreview = document.getElementById('structurePreview');
    
    fileCount.textContent = `✓ Đã tìm thấy ${pairs.length} cặp slide hợp lệ`;
    
    // Show structure preview
    let preview = '<div class="folder">📁 Slides</div>';
    pairs.slice(0, 10).forEach(pair => {
        preview += `<div class="folder">  📂 ${pair.name}</div>`;
        preview += `<div class="file">    📄 input.html</div>`;
        preview += `<div class="file">    📄 output.html</div>`;
    });
    if (pairs.length > 10) {
        preview += `<div class="folder">  ... và ${pairs.length - 10} folder khác</div>`;
    }
    structurePreview.innerHTML = preview;
    
    fileInfo.style.display = 'block';
}

// Analyze all slides
async function analyzeAllSlides() {
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    
    analysisResults = {
        total_slides: slidePairs.length,
        average_score: 0.0,
        slides: [],
        summary: {
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 0,
            critical: 0
        },
        all_errors: []
    };
    
    let totalScore = 0;
    
    for (let i = 0; i < slidePairs.length; i++) {
        const pair = slidePairs[i];
        console.log(`[${i+1}/${slidePairs.length}] Analyzing: ${pair.name}`);
        
        try {
            const result = await analyzeSlidePair(pair);
            analysisResults.slides.push(result);
            totalScore += result.score;
            
            // Classify quality
            if (result.score >= 9.0) {
                analysisResults.summary.excellent++;
            } else if (result.score >= 7.5) {
                analysisResults.summary.good++;
            } else if (result.score >= 5.0) {
                analysisResults.summary.fair++;
            } else if (result.score >= 2.5) {
                analysisResults.summary.poor++;
            } else {
                analysisResults.summary.critical++;
            }
            
            // Collect all errors
            result.details.overlap.forEach(err => {
                analysisResults.all_errors.push({
                    slide: pair.name,
                    type: 'Text Overlap',
                    ...err
                });
            });
            result.details.container_overflow.forEach(err => {
                analysisResults.all_errors.push({
                    slide: pair.name,
                    type: 'Container Overflow',
                    ...err
                });
            });
            result.details.viewport_overflow.forEach(err => {
                analysisResults.all_errors.push({
                    slide: pair.name,
                    type: 'Viewport Overflow',
                    ...err
                });
            });
        } catch (error) {
            console.error(`Error analyzing ${pair.name}:`, error);
            analysisResults.slides.push({
                name: pair.name,
                score: 0,
                total_errors: -1,
                error: error.message
            });
        }
    }
    
    // Calculate average
    const validScores = analysisResults.slides.filter(s => s.score > 0);
    analysisResults.average_score = validScores.length > 0 
        ? validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length 
        : 0;
    
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
        displayResults();
    }, 500);
}

// Analyze a single slide pair (implementing all-over.js logic)
async function analyzeSlidePair(pair) {
    const inputContent = await readFileContent(pair.inputFile);
    const outputContent = await readFileContent(pair.outputFile);
    
    // Parse input relationships
    const parentChildMap = await parseInputRelationships(inputContent);
    
    // Analyze output
    const errors = await analyzeOutputHTML(outputContent, parentChildMap);
    
    // Calculate score
    const score = calculateScore(errors);
    
    return {
        name: pair.name,
        score: score,
        total_errors: errors.overlap.length + errors.container_overflow.length + errors.viewport_overflow.length,
        overlap_errors: errors.overlap.length,
        container_overflow_errors: errors.container_overflow.length,
        viewport_overflow_errors: errors.viewport_overflow.length,
        details: errors
    };
}

// Read file content
function readFileContent(file) {
    if (file.isZip) {
        return Promise.resolve(file.content);
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Parse input HTML to get parent-child relationships
async function parseInputRelationships(htmlContent) {
    // Create hidden iframe to render HTML properly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '1920px';
    iframe.style.height = '1080px';
    document.body.appendChild(iframe);
    
    // Load HTML into iframe
    iframe.contentDocument.open();
    iframe.contentDocument.write(htmlContent);
    iframe.contentDocument.close();
    
    // Wait for iframe to load
    await new Promise(resolve => {
        if (iframe.contentDocument.readyState === 'complete') {
            resolve();
        } else {
            iframe.onload = resolve;
        }
    });
    
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
    const map = [];
    
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach(textEl => {
        const style = win.getComputedStyle(textEl);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (!textEl.textContent?.trim()) return;
        
        const divAncestors = [];
        let parent = textEl.parentElement;
        
        while (parent && parent.tagName.toLowerCase() !== 'body') {
            if (parent.tagName.toLowerCase() === 'div' && parent.className) {
                divAncestors.push(parent.className);
            }
            parent = parent.parentElement;
        }
        
        if (divAncestors.length === 0) return;
        
        map.push({
            textTag: textEl.tagName.toLowerCase(),
            textClass: textEl.className || '',
            textContent: textEl.textContent.trim().substring(0, 80),
            divAncestors: divAncestors
        });
    });
    
    // Remove iframe
    document.body.removeChild(iframe);
    
    return map;
}

// Analyze output HTML for errors
async function analyzeOutputHTML(htmlContent, parentChildMap) {
    // Create hidden iframe to render HTML properly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '1920px';
    iframe.style.height = '1080px';
    document.body.appendChild(iframe);
    
    // Load HTML into iframe
    iframe.contentDocument.open();
    iframe.contentDocument.write(htmlContent);
    iframe.contentDocument.close();
    
    // Wait for iframe to load
    await new Promise(resolve => {
        if (iframe.contentDocument.readyState === 'complete') {
            resolve();
        } else {
            iframe.onload = resolve;
        }
    });
    
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    
    // ✅ COPY TRỰC TIẾP TỪ all-over.js - Puppeteer evaluate()
    const VIEWPORT_WIDTH = 1920;
    const VIEWPORT_HEIGHT = 1080;
    const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
    
    const errors = {
        overlap: [],
        container_overflow: [],
        viewport_overflow: []
    };
    
    // ═══════════════════════════════════════════════════════
    // STEP 1: Parse all elements with early filtering
    // ═══════════════════════════════════════════════════════
    const elements = [];
    
    doc.querySelectorAll('.content-wrapper > *').forEach(el => {
        const style = win.getComputedStyle(el);
        
        // ✅ Early rejection: skip hidden/zero-size elements
        if (style.display === 'none' || style.visibility === 'hidden') return;
        
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const textContent = el.textContent?.trim() || '';
        const hasText = textContent.length > 0;
        
        // Parse box properties
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginRight = parseFloat(style.marginRight) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        const marginLeft = parseFloat(style.marginLeft) || 0;
        
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        
        const borderTopWidth = parseFloat(style.borderTopWidth) || 0;
        const borderRightWidth = parseFloat(style.borderRightWidth) || 0;
        const borderBottomWidth = parseFloat(style.borderBottomWidth) || 0;
        const borderLeftWidth = parseFloat(style.borderLeftWidth) || 0;
        
        // Calculate line-height
        const fontSize = parseFloat(style.fontSize) || 16;
        const lineHeightValue = style.lineHeight;
        let lineHeight;
        if (lineHeightValue === 'normal') {
            lineHeight = fontSize * 1.2;
        } else if (lineHeightValue.endsWith('px')) {
            lineHeight = parseFloat(lineHeightValue);
        } else if (!isNaN(parseFloat(lineHeightValue))) {
            lineHeight = parseFloat(lineHeightValue) * fontSize;
        } else {
            lineHeight = rect.height;
        }
        
        const lineHeightExtra = Math.max(0, lineHeight - rect.height);
        const lineHeightTop = lineHeightExtra / 2;
        
        // ✅ Lấy từ INLINE STYLE (giá trị CSS gốc) thay vì rect (đã transform)
        const inlineLeft = parseFloat(el.style.left) || 0;
        const inlineTop = parseFloat(el.style.top) || 0;
        const inlineWidth = parseFloat(el.style.width) || rect.width;
        const inlineHeight = parseFloat(el.style.height) || rect.height;
        
        // BOX F12 - sử dụng inline style values
        const boxLeft = inlineLeft;
        const boxTop = inlineTop;
        const boxWidth = inlineWidth;
        const boxHeight = inlineHeight;
        
        // ✅ CONTENT AREA (vùng xanh dương F12) = rect - padding - border
        const contentWidth = boxWidth - paddingLeft - paddingRight - borderLeftWidth - borderRightWidth;
        const contentHeight = boxHeight - paddingTop - paddingBottom - borderTopWidth - borderBottomWidth;
        const contentLeft = boxLeft + borderLeftWidth + paddingLeft;
        const contentTop = boxTop + borderTopWidth + paddingTop;
        const contentRight = contentLeft + contentWidth;
        const contentBottom = contentTop + contentHeight;
        
        // OUTER BOX - for overlap & viewport (dùng inline style + margin)
        const outerLeft = inlineLeft - marginLeft;
        const outerTop = inlineTop - marginTop - lineHeightTop;
        const outerWidth = inlineWidth + marginLeft + marginRight;
        const outerHeight = inlineHeight + marginTop + marginBottom;
        
        elements.push({
            tag: el.tagName.toLowerCase(),
            class: el.className || '',
            textContent: textContent.substring(0, 80),
            hasText: hasText,
            // BOX F12
            left: boxLeft,
            top: boxTop,
            width: boxWidth,
            height: boxHeight,
            right: boxLeft + boxWidth,
            bottom: boxTop + boxHeight,
            // CONTENT AREA (vùng xanh dương F12)
            contentLeft: contentLeft,
            contentTop: contentTop,
            contentWidth: contentWidth,
            contentHeight: contentHeight,
            contentRight: contentRight,
            contentBottom: contentBottom,
            // OUTER BOX
            outerLeft: outerLeft,
            outerTop: outerTop,
            outerWidth: outerWidth,
            outerHeight: outerHeight,
            outerRight: outerLeft + outerWidth,
            outerBottom: outerTop + outerHeight,
            zIndex: parseInt(style.zIndex) || 0,
            position: style.position,
            // Box model details
            margin: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
            padding: { top: paddingTop, right: paddingRight, bottom: paddingBottom, left: paddingLeft },
            border: { top: borderTopWidth, right: borderRightWidth, bottom: borderBottomWidth, left: borderLeftWidth }
        });
    });
    
    // ✅ Pre-filter text elements once
    const textElements = elements.filter(el => 
        textTags.includes(el.tag) && el.hasText
    );
    
    // ═══════════════════════════════════════════════════════
    // STEP 2: Check TEXT OVERLAP (optimized with quick rejection)
    // ═══════════════════════════════════════════════════════
    for (let i = 0; i < textElements.length; i++) {
        for (let j = i + 1; j < textElements.length; j++) {
            const el1 = textElements[i];
            const el2 = textElements[j];
            
            // ✅ Quick rejection test (most pairs don't overlap)
            if (el1.outerRight <= el2.outerLeft || el2.outerRight <= el1.outerLeft || 
                el1.outerBottom <= el2.outerTop || el2.outerBottom <= el1.outerTop) {
                continue;
            }
            
            // Calculate overlap
            const overlapLeft = Math.max(el1.outerLeft, el2.outerLeft);
            const overlapRight = Math.min(el1.outerRight, el2.outerRight);
            const overlapTop = Math.max(el1.outerTop, el2.outerTop);
            const overlapBottom = Math.min(el1.outerBottom, el2.outerBottom);
            
            const overlapWidth = overlapRight - overlapLeft;
            const overlapHeight = overlapBottom - overlapTop;
            const overlapArea = overlapWidth * overlapHeight;
            
            const area1 = el1.outerWidth * el1.outerHeight;
            const area2 = el2.outerWidth * el2.outerHeight;
            const smallerArea = Math.min(area1, area2);
            const overlapPercent = (overlapArea / smallerArea) * 100;
            
            if (overlapPercent >= 5) {
                errors.overlap.push({
                    overlap_percent: parseFloat(overlapPercent.toFixed(2)),
                    element1: {
                        tag: el1.tag,
                        class: el1.class,
                        content: el1.textContent
                    },
                    element2: {
                        tag: el2.tag,
                        class: el2.class,
                        content: el2.textContent
                    }
                });
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════
    // STEP 3: Check CONTAINER OVERFLOW
    // ═══════════════════════════════════════════════════════
    parentChildMap.forEach(relation => {
        const textEl = elements.find(el => 
            el.tag === relation.textTag &&
            el.class === relation.textClass &&
            el.textContent === relation.textContent &&
            el.hasText
        );
        
        if (!textEl) return;
        
        let parentEl = null;
        
        for (const ancestorClass of relation.divAncestors) {
            const parentCandidates = elements.filter(el =>
                el.tag === 'div' &&
                el.class === ancestorClass &&
                el.zIndex < textEl.zIndex
            );
            
            if (parentCandidates.length > 0) {
                parentEl = parentCandidates.reduce((closest, p) => {
                    const zDiff = textEl.zIndex - p.zIndex;
                    const closestZDiff = textEl.zIndex - closest.zIndex;
                    return zDiff < closestZDiff ? p : closest;
                });
                break;
            }
        }
        
        if (!parentEl) return;
        
        // ✅ Kiểm tra xem text có CHỒNG LÊN parent content area không
        const hasHorizontalOverlap = !(textEl.right <= parentEl.contentLeft || textEl.left >= parentEl.contentRight);
        const hasVerticalOverlap = !(textEl.bottom <= parentEl.contentTop || textEl.top >= parentEl.contentBottom);
        
        if (!hasHorizontalOverlap || !hasVerticalOverlap) {
            // ✅ Text HOÀN TOÀN Ở NGOÀI parent (100% overflow)
            errors.container_overflow.push({
                overflow_percent: 100,
                text: {
                    tag: textEl.tag,
                    class: textEl.class,
                    content: textEl.textContent
                },
                parent: {
                    tag: parentEl.tag,
                    class: parentEl.class
                }
            });
            return;
        }
        
        // ✅ So sánh text BOX F12 với parent CONTENT AREA (vùng xanh dương)
        const overflowLeft = textEl.left < parentEl.contentLeft ? parentEl.contentLeft - textEl.left : 0;
        const overflowRight = textEl.right > parentEl.contentRight ? textEl.right - parentEl.contentRight : 0;
        const overflowTop = textEl.top < parentEl.contentTop ? parentEl.contentTop - textEl.top : 0;
        const overflowBottom = textEl.bottom > parentEl.contentBottom ? textEl.bottom - parentEl.contentBottom : 0;
        
        const overflowLeftPct = (overflowLeft / parentEl.contentWidth) * 100;
        const overflowRightPct = (overflowRight / parentEl.contentWidth) * 100;
        const overflowTopPct = (overflowTop / parentEl.contentHeight) * 100;
        const overflowBottomPct = (overflowBottom / parentEl.contentHeight) * 100;
        
        const hasOverflow = overflowLeft > 1 || overflowRight > 1 || 
                           overflowTop > 1 || overflowBottom > 1;
        
        if (hasOverflow) {
            const maxPercent = Math.max(overflowLeftPct, overflowRightPct, 
                                         overflowTopPct, overflowBottomPct);
            errors.container_overflow.push({
                overflow_percent: parseFloat(maxPercent.toFixed(2)),
                text: {
                    tag: textEl.tag,
                    class: textEl.class,
                    content: textEl.textContent
                },
                parent: {
                    tag: parentEl.tag,
                    class: parentEl.class
                }
            });
        }
    });
    
    // ═══════════════════════════════════════════════════════
    // STEP 4: Check VIEWPORT OVERFLOW
    // ═══════════════════════════════════════════════════════
    textElements.forEach(el => {
        const overflowLeft = Math.max(0, -el.outerLeft);
        const overflowTop = Math.max(0, -el.outerTop);
        const overflowRight = Math.max(0, el.outerRight - VIEWPORT_WIDTH);
        const overflowBottom = Math.max(0, el.outerBottom - VIEWPORT_HEIGHT);
        
        const hasOverflow = overflowLeft > 0 || overflowTop > 0 || 
                           overflowRight > 0 || overflowBottom > 0;
        
        if (hasOverflow) {
            const overflowLeftPct = (overflowLeft / VIEWPORT_WIDTH) * 100;
            const overflowTopPct = (overflowTop / VIEWPORT_HEIGHT) * 100;
            const overflowRightPct = (overflowRight / VIEWPORT_WIDTH) * 100;
            const overflowBottomPct = (overflowBottom / VIEWPORT_HEIGHT) * 100;
            
            const maxPercent = Math.max(overflowLeftPct, overflowTopPct, 
                                         overflowRightPct, overflowBottomPct);
            
            errors.viewport_overflow.push({
                overflow_percent: parseFloat(maxPercent.toFixed(2)),
                text: {
                    tag: el.tag,
                    class: el.class,
                    content: el.textContent
                }
            });
        }
    });
    
    // Remove iframe
    document.body.removeChild(iframe);
    
    return errors;
}

// Calculate score based on errors (matching batch_score_calculator.py logic)
function calculateScore(errors) {
    const totalErrors = errors.overlap.length + errors.container_overflow.length + errors.viewport_overflow.length;
    
    if (totalErrors === 0) {
        return 10.0;
    }
    
    // Penalty calculation
    let totalPenalty = 0;
    
    // Overlap penalties
    errors.overlap.forEach(err => {
        const pct = err.overlap_percent;
        if (pct >= 50) totalPenalty += 2.0;
        else if (pct >= 25) totalPenalty += 1.0;
        else if (pct >= 10) totalPenalty += 0.5;
        else totalPenalty += 0.2;
    });
    
    // Container overflow penalties
    errors.container_overflow.forEach(err => {
        const pct = err.overflow_percent;
        if (pct >= 50) totalPenalty += 1.5;
        else if (pct >= 25) totalPenalty += 0.8;
        else if (pct >= 10) totalPenalty += 0.4;
        else totalPenalty += 0.15;
    });
    
    // Viewport overflow penalties
    errors.viewport_overflow.forEach(err => {
        const pct = err.overflow_percent;
        if (pct >= 50) totalPenalty += 1.5;
        else if (pct >= 25) totalPenalty += 0.8;
        else if (pct >= 10) totalPenalty += 0.4;
        else totalPenalty += 0.15;
    });
    
    const score = Math.max(0, 10.0 - totalPenalty);
    return parseFloat(score.toFixed(2));
}

// Display results
function displayResults() {
    document.getElementById('resultsSection').style.display = 'block';
    
    // Update summary cards
    document.getElementById('averageScore').textContent = analysisResults.average_score.toFixed(2);
    document.getElementById('totalSlides').textContent = analysisResults.total_slides;
    
    const totalOverlap = analysisResults.slides.reduce((sum, s) => sum + (s.overlap_errors || 0), 0);
    const totalContainer = analysisResults.slides.reduce((sum, s) => sum + (s.container_overflow_errors || 0), 0);
    const totalViewport = analysisResults.slides.reduce((sum, s) => sum + (s.viewport_overflow_errors || 0), 0);
    
    document.getElementById('totalErrors').textContent = totalOverlap;
    document.getElementById('containerOverflows').textContent = totalContainer;
    document.getElementById('viewportOverflows').textContent = totalViewport;
    
    // Create charts
    createCharts();
    
    // Display errors table
    displayErrorsTable();
}

// Create charts
function createCharts() {
    const totalOverlap = analysisResults.slides.reduce((sum, s) => sum + (s.overlap_errors || 0), 0);
    const totalContainer = analysisResults.slides.reduce((sum, s) => sum + (s.container_overflow_errors || 0), 0);
    const totalViewport = analysisResults.slides.reduce((sum, s) => sum + (s.viewport_overflow_errors || 0), 0);
    
    const ctxErrorType = document.getElementById('errorTypeChart').getContext('2d');
    const errorChart = new Chart(ctxErrorType, {
        type: 'bar',
        data: {
            labels: ['Text Overlap', 'Container Overflow', 'Viewport Overflow'],
            datasets: [{
                label: 'Số lượng lỗi',
                data: [totalOverlap, totalContainer, totalViewport],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(59, 130, 246, 0.8)'
                ],
                borderColor: [
                    'rgba(239, 68, 68, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(59, 130, 246, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            return 'Click để xem chi tiết';
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                } 
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const errorTypes = ['Text Overlap', 'Container Overflow', 'Viewport Overflow'];
                    showErrorDetails(errorTypes[index]);
                }
            }
        }
    });
}

// Show error details modal
function showErrorDetails(errorType) {
    const modal = document.getElementById('errorDetailsModal');
    const modalTitle = document.getElementById('modalTitle');
    const slideList = document.getElementById('errorSlideList');
    
    // Filter errors by type
    const filteredErrors = analysisResults.all_errors.filter(e => e.type === errorType);
    
    // Group by slide
    const errorsBySlide = {};
    filteredErrors.forEach(error => {
        if (!errorsBySlide[error.slide]) {
            errorsBySlide[error.slide] = [];
        }
        errorsBySlide[error.slide].push(error);
    });
    
    modalTitle.textContent = `${errorType} (${filteredErrors.length} lỗi - ${Object.keys(errorsBySlide).length} slides)`;
    
    // Create slide list
    let html = '';
    for (const [slideName, errors] of Object.entries(errorsBySlide)) {
        html += `
            <div class="slide-item" data-slide="${slideName}">
                <div class="slide-item-header">
                    <h4>📄 ${slideName}</h4>
                    <span class="error-count">${errors.length} lỗi</span>
                </div>
                <div class="slide-item-errors">
                    ${errors.map(e => {
                        if (e.type === 'Text Overlap') {
                            return `<div class="error-item">
                                <span class="error-percent">${e.overlap_percent}%</span>
                                <span class="error-detail">${e.element1.tag} ↔ ${e.element2.tag}</span>
                            </div>`;
                        } else {
                            return `<div class="error-item">
                                <span class="error-percent">${e.overflow_percent}%</span>
                                <span class="error-detail">${e.text.tag} overflow</span>
                            </div>`;
                        }
                    }).join('')}
                </div>
                <button class="btn btn-primary btn-small view-slide-btn" onclick="viewSlide('${slideName}')">👁️ Xem Slide</button>
            </div>
        `;
    }
    
    slideList.innerHTML = html;
    modal.style.display = 'flex';
}

// View slide in preview modal
function viewSlide(slideName) {
    const pair = slidePairs.find(p => p.name === slideName);
    if (!pair) return;
    
    const modal = document.getElementById('slidePreviewModal');
    const title = document.getElementById('slidePreviewTitle');
    const iframe = document.getElementById('slidePreviewFrame');
    
    title.textContent = `📄 ${slideName}`;
    
    // Load output HTML into iframe
    readFileContent(pair.outputFile).then(content => {
        const blob = new Blob([content], { type: 'text/html' });
        iframe.src = URL.createObjectURL(blob);
        modal.style.display = 'flex';
    });
}

// Make viewSlide available globally
window.viewSlide = viewSlide;

// Display errors table
function displayErrorsTable(filteredErrors = null) {
    const errors = filteredErrors || analysisResults.all_errors;
    const tbody = document.getElementById('errorsTableBody');
    tbody.innerHTML = '';
    
    errors.forEach(error => {
        const row = document.createElement('tr');
        
        if (error.type === 'Text Overlap') {
            row.innerHTML = `
                <td>${error.slide}</td>
                <td><span class="badge badge-error">${error.overlap_percent}%</span></td>
                <td>${error.type}</td>
                <td>${error.overlap_percent}%</td>
                <td>${error.element1.tag}.${error.element1.class || '(no class)'}</td>
                <td>${error.element2.tag}.${error.element2.class || '(no class)'}</td>
                <td>${error.element1.content.substring(0, 30)}... ↔ ${error.element2.content.substring(0, 30)}...</td>
            `;
        } else if (error.type === 'Container Overflow') {
            row.innerHTML = `
                <td>${error.slide}</td>
                <td><span class="badge badge-warning">${error.overflow_percent}%</span></td>
                <td>${error.type}</td>
                <td>${error.overflow_percent}%</td>
                <td>${error.text.tag}.${error.text.class || '(no class)'}</td>
                <td>${error.parent.tag}.${error.parent.class || '(no class)'}</td>
                <td>${error.text.content.substring(0, 50)}...</td>
            `;
        } else {
            row.innerHTML = `
                <td>${error.slide}</td>
                <td><span class="badge badge-info">${error.overflow_percent}%</span></td>
                <td>${error.type}</td>
                <td>${error.overflow_percent}%</td>
                <td>${error.text.tag}.${error.text.class || '(no class)'}</td>
                <td>Viewport</td>
                <td>${error.text.content.substring(0, 50)}...</td>
            `;
        }
        
        tbody.appendChild(row);
    });
}

// Filter errors
function filterErrors() {
    const severity = document.getElementById('filterSeverity').value;
    const search = document.getElementById('searchError').value.toLowerCase();
    
    let filtered = analysisResults.all_errors;
    
    if (severity !== 'all') {
        filtered = filtered.filter(e => e.type.toLowerCase().includes(severity));
    }
    
    if (search) {
        filtered = filtered.filter(e =>
            e.slide.toLowerCase().includes(search) ||
            e.type.toLowerCase().includes(search) ||
            (e.element1 && e.element1.content.toLowerCase().includes(search)) ||
            (e.element2 && e.element2.content.toLowerCase().includes(search)) ||
            (e.text && e.text.content.toLowerCase().includes(search))
        );
    }
    
    displayErrorsTable(filtered);
}

// Reset analysis
function resetAnalysis() {
    slidePairs = [];
    analysisResults = { total_slides: 0, average_score: 0.0, slides: [], summary: {}, all_errors: [] };
    
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('folderInput').value = '';
    document.getElementById('zipInput').value = '';
}

// Download report
function downloadReport() {
    const blob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide-analysis-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Export to CSV
function exportToCSV() {
    let csv = 'Slide,Điểm,Loại lỗi,Overlap %,Element 1,Element 2,Chi tiết\n';
    
    analysisResults.all_errors.forEach(error => {
        const slide = error.slide;
        const type = error.type;
        const pct = error.overlap_percent || error.overflow_percent || 0;
        
        let el1, el2, detail;
        if (error.element1) {
            el1 = `${error.element1.tag}.${error.element1.class || ''}`;
            el2 = `${error.element2.tag}.${error.element2.class || ''}`;
            detail = `${error.element1.content} ↔ ${error.element2.content}`;
        } else {
            el1 = `${error.text.tag}.${error.text.class || ''}`;
            el2 = error.parent ? `${error.parent.tag}.${error.parent.class || ''}` : 'Viewport';
            detail = error.text.content;
        }
        
        csv += `"${slide}","${pct}","${type}","${pct}%","${el1}","${el2}","${detail}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `errors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

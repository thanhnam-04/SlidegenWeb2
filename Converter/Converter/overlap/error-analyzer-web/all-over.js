const puppeteer = require('puppeteer');
const path = require('path');

async function runAllDetectors(inputFilePath, outputFilePath) {
    console.log('[ALL DETECTORS] ⚡ Running OPTIMIZED quality checks...\n');
    
    const startTime = Date.now();
    
    // ✅ OPTIMIZATION 1: Launch with performance flags
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-extensions'
        ]
    });
    
    try {
        // ✅ OPTIMIZATION 2: Parallel page loading with resource blocking
        console.log('📋 [1/3] Loading pages in parallel...');
        
        const [inputPage, outputPage] = await Promise.all([
            browser.newPage(),
            browser.newPage()
        ]);
        
        // Block unnecessary resources
        await Promise.all([
            inputPage.setRequestInterception(true),
            outputPage.setRequestInterception(true)
        ]);
        
        const blockResources = (request) => {
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        };
        
        inputPage.on('request', blockResources);
        outputPage.on('request', blockResources);
        
        // Load both pages in parallel with faster wait strategy
        await Promise.all([
            inputPage.goto(`file://${path.resolve(inputFilePath)}`, { 
                waitUntil: 'domcontentloaded',
                timeout: 10000 
            }),
            outputPage.goto(`file://${path.resolve(outputFilePath)}`, { 
                waitUntil: 'domcontentloaded',
                timeout: 10000 
            })
        ]);
        
        console.log('   ✅ Pages loaded\n');
        
        // ✅ OPTIMIZATION 3: Quick INPUT parsing with early filtering
        console.log('📋 [2/3] Parsing INPUT relationships (optimized)...');
        
        const parentChildMap = await inputPage.evaluate(() => {
            const map = [];
            const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
            
            // Early filtering in selector
            const textElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p'))
                .filter(el => {
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return false;
                    if (!el.textContent?.trim()) return false;
                    return true;
                });
            
            textElements.forEach(textEl => {
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
            
            return map;
        });
        
        await inputPage.close();
        console.log(`   ✅ Found ${parentChildMap.length} relationships\n`);
        
        // ✅ OPTIMIZATION 4: Single evaluate() with ALL checks inside
        console.log('📋 [3/3] Running ALL checks in single pass (optimized)...');
        
        const results = await outputPage.evaluate((parentChildMap) => {
            const VIEWPORT_WIDTH = 1920;
            const VIEWPORT_HEIGHT = 1080;
            const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
            
            const results = {
                overlap: { errors: [], count: 0 },
                container_overflow: { errors: [], count: 0 },
                viewport_overflow: { errors: [], count: 0 }
            };
            
            // ═══════════════════════════════════════════════════════
            // STEP 1: Parse all elements with early filtering
            // ═══════════════════════════════════════════════════════
            const elements = [];
            
            Array.from(document.querySelectorAll('.content-wrapper > *')).forEach(el => {
                const style = window.getComputedStyle(el);
                
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
                        results.overlap.errors.push({
                            overlap_percent: parseFloat(overlapPercent.toFixed(2)),
                            element1: {
                                tag: el1.tag,
                                class: el1.class,
                                content: el1.textContent,
                                box_f12: `[${el1.left.toFixed(0)}-${el1.right.toFixed(0)}, ${el1.top.toFixed(0)}-${el1.bottom.toFixed(0)}]`,
                                size: `${el1.width.toFixed(0)}×${el1.height.toFixed(0)}px`,
                                z_index: el1.zIndex,
                                box_model: `margin(${el1.margin.top}/${el1.margin.right}/${el1.margin.bottom}/${el1.margin.left}) padding(${el1.padding.top}/${el1.padding.right}/${el1.padding.bottom}/${el1.padding.left}) border(${el1.border.top}/${el1.border.right}/${el1.border.bottom}/${el1.border.left})`
                            },
                            element2: {
                                tag: el2.tag,
                                class: el2.class,
                                content: el2.textContent,
                                box_f12: `[${el2.left.toFixed(0)}-${el2.right.toFixed(0)}, ${el2.top.toFixed(0)}-${el2.bottom.toFixed(0)}]`,
                                size: `${el2.width.toFixed(0)}×${el2.height.toFixed(0)}px`,
                                z_index: el2.zIndex,
                                box_model: `margin(${el2.margin.top}/${el2.margin.right}/${el2.margin.bottom}/${el2.margin.left}) padding(${el2.padding.top}/${el2.padding.right}/${el2.padding.bottom}/${el2.padding.left}) border(${el2.border.top}/${el2.border.right}/${el2.border.bottom}/${el2.border.left})`
                            },
                            overlap_area: {
                                left: overlapLeft.toFixed(0),
                                top: overlapTop.toFixed(0),
                                width: overlapWidth.toFixed(0),
                                height: overlapHeight.toFixed(0),
                                area: overlapArea.toFixed(0)
                            }
                        });
                    }
                }
            }
            results.overlap.count = results.overlap.errors.length;
            
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
                    results.container_overflow.errors.push({
                        overflow_percent: 100,
                        text: {
                            tag: textEl.tag,
                            class: textEl.class,
                            content: textEl.textContent,
                            box_f12: `[${textEl.left.toFixed(0)}-${textEl.right.toFixed(0)}, ${textEl.top.toFixed(0)}-${textEl.bottom.toFixed(0)}]`,
                            size: `${textEl.width.toFixed(0)}×${textEl.height.toFixed(0)}px`,
                            z_index: textEl.zIndex,
                            box_model: `margin(${textEl.margin.top}/${textEl.margin.right}/${textEl.margin.bottom}/${textEl.margin.left}) padding(${textEl.padding.top}/${textEl.padding.right}/${textEl.padding.bottom}/${textEl.padding.left}) border(${textEl.border.top}/${textEl.border.right}/${textEl.border.bottom}/${textEl.border.left})`
                        },
                        parent: {
                            tag: parentEl.tag,
                            class: parentEl.class,
                            box_f12: `[${parentEl.left.toFixed(0)}-${parentEl.right.toFixed(0)}, ${parentEl.top.toFixed(0)}-${parentEl.bottom.toFixed(0)}]`,
                            size: `${parentEl.width.toFixed(0)}×${parentEl.height.toFixed(0)}px`,
                            content_area: `[${parentEl.contentLeft.toFixed(0)}-${parentEl.contentRight.toFixed(0)}, ${parentEl.contentTop.toFixed(0)}-${parentEl.contentBottom.toFixed(0)}]`,
                            content_size: `${parentEl.contentWidth.toFixed(0)}×${parentEl.contentHeight.toFixed(0)}px`,
                            z_index: parentEl.zIndex,
                            box_model: `margin(${parentEl.margin.top}/${parentEl.margin.right}/${parentEl.margin.bottom}/${parentEl.margin.left}) padding(${parentEl.padding.top}/${parentEl.padding.right}/${parentEl.padding.bottom}/${parentEl.padding.left}) border(${parentEl.border.top}/${parentEl.border.right}/${parentEl.border.bottom}/${parentEl.border.left})`
                        },
                        overflow: {
                            status: "COMPLETELY_OUTSIDE",
                            horizontal_overlap: hasHorizontalOverlap,
                            vertical_overlap: hasVerticalOverlap,
                            message: hasHorizontalOverlap ? "Text is completely outside parent vertically" : "Text is completely outside parent horizontally"
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
                    results.container_overflow.errors.push({
                        overflow_percent: parseFloat(maxPercent.toFixed(2)),
                        text: {
                            tag: textEl.tag,
                            class: textEl.class,
                            content: textEl.textContent,
                            box_f12: `[${textEl.left.toFixed(0)}-${textEl.right.toFixed(0)}, ${textEl.top.toFixed(0)}-${textEl.bottom.toFixed(0)}]`,
                            size: `${textEl.width.toFixed(0)}×${textEl.height.toFixed(0)}px`,
                            z_index: textEl.zIndex,
                            box_model: `margin(${textEl.margin.top}/${textEl.margin.right}/${textEl.margin.bottom}/${textEl.margin.left}) padding(${textEl.padding.top}/${textEl.padding.right}/${textEl.padding.bottom}/${textEl.padding.left}) border(${textEl.border.top}/${textEl.border.right}/${textEl.border.bottom}/${textEl.border.left})`
                        },
                        parent: {
                            tag: parentEl.tag,
                            class: parentEl.class,
                            box_f12: `[${parentEl.left.toFixed(0)}-${parentEl.right.toFixed(0)}, ${parentEl.top.toFixed(0)}-${parentEl.bottom.toFixed(0)}]`,
                            size: `${parentEl.width.toFixed(0)}×${parentEl.height.toFixed(0)}px`,
                            content_area: `[${parentEl.contentLeft.toFixed(0)}-${parentEl.contentRight.toFixed(0)}, ${parentEl.contentTop.toFixed(0)}-${parentEl.contentBottom.toFixed(0)}]`,
                            content_size: `${parentEl.contentWidth.toFixed(0)}×${parentEl.contentHeight.toFixed(0)}px`,
                            z_index: parentEl.zIndex,
                            box_model: `margin(${parentEl.margin.top}/${parentEl.margin.right}/${parentEl.margin.bottom}/${parentEl.margin.left}) padding(${parentEl.padding.top}/${parentEl.padding.right}/${parentEl.padding.bottom}/${parentEl.padding.left}) border(${parentEl.border.top}/${parentEl.border.right}/${parentEl.border.bottom}/${parentEl.border.left})`
                        },
                        overflow: {
                            left: `${overflowLeft.toFixed(1)}px (${overflowLeftPct.toFixed(1)}%)`,
                            right: `${overflowRight.toFixed(1)}px (${overflowRightPct.toFixed(1)}%)`,
                            top: `${overflowTop.toFixed(1)}px (${overflowTopPct.toFixed(1)}%)`,
                            bottom: `${overflowBottom.toFixed(1)}px (${overflowBottomPct.toFixed(1)}%)`,
                            directions: [
                                overflowLeft > 1 ? 'LEFT' : null,
                                overflowRight > 1 ? 'RIGHT' : null,
                                overflowTop > 1 ? 'TOP' : null,
                                overflowBottom > 1 ? 'BOTTOM' : null
                            ].filter(d => d)
                        }
                    });
                }
            });
            results.container_overflow.count = results.container_overflow.errors.length;
            
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
                    
                    results.viewport_overflow.errors.push({
                        overflow_percent: parseFloat(maxPercent.toFixed(2)),
                        text: {
                            tag: el.tag,
                            class: el.class,
                            content: el.textContent,
                            box_f12: `[${el.left.toFixed(0)}-${el.right.toFixed(0)}, ${el.top.toFixed(0)}-${el.bottom.toFixed(0)}]`,
                            size: `${el.width.toFixed(0)}×${el.height.toFixed(0)}px`,
                            z_index: el.zIndex,
                            box_model: `margin(${el.margin.top}/${el.margin.right}/${el.margin.bottom}/${el.margin.left}) padding(${el.padding.top}/${el.padding.right}/${el.padding.bottom}/${el.padding.left}) border(${el.border.top}/${el.border.right}/${el.border.bottom}/${el.border.left})`
                        },
                        viewport: {
                            width: VIEWPORT_WIDTH,
                            height: VIEWPORT_HEIGHT
                        },
                        overflow: {
                            left: `${overflowLeft.toFixed(1)}px (${overflowLeftPct.toFixed(1)}%)`,
                            top: `${overflowTop.toFixed(1)}px (${overflowTopPct.toFixed(1)}%)`,
                            right: `${overflowRight.toFixed(1)}px (${overflowRightPct.toFixed(1)}%)`,
                            bottom: `${overflowBottom.toFixed(1)}px (${overflowBottomPct.toFixed(1)}%)`,
                            directions: [
                                overflowLeft > 0 ? 'LEFT' : null,
                                overflowTop > 0 ? 'TOP' : null,
                                overflowRight > 0 ? 'RIGHT' : null,
                                overflowBottom > 0 ? 'BOTTOM' : null
                            ].filter(d => d)
                        }
                    });
                }
            });
            results.viewport_overflow.count = results.viewport_overflow.errors.length;
            
            return {
                ...results,
                elementCount: elements.length,
                textElementCount: textElements.length
            };
            
        }, parentChildMap);
        
        await outputPage.close();
        
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`   ✅ Processed ${results.elementCount} elements (${results.textElementCount} text) in ${elapsedTime}s\n`);
        
        console.log('═══════════════════════════════════════════════════════');
        console.log(`⚡ OPTIMIZED RESULTS (${elapsedTime}s total)`);
        console.log('═══════════════════════════════════════════════════════\n');
        console.log(`   ${results.overlap.count > 0 ? '⚠️' : '✅'} Text overlaps: ${results.overlap.count}`);
        console.log(`   ${results.container_overflow.count > 0 ? '⚠️' : '✅'} Container overflows: ${results.container_overflow.count}`);
        console.log(`   ${results.viewport_overflow.count > 0 ? '⚠️' : '✅'} Viewport overflows: ${results.viewport_overflow.count}\n`);
        
        console.log(JSON.stringify({
            overlap: results.overlap,
            container_overflow: results.container_overflow,
            viewport_overflow: results.viewport_overflow
        }, null, 2));
        
        return {
            overlap: results.overlap,
            container_overflow: results.container_overflow,
            viewport_overflow: results.viewport_overflow
        };
        
    } catch (error) {
        console.error('[ERROR] ❌', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

if (process.argv.length < 4) {
    console.error('❌ Usage: node all-over-optimized.js <input.html> <output.html>');
    process.exit(1);
}

runAllDetectors(process.argv[2], process.argv[3]);

module.exports = { runAllDetectors };

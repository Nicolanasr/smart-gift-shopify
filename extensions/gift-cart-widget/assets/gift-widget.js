// Gift Widget v70 - Printed Photo Image
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.gift-widget-container');
    if (!container) {
        console.warn("Gift Widget: Container not found.");
        return;
    }

    // Scoped Selectors
    const toggleInput = container.querySelector('#gift-toggle-input');
    const priceDisplay = container.querySelector('#gift-price-display');
    const totalDisplay = container.querySelector('#gift-total-display');
    const tabs = container.querySelectorAll('.gift-tab');
    // FIX: Exclude printed buttons to prevent logic collision
    const formatBtns = container.querySelectorAll('.format-btn:not(.printed-format-btn)');
    const messageInput = container.querySelector('#gift-message-text');
    const optionsContent = container.querySelector('#gift-options-content');
    const toggleLabelText = container.querySelector('.gift-title');

    // Read configuration
    const config = window.GiftWidgetConfig;
    if (!config) {
        console.error("Gift Widget Error: Global config not found. You MUST enable 'Smart Gift' App Embed in Theme Editor for prices to show.");
        return;
    }

    const rawProductPrice = parseInt(container.dataset.productPrice, 10) || 0;
    const productTitle = container.dataset.productTitle || 'Gift';
    const shopDomain = container.dataset.shop || '';

    // --- Initial Setup & Customization ---

    // 1. Text Customization (Robust)
    if (config.labels) {
        const labels = config.labels;

        // Toggle Label
        if (toggleLabelText && labels.toggleText) {
            const priceSpan = toggleLabelText.querySelector('#gift-price-display');
            // Clear all child nodes except the price span
            const nodes = Array.from(toggleLabelText.childNodes);
            nodes.forEach(node => {
                if (node !== priceSpan) {
                    toggleLabelText.removeChild(node);
                }
            });
            // Prepend new text
            toggleLabelText.prepend(document.createTextNode(labels.toggleText + " ("));
            toggleLabelText.appendChild(priceSpan);
            toggleLabelText.appendChild(document.createTextNode(")"));
        }

        // Total Label
        const totalRow = container.querySelector('.gift-total-row');
        if (totalRow && labels.totalLabel) {
            const totalSpan = totalRow.querySelector('#gift-total-display');
            // Rebuild content: Label + Span
            totalRow.innerHTML = '';
            totalRow.appendChild(document.createTextNode(labels.totalLabel + " "));
            totalRow.appendChild(totalSpan);
        }

        // Tabs
        const updateTabText = (tabSelector, newText) => {
            const tab = container.querySelector(tabSelector);
            if (tab && newText) {
                // Find the existing icon span
                const icon = tab.querySelector('.tab-icon');
                tab.innerHTML = ''; // Clear
                if (icon) tab.appendChild(icon); // Put icon back
                tab.appendChild(document.createTextNode(" " + newText));
            }
        };
        updateTabText('[data-tab="digital"]', labels.digitalTab);
        updateTabText('[data-tab="printed"]', labels.printedTab);

        // Record Button
        const recordBtn = container.querySelector('#record-video-btn');
        if (recordBtn && labels.recordVideo) {
            const icon = recordBtn.querySelector('.record-icon');
            recordBtn.innerHTML = '';
            if (icon) recordBtn.appendChild(icon);
            recordBtn.appendChild(document.createTextNode(" " + labels.recordVideo));
        }

        // Format Label
        const formatLabel = container.querySelector('.gift-format-label');
        if (formatLabel && labels.chooseFormat) formatLabel.textContent = labels.chooseFormat;

        // Placeholder
        if (messageInput && labels.messagePlaceholder) {
            messageInput.placeholder = labels.messagePlaceholder;
        }
    }

    // 2. Visibility Logic (Tabs & Formats)
    let initialType = 'digital';

    // Format Buttons Visibility
    if (config.visibility && config.visibility.formats) {
        formatBtns.forEach(btn => {
            const fmt = btn.dataset.format;
            if (config.visibility.formats[fmt] === false) {
                btn.style.display = 'none';
            }
        });
    }

    // Tab Logic
    if (config.visibility && !config.visibility.digital && config.visibility.printed) {
        initialType = 'printed';
    } else if (config.visibility && !config.visibility.digital && !config.visibility.printed) {
        initialType = null;
    }

    // State

    // Printed Format Logic
    const printedFormatBtns = container.querySelectorAll('.printed-format-btn');
    let printedFormat = 'text_msg';

    let state = {
        enabled: false,
        type: initialType,
        format: 'video',
        printedFormat: 'text_msg',
        message: '',
        addMessage: true,
        // Use simple gift wrap variant when both formats disabled, otherwise use active type
        currentVariantId: initialType ? config[initialType].variantId :
            (config.simple && config.simple.variantId ? config.simple.variantId :
                (config.digital ? config.digital.variantId :
                    (config.printed ? config.printed.variantId : null)))
    };

    // --- Optional Message Checkbox (Global) ---
    const msgCheckbox = container.querySelector('#gift-add-message-checkbox');
    const tabsContainer = container.querySelector('#gift-tabs-container');

    function toggleMessageVisibility(show) {
        // Toggle Tabs
        if (tabsContainer) tabsContainer.style.display = show ? 'flex' : 'none';

        // Toggle active main content
        container.querySelectorAll('.tab-content').forEach(c => {
            // Only show if it matches current type AND show is true
            if (show && c.id === `tab-content-${state.type}`) {
                c.style.display = 'block';
            } else {
                c.style.display = 'none';
            }
        });

        // If showing, ensure the logic flow restores internal state
        if (show) {
            if (state.type === 'digital') {
                // Re-trigger selectFormat for current format to ensure internal div is visible
                const currentBtn = container.querySelector(`.format-btn[data-format="${state.format}"]`);
                if (currentBtn) selectFormat(currentBtn);
            } else {
                // Printed: Re-trigger click on active printed button
                const currentPBtn = container.querySelector(`.printed-format-btn[data-format="${state.printedFormat}"]`);
                if (currentPBtn) currentPBtn.click();
            }
        }
    }

    if (msgCheckbox) {
        msgCheckbox.addEventListener('change', (e) => {
            state.addMessage = e.target.checked;
            toggleMessageVisibility(state.addMessage);

            const hasDigital = config.visibility && config.visibility.digital === true;
            const hasPrinted = config.visibility && config.visibility.printed === true;
            const hasAnyFormat = hasDigital || hasPrinted;

            // Update variant ID based on message checkbox
            if (!state.addMessage && config.simple && config.simple.variantId) {
                // Message unchecked - use simple variant
                state.currentVariantId = config.simple.variantId;
                console.log('Gift Widget: Message unchecked, switching to simple variant:', state.currentVariantId);
            } else if (state.type && config[state.type] && config[state.type].variantId) {
                // Message checked - use selected tab variant
                state.currentVariantId = config[state.type].variantId;
                console.log('Gift Widget: Message checked, switching to', state.type, 'variant:', state.currentVariantId);
            }

            // Update price display based on message checkbox
            if (priceDisplay) {
                if (!state.addMessage && config.simple && config.simple.priceText) {
                    priceDisplay.textContent = config.simple.priceText;
                } else if (!hasAnyFormat && config.simple && config.simple.priceText) {
                    priceDisplay.textContent = config.simple.priceText;
                } else if (state.type && config[state.type]) {
                    priceDisplay.textContent = config[state.type].priceText;
                }
            }
            updateTotal();
        });
    }

    // --- Event Listeners needed for new printed buttons ---
    printedFormatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI toggle
            printedFormatBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.printedFormat = btn.dataset.format;

            // Toggle Containers
            const msgContainer = container.querySelector('#printed-message-container');
            const photoContainer = container.querySelector('#printed-photo-container');

            if (state.printedFormat === 'printed_photo') {
                if (msgContainer) msgContainer.style.display = 'none';
                if (photoContainer) photoContainer.style.display = 'block';
            } else {
                if (msgContainer) msgContainer.style.display = 'block';
                if (photoContainer) photoContainer.style.display = 'none';
            }
        });
    });

    // 3. Tab Visibility & Initial Selection
    tabs.forEach(tab => {
        const type = tab.dataset.tab;
        const isVisible = config.visibility ? config.visibility[type] : true;

        if (!isVisible) {
            tab.style.display = 'none';
        }

        if (type === state.type) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // 4. Initial content pane and tab validation
    if (tabs.length === 0) {
        // No tabs visible, just clear state.type (widget remains visible for toggle)
        state.type = null;
    } else {
        // Validate state.type relative to tabs
        const currentTabValid = Array.from(tabs).some(t => t.dataset.tab === state.type);
        if (!state.type || !currentTabValid) {
            state.type = tabs[0].dataset.tab;
        }

        // Show content for valid type
        const activeContent = container.querySelector(`#tab-content-${state.type}`);
        if (activeContent) {
            activeContent.style.display = 'block';
            setTimeout(() => activeContent.classList.add('active'), 10);

            // Force selectFormat for default active
            const activeFormatBtn = activeContent.querySelector('.format-btn.active');
            if (activeFormatBtn) selectFormat(activeFormatBtn);
        }
        // Ensure tab active state
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === state.type));
    }

    // Set default price display (prioritize simple variant when both formats disabled OR message unchecked)
    if (priceDisplay) {
        const hasDigital = config.visibility && config.visibility.digital === true;
        const hasPrinted = config.visibility && config.visibility.printed === true;
        const hasAnyFormat = hasDigital || hasPrinted;

        let defaultPrice;

        // If message checkbox is unchecked, always use simple pricing (if available)
        if (!state.addMessage && config.simple && config.simple.priceText) {
            defaultPrice = config.simple.priceText;
            console.log('Gift Widget: Message unchecked, using simple price:', defaultPrice);
        }
        // If both formats disabled, use simple variant
        else if (!hasAnyFormat && config.simple && config.simple.priceText) {
            defaultPrice = config.simple.priceText;
            console.log('Gift Widget: Using simple price:', defaultPrice, config.simple);
        }
        // Use selected tab price (digital or printed)
        else if (state.type && config[state.type]) {
            defaultPrice = config[state.type].priceText;
            console.log('Gift Widget: Using', state.type, 'price:', defaultPrice, config[state.type]);
        }
        // Fallback
        else {
            defaultPrice = '$0.00';
            console.log('Gift Widget: Using fallback price');
        }

        priceDisplay.textContent = defaultPrice;
    }
    updateTotal();


    // --- Event Listeners ---

    // Toggle Switch
    if (toggleInput) {
        toggleInput.addEventListener('change', (e) => {
            state.enabled = e.target.checked;
            handleToggle(state.enabled);
        });
    }

    // Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetType = tab.dataset.tab;
            const isVisible = config.visibility ? config.visibility[targetType] : true;
            if (state.type !== targetType && isVisible) {
                switchTab(targetType);
            }
        });
    });

    // Digital Format Buttons
    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectFormat(btn);
        });
    });

    // Message Input
    if (messageInput) {
        messageInput.addEventListener('input', (e) => {
            state.message = e.target.value;
        });
    }

    // --- Validation Logic ---

    // 1. Character Counters
    const setupCharCounter = (inputId, countId, limit) => {
        const input = container.querySelector('#' + inputId);
        const counter = container.querySelector('#' + countId);

        if (input && counter) {
            const updateCount = () => {
                const len = input.value.length;
                counter.textContent = len;
                if (len >= limit) {
                    counter.style.color = '#ef4444'; // Red
                } else {
                    counter.style.color = '#6b7280'; // Gray
                }
            };
            input.addEventListener('input', updateCount);
            updateCount(); // Init
        }
    };

    setupCharCounter('gift-digital-message', 'digital-msg-count', 300);
    setupCharCounter('gift-message-text', 'printed-msg-count', 300);
    setupCharCounter('gift-digital-caption', 'digital-caption-count', 50);
    setupCharCounter('gift-printed-caption', 'printed-caption-count', 50);

    // 2. File Size Validation (Global Handler)
    window.handleFileSelect = function (input) {
        // Find feedback element (next sibling)
        let feedback = input.nextElementSibling;
        // Verify it is the feedback element?
        if (feedback && !feedback.classList.contains('gift-file-feedback')) {
            // If checking fails, try querying by ID if specific pattern exists
            // Or assume structure is correct.
            // HTML structure: input -> span.gift-file-feedback
        }

        const maxSize = parseInt(input.dataset.maxSize, 10);

        if (input.files && input.files[0]) {
            const file = input.files[0];
            const size = file.size;

            if (!isNaN(maxSize) && size > maxSize) {
                // Too big
                input.value = ''; // Clear
                if (feedback) {
                    feedback.textContent = `File too large (${(size / 1024 / 1024).toFixed(1)}MB). Max size is ${(maxSize / 1024 / 1024).toFixed(0)}MB.`;
                    feedback.className = 'gift-file-feedback error';
                }
                alert(`File is too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)}MB.`);
            } else {
                // OK
                if (feedback) {
                    feedback.textContent = `File Selected: ${file.name}`;
                    feedback.className = 'gift-file-feedback success';
                }
            }
        } else {
            // Cancelled or cleared
            if (feedback) {
                feedback.textContent = '';
                feedback.className = 'gift-file-feedback';
            }
        }
    };


    // --- Gift Preview Logic ---
    const previewBtn = document.getElementById('gift-preview-btn');
    const previewModal = document.getElementById('gift-preview-modal');
    const previewClose = document.getElementById('gift-modal-close');
    const previewEdit = document.getElementById('gift-modal-edit');
    const previewConfirm = document.getElementById('gift-modal-confirm');
    const previewBody = document.getElementById('gift-preview-body');
    const previewOverlay = document.querySelector('.gift-modal-overlay');

    function renderPreview() {
        console.log("Gift Widget: renderPreview triggered");
        if (!previewBody) {
            console.error("Gift Widget: previewBody not found");
            return;
        }

        try {
            let html = '';
            const price = priceDisplay ? priceDisplay.textContent : '';

            // Determine Mode
            const hasDigital = config.visibility && config.visibility.digital === true;
            const hasPrinted = config.visibility && config.visibility.printed === true;
            const hasAnyFormat = hasDigital || hasPrinted;
            const simpleMode = !state.addMessage || !hasAnyFormat;

            // 1. Gift For
            html += `<div class="gift-preview-row">
                <span class="gift-preview-label">Gift For</span>
                <div class="gift-preview-value">${productTitle}</div>
            </div>`;

            // 2. Price
            html += `<div class="gift-preview-row">
                <span class="gift-preview-label">Price</span>
                <div class="gift-preview-value">${price}</div>
            </div>`;

            if (!simpleMode) {
                // Full Customization Mode
                let formatLabel = state.type === 'digital' ? state.format : state.printedFormat;
                // formatting cleanup matching cart logic
                if (formatLabel === 'printed_photo') formatLabel = 'Photo';
                else if (formatLabel === 'printed_card' || formatLabel === 'text_msg') formatLabel = 'Message';
                else if (formatLabel === 'text') formatLabel = 'Message';
                else if (formatLabel === 'url') formatLabel = 'Link';
                formatLabel = formatLabel.charAt(0).toUpperCase() + formatLabel.slice(1);

                let typeLabel = state.type ? (state.type.charAt(0).toUpperCase() + state.type.slice(1)) : 'Gift';

                html += `<div class="gift-preview-row">
                    <span class="gift-preview-label">Format</span>
                    <div class="gift-preview-value">${typeLabel} - ${formatLabel}</div>
                </div>`;

                // Message
                const isPrintedMessage = state.type === 'printed' && (state.printedFormat === 'text_msg' || state.printedFormat === 'printed_card');
                let messageContent = '';

                if ((state.type === 'digital' && state.format === 'text') || isPrintedMessage) {
                    const msgId = isPrintedMessage ? '#gift-message-text' : '#gift-digital-message';
                    const msgEl = container.querySelector(msgId);
                    if (msgEl) messageContent = msgEl.value;
                } else if (state.type === 'digital' && state.format === 'url') {
                    const urlEl = container.querySelector('#gift-url-input');
                    if (urlEl) messageContent = urlEl.value;
                }

                if (messageContent) {
                    html += `<div class="gift-preview-row">
                        <span class="gift-preview-label">Message</span>
                        <div class="gift-preview-value" style="white-space: pre-wrap;">${messageContent}</div>
                    </div>`;
                }

                // Media Preview
                let mediaFile = null;
                let mediaType = '';

                if (state.type === 'digital') {
                    if (state.format === 'video') {
                        const vidInput = document.getElementById('gift-video-file');
                        if (vidInput && vidInput.files[0]) { mediaFile = vidInput.files[0]; mediaType = 'video'; }
                    } else if (state.format === 'audio') {
                        const audInput = document.getElementById('gift-audio-file');
                        if (audInput && audInput.files[0]) { mediaFile = audInput.files[0]; mediaType = 'audio'; }
                    } else if (state.format === 'photo') {
                        const photInput = document.getElementById('gift-photo-file');
                        if (photInput && photInput.files[0]) { mediaFile = photInput.files[0]; mediaType = 'image'; }
                    }
                } else if (state.type === 'printed' && state.printedFormat === 'printed_photo') {
                    const printInput = document.getElementById('gift-printed-photo-file');
                    if (printInput && printInput.files[0]) { mediaFile = printInput.files[0]; mediaType = 'image'; }
                }

                if (mediaFile) {
                    const objectUrl = URL.createObjectURL(mediaFile);
                    html += `<div class="gift-preview-row"><span class="gift-preview-label">Media Preview</span>`;

                    if (mediaType === 'image') {
                        html += `<img src="${objectUrl}" class="gift-preview-media" alt="Gift Image">`;
                    } else if (mediaType === 'video') {
                        html += `<video src="${objectUrl}" class="gift-preview-media" controls></video>`;
                    } else if (mediaType === 'audio') {
                        html += `<audio src="${objectUrl}" class="gift-preview-media" controls></audio>`;
                    }
                    html += `</div>`;
                }
            }

            previewBody.innerHTML = html;
            previewModal.style.display = 'flex';
            console.log("Gift Widget: Preview Rendered and Displayed");
        } catch (err) {
            console.error("Gift Widget: Preview Render failed", err);
        }
    }

    if (previewBtn) {
        console.log("Gift Widget: Preview Button attached");
        previewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            renderPreview();
        });
    } else {
        console.warn("Gift Widget: Preview Button NOT found");
    }

    const closeModal = () => {
        if (previewModal) previewModal.style.display = 'none';
    };

    if (previewClose) previewClose.addEventListener('click', closeModal);
    if (previewEdit) previewEdit.addEventListener('click', closeModal);
    if (previewOverlay) previewOverlay.addEventListener('click', closeModal);
    if (previewConfirm) previewConfirm.addEventListener('click', () => {
        closeModal();
        if (typeof submitBtn !== 'undefined' && submitBtn) {
            submitBtn.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // --- Form Interception Logic (Click Based) ---
    // Try to find the form
    const productForm = container.closest('form[action*="/cart/add"]');
    let submitBtn = null;

    if (productForm) {
        // Find the button inside the form
        submitBtn = productForm.querySelector('[type="submit"], [name="add"], .product-form__submit');
    }

    if (!submitBtn) {
        console.warn("Gift Widget: Could not find submit button inside form. Searching globally...");
        submitBtn = document.querySelector('form[action*="/cart/add"] [type="submit"]');
    }

    if (submitBtn) {
        console.log("Gift Widget: Submit Button found.", submitBtn);
        // Bind Click Listener
        submitBtn.addEventListener('click', handleBtnClick);
    } else {
        console.error("Gift Widget: Add to Cart button NOT found. Cannot intercept.");
    }

    async function handleBtnClick(e) {
        if (!state.enabled) return;

        console.log("Gift Widget: Button click intercepted!");

        // DEBUG: Alert removed
        // alert("Gift Widget Intercept! Adding Gift ID: " + state.currentVariantId);

        e.preventDefault();
        e.stopPropagation(); // Stop theme ajax carts

        handleFormSubmit(e);
    }

    async function handleFormSubmit(e) {
        if (!state.enabled) return;

        const form = productForm || document.querySelector('form[action*="/cart/add"]');

        if (!form) {
            e.target.disabled = false;
            return;
        }

        const submitBtnCurrent = e.target;
        submitBtnCurrent.disabled = true;
        const originalText = submitBtnCurrent.innerText;
        submitBtnCurrent.innerText = "Generating Gift Code..."; // Loading state

        try {
            const mainIdInput = form.querySelector('[name="id"]');
            const mainVariantId = mainIdInput ? mainIdInput.value : null;
            const bundleId = Date.now().toString();
            const mainTitle = container.dataset.productTitle || "Product";

            // 1. Upload Content & Generate QR (if applicable)
            let qrData = null;
            if (state.addMessage) {
                try {
                    // Show Progress Modal
                    updateProgress(0, "Preparing your gift...");

                    qrData = await uploadGiftContent((percent) => {
                        updateProgress(percent, `Uploading media: ${percent}%`);
                    });

                    updateProgress(100, "Finalizing gift details...");
                } catch (uploadErr) {
                    hideProgress();
                    console.error("Gift Widget Upload Error:", uploadErr);

                    const errMsg = uploadErr.message || "Failed to upload gift content. Please try again.";
                    alert(`An error has occurred. Please reach out to the site owner and provide this error message:\n\n"${errMsg}"`);

                    submitBtnCurrent.disabled = false;
                    submitBtnCurrent.innerText = originalText;
                    return;
                }
            }

            // 2. Prepare Properties
            const mainProps = {
                '_bundle_id': bundleId,
                'Gift Wrap': 'Yes'
            };

            const giftProps = {
                ...getProperties(true),
                '_bundle_id': bundleId
            };

            const hasDigital = config.visibility && config.visibility.digital === true;
            const hasPrinted = config.visibility && config.visibility.printed === true;
            const hasAnyFormat = hasDigital || hasPrinted;

            // Always show Gift For in all cases
            giftProps['Gift For'] = mainTitle;

            // Full customization mode: add Gift Summary when message checkbox is checked
            if (state.addMessage) {
                // Merge QR Data
                if (qrData) {
                    if (state.type === 'digital' && qrData.qr_url) {
                        giftProps['_Gift QR Code'] = qrData.qr_url;
                    } else if (state.type === 'printed' && state.printedFormat === 'printed_photo' && qrData.file_url) {
                        giftProps['_Gift Image'] = qrData.file_url;
                    }
                }

                // Construct readable summary
                let formatLabel = '';
                if (state.type === 'digital') {
                    formatLabel = state.format;
                } else {
                    formatLabel = state.printedFormat;
                }
                // formatting cleanup
                if (formatLabel === 'printed_photo') formatLabel = 'Photo';
                else if (formatLabel === 'printed_card' || formatLabel === 'text_msg') formatLabel = 'Message';
                else if (formatLabel === 'text') formatLabel = 'Message';
                else if (formatLabel === 'url') formatLabel = 'Link';

                // Capitalize first letter
                formatLabel = formatLabel.charAt(0).toUpperCase() + formatLabel.slice(1);

                let typeLabel = state.type ? (state.type.charAt(0).toUpperCase() + state.type.slice(1)) : 'Gift';

                let summary = `${typeLabel} - ${formatLabel}`;

                // Add content details
                const isPrintedMessage = state.type === 'printed' && (state.printedFormat === 'text_msg' || state.printedFormat === 'printed_card');

                if ((state.type === 'digital' && state.format === 'text') || isPrintedMessage) {
                    const msgId = isPrintedMessage ? '#gift-message-text' : '#gift-digital-message';
                    const msgEl = container.querySelector(msgId);
                    if (msgEl && msgEl.value) {
                        // Add quote with max length
                        const msgVal = msgEl.value.length > 30 ? msgEl.value.substring(0, 30) + '...' : msgEl.value;
                        summary += `: \"${msgVal}\"`;
                    }
                }
                else if (state.type === 'digital' && state.format === 'url') {
                    const urlEl = container.querySelector('#gift-url-input');
                    if (urlEl && urlEl.value) {
                        summary += ` (${urlEl.value})`;
                    }
                }
                else {
                    // For Photo/Video/Audio/Printed-Photo, show the S3 Link if exists
                    if (qrData && qrData.file_url) {
                        // For Photo/Video/Audio, create a separate property for the link
                        // This prevents themes from mangling the summary text text with auto-link logic
                        giftProps['Gift Link'] = qrData.file_url;
                    }

                }

                console.log("Gift Widget: Generated Summary:", summary);
                giftProps['Gift Summary'] = summary;
            }

            console.log("Gift Widget: Final Props:", giftProps);

            const items = [];
            if (mainVariantId) {
                items.push({
                    id: parseInt(mainVariantId, 10),
                    quantity: 1,
                    properties: mainProps
                });
            }

            if (state.type) {
                items.push({
                    id: parseInt(state.currentVariantId, 10),
                    quantity: 1,
                    properties: giftProps
                });
            }

            updateProgress(100, "Adding to cart...");

            const res = await fetch(window.Shopify.routes.root + 'cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items })
            });

            if (res.ok) {
                // Success!
                // --- BACKUP: Add to Cart Note ---
                // Fetch current note first to avoid overwriting
                try {
                    const cartRes = await fetch(window.Shopify.routes.root + 'cart.js');
                    const cart = await cartRes.json();
                    let currentNote = cart.note || "";
                    const newNoteLine = `- Gift for: ${mainTitle} (${state.type || 'Gift'})`;

                    if (!currentNote.includes(newNoteLine)) {
                        const newNote = currentNote ? `${currentNote}\n${newNoteLine}` : `Gift Wrapping Requests:\n${newNoteLine}`;
                        await fetch(window.Shopify.routes.root + 'cart/update.js', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ note: newNote })
                        });
                    }
                } catch (noteErr) {
                    console.error("Gift Widget: Failed to update cart note", noteErr);
                }


                // 1. Try to open generic Cart Drawer (Dawn / OS 2.0)
                const cartDrawer = document.querySelector('cart-drawer');
                const cartNotification = document.querySelector('cart-notification');

                if (cartDrawer && cartDrawer.open) {
                    // Create a specialized event for Dawn to update
                    // Fetch the section to update the drawer content HTML
                    const response = await fetch(`${window.Shopify.routes.root}?section_id=cart-drawer`);
                    const text = await response.text();
                    const html = new DOMParser().parseFromString(text, 'text/html');

                    const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
                    selectors.forEach(selector => {
                        const target = document.querySelector(selector);
                        const source = html.querySelector(selector);
                        if (target && source) target.replaceWith(source);
                    });

                    cartDrawer.open(document.querySelector('.header__icon--cart'));
                }
                else if (cartNotification && cartNotification.open) {
                    // Dawn Notification
                    cartNotification.open();
                }
                else {
                    // Fallback: Reload to show updated state
                    window.location.reload();
                }
            } else {
                hideProgress();
                const json = await res.json();
                console.error("Gift Widget Error:", json);

                const errMsg = json.description || "Unknown cart error";
                alert(`An error has occurred. Please reach out to the site owner and provide this error message:\n\n"Error adding to cart: ${errMsg}"`);
            }
        } catch (err) {
            hideProgress();
            console.error("Error adding bundle to cart", err);

            const errMsg = err.message || "Unknown network error";
            alert(`An error has occurred. Please reach out to the site owner and provide this error message:\n\n"Cart submission failed: ${errMsg}"`);
        } finally {
            submitBtnCurrent.disabled = false;
            // Note: We don't hide progress on success immediately to ensure smooth transition
        }
    }

    function fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
    }

    // --- Progress & UI Helpers ---
    const progressModal = document.getElementById('gift-progress-modal');
    const progressBar = document.getElementById('gift-upload-progress');
    const progressText = document.getElementById('gift-progress-text');

    function updateProgress(percent, message) {
        if (progressModal) {
            progressModal.style.display = 'flex';
            progressModal.setAttribute('aria-hidden', 'false');
            // Ensure focus trap or set focus
            if (document.activeElement !== progressModal) {
                // optional: focus management
            }
        }
        if (progressBar) {
            progressBar.style.width = percent + '%';
            progressBar.setAttribute('aria-valuenow', percent);
        }
        if (progressText && message) progressText.textContent = message;
    }

    function hideProgress() {
        if (progressModal) {
            progressModal.style.display = 'none';
            progressModal.setAttribute('aria-hidden', 'true');
        }
    }

    function uploadWithProgress(url, body, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(percent);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(JSON.stringify(body));
        });
    }

    function uploadFileDirect(url, file, contentType, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url, true);
            xhr.setRequestHeader('Content-Type', contentType);

            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        onProgress(percent);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Direct upload failed with status ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during direct upload'));
            xhr.send(file);
        });
    }

    async function uploadGiftContent(onProgress) {
        // GLOBAL LIMIT: 500MB
        const MAX_SIZE_MB = 500;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

        // Helper: Validate and Get File
        const getFile = (selector) => {
            const el = container.querySelector(selector);
            if (el && el.files[0]) {
                const f = el.files[0];
                if (f.size > MAX_SIZE_BYTES) {
                    throw new Error(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
                }
                return f;
            }
            return null;
        };

        let file = null;
        let fileType = '';
        let caption = '';
        let message = '';
        let url = '';

        // 1. Determine Content Source
        if (state.type === 'digital') {
            if (state.format === 'video') {
                file = getFile('#gift-video-file');
                fileType = 'video';
                caption = container.querySelector('#gift-digital-caption')?.value;
            } else if (state.format === 'audio') {
                file = getFile('#gift-audio-file');
                fileType = 'audio';
            } else if (state.format === 'photo') {
                file = getFile('#gift-photo-file');
                fileType = 'image';
                caption = container.querySelector('#gift-digital-caption')?.value;
            } else if (state.format === 'url') {
                url = container.querySelector('#gift-url-input')?.value;
                caption = container.querySelector('#gift-digital-caption')?.value;
            } else if (state.format === 'text') {
                message = container.querySelector('#gift-digital-message')?.value;
                caption = container.querySelector('#gift-digital-caption')?.value;
            }
        } else if (state.type === 'printed') {
            if (state.printedFormat === 'printed_photo') {
                file = getFile('#gift-printed-photo-file');
                fileType = 'image';
                caption = container.querySelector('#gift-printed-caption')?.value;
            } else if (['text_msg', 'printed_card'].includes(state.printedFormat)) {
                message = container.querySelector('#gift-message-text')?.value;
            }
        }

        // 2. Upload Logic
        const apiBase = 'https://smartgift.live/api';

        if (file) {
            // === PRESIGNED URL FLOW (ALL FILES) ===
            // This bypasses Vercel 4.5MB limit for Photos, Audio, and Video

            if (onProgress) onProgress(0);

            // A. Get Upload URL
            const urlRes = await fetch(`${apiBase}/upload-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileType: file.name.split('.').pop(),
                    contentType: file.type,
                    shopDomain: shopDomain
                })
            });

            if (!urlRes.ok) {
                const errData = await urlRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to initiate upload');
            }
            let { uploadUrl, publicUrl, vercelUrl } = await urlRes.json();

            // Fallback: Construct Vercel URL if missing
            if (!vercelUrl && publicUrl) {
                const filename = publicUrl.split('/').pop();
                const baseUrl = window.GIFT_WIDGET_API_BASE ? new URL(window.GIFT_WIDGET_API_BASE, window.location.origin).origin : 'https://smartgift.live';
                vercelUrl = `${baseUrl}/v/${filename}`;
            }

            // B. Direct Upload to S3
            // Note: For images, we lose server-side caption "burning", but gain reliability.
            // API View should handle caption overlay if needed.
            await uploadFileDirect(uploadUrl, file, file.type, onProgress);

            // C. Generate QR pointing to that URL
            const qrPayload = {
                url: vercelUrl || publicUrl,
                caption: caption || '',
                shopDomain: shopDomain
            };

            const qrRes = await fetch(`${apiBase}/generate-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(qrPayload)
            });

            if (!qrRes.ok) {
                const errData = await qrRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to generate QR');
            }
            return await qrRes.json();

        } else {
            // === TEXT / URL FLOW ===
            // Small data, can send directly to generate-qr

            if (!message && !url) return null; // Nothing to upload

            const body = {
                url: url,
                message: message,
                caption: caption || '',
                shopDomain: shopDomain
            };

            if (onProgress) onProgress(50);

            const qrRes = await fetch(`${apiBase}/generate-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (onProgress) onProgress(100);

            if (!qrRes.ok) {
                const errData = await qrRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to generate QR');
            }
            return await qrRes.json();
        }
    }

    // --- Accessibility Support ---
    function setupAccessibility() {
        const modals = document.querySelectorAll('.gift-modal');
        modals.forEach(modal => {
            modal.addEventListener('keydown', (e) => {
                if (modal.style.display === 'none') return;

                if (e.key === 'Escape') {
                    // Only close if it's the preview modal, progress should not be closable by user (blocking)
                    if (modal.id === 'gift-preview-modal') {
                        modal.style.display = 'none';
                        // Return focus to trigger logic needed
                        const previewBtn = document.getElementById('gift-preview-btn');
                        if (previewBtn) previewBtn.focus();
                    }
                }

                // Trap Focus
                if (e.key === 'Tab') {
                    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if (focusable.length === 0) return;

                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];

                    if (e.shiftKey) {
                        if (document.activeElement === first) {
                            e.preventDefault();
                            last.focus();
                        }
                    } else {
                        if (document.activeElement === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                }
            });
        });
    }

    // Initialize Accessibility
    setupAccessibility();

    // --- Logic Functions ---

    // --- Preview Feature Logic ---
    function setupPreview() {
        const previewBtn = document.getElementById('gift-preview-btn');
        const modal = document.getElementById('gift-preview-modal');
        const modalBody = document.getElementById('gift-preview-body');
        const editBtn = document.getElementById('gift-modal-edit');
        const confirmBtn = document.getElementById('gift-modal-confirm');
        const closeBtn = document.getElementById('gift-modal-close');

        if (!previewBtn || !modal) return;

        function closePreview() {
            modal.style.display = 'none';
        }

        function openPreview() {
            if (state.enabled === false) { // Explicit check
                alert("Please enable the gift option.");
                return;
            }

            let contentHtml = '<div class="preview-content-list" style="text-align: left;">';

            // 1. Gift Type & Format
            const typeLabel = state.type ? (state.type.charAt(0).toUpperCase() + state.type.slice(1)) : 'Gift Wrap';
            let formatLabel = state.type === 'digital' ? state.format : state.printedFormat;

            // Cleanup labels
            if (formatLabel === 'text_msg') formatLabel = 'Message Card';
            else if (formatLabel === 'printed_photo') formatLabel = 'Photo';
            else if (formatLabel === 'text') formatLabel = 'Text Message';
            else if (formatLabel === 'url') formatLabel = 'Link';
            else if (formatLabel) formatLabel = formatLabel.charAt(0).toUpperCase() + formatLabel.slice(1);

            contentHtml += `<p><strong>Type:</strong> ${typeLabel} - ${formatLabel || 'Standard'}</p>`;

            // 2. Message / Caption
            let message = '';
            let caption = '';

            if (state.type === 'digital') {
                if (state.format === 'text') {
                    const el = container.querySelector('#gift-digital-message');
                    if (el) message = el.value;
                } else if (state.format === 'url') {
                    const el = container.querySelector('#gift-url-input');
                    if (el) message = el.value;
                }
                const capEl = container.querySelector('#gift-digital-caption');
                if (capEl) caption = capEl.value;
            } else if (state.type === 'printed') {
                if (state.printedFormat === 'text_msg' || state.printedFormat === 'printed_card') {
                    const el = container.querySelector('#gift-message-text');
                    if (el) message = el.value;
                } else if (state.printedFormat === 'printed_photo') {
                    const capEl = container.querySelector('#gift-printed-caption');
                    if (capEl) caption = capEl.value;
                }
            }

            if (message) {
                contentHtml += `<p><strong>Message:</strong><br><span style="background: #f3f4f6; display: block; padding: 0.5rem; border-radius: 4px; margin-top: 4px;">${message}</span></p>`;
            }
            if (caption) {
                contentHtml += `<p><strong>Caption:</strong> "${caption}"</p>`;
            }

            // 3. File Preview
            let file = null;
            if (state.type === 'digital') {
                if (state.format === 'video') file = container.querySelector('#gift-video-file')?.files[0];
                else if (state.format === 'audio') file = container.querySelector('#gift-audio-file')?.files[0];
                else if (state.format === 'photo') file = container.querySelector('#gift-photo-file')?.files[0];
            } else if (state.type === 'printed' && state.printedFormat === 'printed_photo') {
                file = container.querySelector('#gift-printed-photo-file')?.files[0];
            }

            if (file) {
                contentHtml += `<p><strong>Media:</strong> ${file.name} (${Math.round(file.size / 1024)} KB)</p>`;
                if (file.type.startsWith('image/')) {
                    const objUrl = URL.createObjectURL(file);
                    contentHtml += `<div style="margin-top: 0.5rem;"><img src="${objUrl}" style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;"></div>`;
                }
            } else if (state.format === 'video' || state.format === 'photo' || state.format === 'audio') {
                // If required but missing
                contentHtml += `<p style="color: red;"><strong>Media:</strong> No file selected</p>`;
            }

            contentHtml += '</div>';

            modalBody.innerHTML = contentHtml;
            modal.style.display = 'flex';
            confirmBtn.focus();
        }

        previewBtn.addEventListener('click', openPreview);

        if (closeBtn) closeBtn.addEventListener('click', closePreview);
        if (editBtn) editBtn.addEventListener('click', closePreview);
        if (confirmBtn) confirmBtn.addEventListener('click', closePreview);
        modal.querySelector('.gift-modal-overlay')?.addEventListener('click', closePreview);
    }

    // --- Logic Functions ---

    function handleToggle(enabled) {
        if (optionsContent) {
            // Check if at least one format is available
            const hasDigital = config.visibility && config.visibility.digital === true;
            const hasPrinted = config.visibility && config.visibility.printed === true;
            const hasAnyFormat = hasDigital || hasPrinted;

            // Show/hide options content
            optionsContent.style.display = enabled ? 'block' : 'none';

            // If no formats available, hide tabs and format-specific content (simple gift wrap mode)
            if (enabled && !hasAnyFormat) {
                // Hide tabs container
                const tabsContainer = container.querySelector('#gift-tabs-container');
                if (tabsContainer) tabsContainer.style.display = 'none';

                // Hide all tab content (digital/printed options)
                container.querySelectorAll('.tab-content').forEach(c => {
                    c.style.display = 'none';
                });

                // Hide message checkbox in simple mode (no customization needed)
                const messageCheckbox = container.querySelector('#gift-add-message-checkbox');
                if (messageCheckbox) {
                    const inputGroup = messageCheckbox.closest('.gift-input-group');
                    if (inputGroup) inputGroup.style.display = 'none';
                }

                // Set price display from config (use simple gift wrap price, or fallback to digital/printed)
                if (priceDisplay) {
                    const fallbackPrice = config.simple && config.simple.priceText ? config.simple.priceText :
                        (config.digital ? config.digital.priceText :
                            (config.printed ? config.printed.priceText : '$0.00'));
                    priceDisplay.textContent = fallbackPrice;
                }
            } else if (enabled && hasAnyFormat) {
                // Show tabs if formats are available
                const tabsContainer = container.querySelector('#gift-tabs-container');
                if (tabsContainer) tabsContainer.style.display = 'flex';

                // Show message checkbox
                const messageCheckbox = container.querySelector('#gift-add-message-checkbox');
                if (messageCheckbox) {
                    const inputGroup = messageCheckbox.closest('.gift-input-group');
                    if (inputGroup) inputGroup.style.display = 'block';
                }
            }
        }
        updateTotal();
    }

    // Initialize Logic
    setupPreview();
    handleToggle(false); // Reset state
    handleToggle(toggleInput ? toggleInput.checked : false); // Apply initial state

    function switchTab(newType) {
        state.type = newType;
        state.currentVariantId = config[newType].variantId;

        // UI Updates
        if (priceDisplay) priceDisplay.textContent = config[newType].priceText;

        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === newType);
        });

        container.querySelectorAll('.tab-content').forEach(c => {
            c.style.display = 'none';
            c.classList.remove('active');
        });

        // Only show content if addMessage is true
        if (state.addMessage) {
            const activeContent = container.querySelector(`#tab-content-${newType}`);
            if (activeContent) {
                activeContent.style.display = 'block';
                setTimeout(() => activeContent.classList.add('active'), 10);

                // RESET LOGIC: Select the first available option when switching tabs
                if (newType === 'digital') {
                    // Find the first visible format button (Digital)
                    const firstBtn = activeContent.querySelector('.format-btn');
                    if (firstBtn) {
                        selectFormat(firstBtn);
                    }
                } else if (newType === 'printed') {
                    // Find the first visible format button (Printed)
                    const firstPBtn = activeContent.querySelector('.printed-format-btn');
                    if (firstPBtn) {
                        firstPBtn.click();
                    }
                }
            }
        }

        updateTotal();
    }

    function selectFormat(btnElement) {
        state.format = btnElement.dataset.format;
        formatBtns.forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');

        // Hide all format specific content
        container.querySelectorAll('.format-specific-content').forEach(el => el.style.display = 'none');

        // Show selected
        const formatId = `#format-${state.format}-content`;
        const activeContent = container.querySelector(formatId);
        if (activeContent) {
            activeContent.style.display = 'block';
        }

        // Show Caption Wrapper for Digital
        const captionWrapper = container.querySelector('#digital-caption-wrapper');
        if (captionWrapper) {
            captionWrapper.style.display = 'block';
        }
    }

    function updateTotal() {
        if (!totalDisplay) return;
        if (!state.enabled) return;

        const hasDigital = config.visibility && config.visibility.digital === true;
        const hasPrinted = config.visibility && config.visibility.printed === true;
        const hasAnyFormat = hasDigital || hasPrinted;

        let giftPriceCents = 0;

        // If message checkbox is unchecked, always use simple pricing (if available)
        if (!state.addMessage && config.simple && config.simple.priceCents) {
            giftPriceCents = config.simple.priceCents;
            console.log('Gift Widget Total: Message unchecked, using simple price (cents):', giftPriceCents);
        }
        // If both formats disabled - use simple variant if available
        else if (!hasAnyFormat) {
            if (config.simple && config.simple.priceCents) {
                giftPriceCents = config.simple.priceCents;
                console.log('Gift Widget Total: Using simple price (cents):', giftPriceCents);
            } else {
                // No simple variant configured, just show product price
                console.log('Gift Widget Total: No simple variant, showing product price only');
                totalDisplay.textContent = formatMoney(rawProductPrice);
                return;
            }
        }
        // Use the selected type's price (digital or printed)
        else if (state.type && config[state.type]) {
            giftPriceCents = config[state.type].priceCents;
            console.log('Gift Widget Total: Using', state.type, 'price (cents):', giftPriceCents);
        }

        const totalCents = rawProductPrice + giftPriceCents;
        console.log('Gift Widget Total: Product price:', rawProductPrice, '+ Gift:', giftPriceCents, '= Total:', totalCents);
        totalDisplay.textContent = formatMoney(totalCents);
    }

    function formatMoney(cents) {
        return '$' + (cents / 100).toFixed(2);
    }

    function getProperties(visible = true) {
        const props = {};

        // Simple gift wrap mode: If custom message is disabled, don't add any properties
        if (!state.addMessage) {
            return props;  // Return empty - no customization details needed
        }

        // Consolidated Gift Type
        let typeStr = state.type ? (state.type.charAt(0).toUpperCase() + state.type.slice(1)) : 'Gift';
        let formatStr = '';

        if (state.type === 'digital') {
            formatStr = state.format === 'text' ? 'Text' : (state.format.charAt(0).toUpperCase() + state.format.slice(1));
            // Digital: warehouse only needs QR code (added in handleFormSubmit), DO NOT store raw message/url
            // We do NOT add _gift_message or _gift_url here anymore.

            // Check for files to add names if handy? 
            if (state.format === 'audio') {
                const audioEl = container.querySelector('#gift-audio-file');
                if (audioEl && audioEl.files.length > 0) props['_Gift Audio Name'] = audioEl.files[0].name;
            } else if (state.format === 'video') {
                const videoEl = container.querySelector('#gift-video-file');
                if (videoEl && videoEl.files.length > 0) props['_Gift Video Name'] = videoEl.files[0].name;
            }
        } else {
            // Printed
            formatStr = state.printedFormat === 'printed_photo' ? 'Photo' : 'Card';
            if (state.printedFormat === 'text_msg') {
                // For Printed Message (Card), warehouse needs message
                const msgEl = container.querySelector('#gift-message-text');
                if (msgEl && msgEl.value) props['_gift_message'] = msgEl.value;
                else if (state.message) props['_gift_message'] = state.message;
            }
            // For Printed Photo, just uses file
        }

        props['_Gift Type'] = `${typeStr} - ${formatStr}`;

        return props;
    }

});

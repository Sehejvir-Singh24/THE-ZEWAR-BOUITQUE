// ============================================================
// ZEWAR AI STYLIST — Chat Widget (Premium Interactive Edition)
// Self-contained: injects HTML, manages state, calls /api/chat
// Enhancements: typewriter welcome, staggered cards, rotating
// placeholders, sparkle burst, send ripple.
// ============================================================
(function () {
    'use strict';

    const BACKEND = window.BACKEND_URL || '';
    const MAX_HISTORY = 10;
    let conversation = [];
    let isOpen = false;
    let isLoading = false;

    // Image Upload State
    let selectedImageBase64 = null;
    let selectedImageMime = null;
    let selectedImageSrc = null;

    // Rotating input placeholders
    const PLACEHOLDERS = [
        'Ask about styling or upload outfit...',
        'What jewelry suits a red saree? 💃',
        'Upload your outfit for suggestions ✨',
        'Show me your finest bangles...',
        'Looking for a pendant set?',
        'How do I care for my jewelry? 🧴'
    ];
    let placeholderIndex = 0;
    let placeholderInterval = null;

    // --- Inject HTML ---
    const widgetHTML = `
        <!-- FAB -->
        <button id="zewar-chat-fab" aria-label="Open AI Stylist Chat">
            <span class="fab-icon-chat"><i class="fas fa-wand-magic-sparkles"></i></span>
            <span class="fab-icon-close"><i class="fas fa-times"></i></span>
        </button>

        <!-- Chat Panel -->
        <div id="zewar-chat-panel" role="dialog" aria-label="Zewar AI Stylist">
            <!-- Header -->
            <div id="zewar-chat-header">
                <div class="chat-avatar"><i class="fas fa-gem"></i></div>
                <div class="chat-header-info">
                    <h4>Zewar Stylist</h4>
                    <span>Online</span>
                </div>
                <button class="chat-close-btn" aria-label="Close chat">&times;</button>
            </div>

            <!-- Messages -->
            <div id="zewar-chat-messages"></div>

            <!-- Image Preview Area -->
            <div id="zewar-chat-image-preview-container" style="display: none;">
                <img id="zewar-chat-image-preview" src="" alt="Uploaded Outfit Preview">
                <button id="zewar-chat-image-remove" aria-label="Remove image">&times;</button>
            </div>

            <!-- Input -->
            <div id="zewar-chat-input-area">
                <button id="zewar-chat-upload-btn" aria-label="Upload photo"><i class="fas fa-paperclip"></i></button>
                <input type="file" id="zewar-chat-file-input" accept="image/*" style="display: none;">
                <input type="text" id="zewar-chat-input" placeholder="Ask about styling or upload outfit..." autocomplete="off">
                <button id="zewar-chat-send" aria-label="Send message"><i class="fas fa-paper-plane"></i></button>
            </div>

            <!-- Footer -->
            <div id="zewar-chat-footer-tag">Powered by Zewar AI ✨</div>
        </div>
    `;

    document.addEventListener('DOMContentLoaded', () => {
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
        initWidget();
    });

    function initWidget() {
        const fab = document.getElementById('zewar-chat-fab');
        const panel = document.getElementById('zewar-chat-panel');
        const closeBtn = panel.querySelector('.chat-close-btn');
        const input = document.getElementById('zewar-chat-input');
        const sendBtn = document.getElementById('zewar-chat-send');
        const messagesContainer = document.getElementById('zewar-chat-messages');

        // Image elements
        const uploadBtn = document.getElementById('zewar-chat-upload-btn');
        const fileInput = document.getElementById('zewar-chat-file-input');
        const previewContainer = document.getElementById('zewar-chat-image-preview-container');
        const previewImg = document.getElementById('zewar-chat-image-preview');
        const removeImgBtn = document.getElementById('zewar-chat-image-remove');

        // Toggle chat
        fab.addEventListener('click', () => {
            isOpen = !isOpen;
            fab.classList.toggle('active', isOpen);
            panel.classList.toggle('open', isOpen);
            if (isOpen) {
                input.focus();
                if (messagesContainer.children.length === 0) {
                    showWelcome();
                }
                startPlaceholderRotation(input);
            } else {
                stopPlaceholderRotation();
            }
        });

        closeBtn.addEventListener('click', () => {
            isOpen = false;
            fab.classList.remove('active');
            panel.classList.remove('open');
            stopPlaceholderRotation();
        });

        // Send on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Ripple on send button click
        sendBtn.addEventListener('click', (e) => {
            triggerRipple(sendBtn, e);
            sendMessage();
        });

        // Upload Button triggers hidden File Input
        uploadBtn.addEventListener('click', () => {
            if (!isLoading) fileInput.click();
        });

        // File Input Change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 4 * 1024 * 1024) {
                alert('Image must be under 4MB');
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                selectedImageSrc = dataUrl;
                const commaIdx = dataUrl.indexOf(',');
                selectedImageBase64 = dataUrl.substring(commaIdx + 1);
                selectedImageMime = file.type;

                previewImg.src = dataUrl;
                previewContainer.style.display = 'flex';
                scrollToBottom();
            };
            reader.readAsDataURL(file);
        });

        removeImgBtn.addEventListener('click', clearSelectedImage);

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                isOpen = false;
                fab.classList.remove('active');
                panel.classList.remove('open');
                stopPlaceholderRotation();
            }
        });
    }

    function clearSelectedImage() {
        const fileInput = document.getElementById('zewar-chat-file-input');
        const previewContainer = document.getElementById('zewar-chat-image-preview-container');
        const previewImg = document.getElementById('zewar-chat-image-preview');

        selectedImageBase64 = null;
        selectedImageMime = null;
        selectedImageSrc = null;
        if (fileInput) fileInput.value = '';
        if (previewImg) previewImg.src = '';
        if (previewContainer) previewContainer.style.display = 'none';
    }

    // --- Rotating placeholders ---
    function startPlaceholderRotation(input) {
        if (placeholderInterval) return;
        placeholderInterval = setInterval(() => {
            if (document.activeElement !== input && !isLoading) {
                placeholderIndex = (placeholderIndex + 1) % PLACEHOLDERS.length;
                input.placeholder = PLACEHOLDERS[placeholderIndex];
            }
        }, 3500);
    }

    function stopPlaceholderRotation() {
        if (placeholderInterval) {
            clearInterval(placeholderInterval);
            placeholderInterval = null;
        }
    }

    // --- Send button ripple ---
    function triggerRipple(btn, e) {
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        const ripple = document.createElement('span');
        ripple.className = 'zewar-send-ripple';
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    }

    // --- Typewriter effect ---
    function typewriterAppend(role, fullText, delay = 18) {
        const messagesContainer = document.getElementById('zewar-chat-messages');
        const msgEl = document.createElement('div');
        msgEl.className = `zewar-msg ${role}`;
        messagesContainer.appendChild(msgEl);
        scrollToBottom();

        let i = 0;
        const chars = fullText.split('');

        function tick() {
            if (i < chars.length) {
                // Build the raw text so far and render with inline markdown
                const partial = fullText.substring(0, i + 1);
                msgEl.innerHTML = renderMarkdown(partial);
                i++;
                scrollToBottom();
                setTimeout(tick, delay);
            }
        }
        tick();
    }

    // --- Welcome Message with typewriter ---
    function showWelcome() {
        const welcomeText = `Hi! 💎 I'm your personal Zewar stylist. I can help you with:\n\n✨ **Product recommendations** for your outfit\n🎨 **Styling advice** for any occasion\n🧴 **Jewelry care tips** to keep your pieces shining\n\n**Tip:** Upload a photo by clicking the 📎 button!`;

        typewriterAppend('assistant', welcomeText, 14);

        // Show suggestion chips after typewriter finishes (approx)
        const estimatedMs = welcomeText.length * 14 + 250;
        setTimeout(() => {
            const suggestions = [
                'Show me necklaces 📿',
                'Style a red saree 💃',
                'How to clean jewelry? 🧴',
                'Suggest pendant sets'
            ];

            const messagesContainer = document.getElementById('zewar-chat-messages');
            const chipsDiv = document.createElement('div');
            chipsDiv.className = 'zewar-chat-suggestions';
            suggestions.forEach(text => {
                const chip = document.createElement('button');
                chip.className = 'zewar-chat-suggestion-chip';
                chip.textContent = text;
                chip.addEventListener('click', () => {
                    // Strip emoji for the actual query
                    const cleanText = text.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').trim();
                    document.getElementById('zewar-chat-input').value = cleanText;
                    chipsDiv.remove();
                    sendMessage();
                });
                chipsDiv.appendChild(chip);
            });
            messagesContainer.appendChild(chipsDiv);
            scrollToBottom();
        }, estimatedMs);
    }

    // --- Send Message ---
    async function sendMessage() {
        const input = document.getElementById('zewar-chat-input');
        const text = input.value.trim();

        if ((!text && !selectedImageBase64) || isLoading) return;

        const chips = document.querySelector('.zewar-chat-suggestions');
        if (chips) chips.remove();

        const displayQuery = text || 'Suggest matching jewelry for this outfit';

        appendMessage('user', displayQuery, selectedImageSrc);
        conversation.push({ role: 'user', content: displayQuery });
        input.value = '';

        const imagePayload = selectedImageBase64;
        const mimePayload = selectedImageMime;
        clearSelectedImage();

        isLoading = true;
        toggleInput(false);
        const typingEl = showTyping();

        // Show shimmer skeleton placeholders while loading
        const messagesContainer = document.getElementById('zewar-chat-messages');
        const skeletonRow = document.createElement('div');
        skeletonRow.className = 'zewar-chat-products';
        skeletonRow.id = 'zewar-skeleton-row';
        for (let i = 0; i < 3; i++) {
            const s = document.createElement('div');
            s.className = 'zewar-product-skeleton';
            skeletonRow.appendChild(s);
        }
        messagesContainer.appendChild(skeletonRow);
        scrollToBottom();

        try {
            const res = await fetch(BACKEND + '/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: displayQuery,
                    image: imagePayload,
                    mimeType: mimePayload,
                    history: conversation.slice(-MAX_HISTORY)
                })
            });

            if (!res.ok) throw new Error(`Server returned ${res.status}`);

            const data = await res.json();

            typingEl.remove();

            // Remove skeleton row
            const skeleton = document.getElementById('zewar-skeleton-row');
            if (skeleton) skeleton.remove();

            appendMessage('assistant', data.reply);
            conversation.push({ role: 'assistant', content: data.reply });

            if (data.generatedImageUrl) {
                appendGeneratedImage(data.generatedImageUrl);
            }

            if (data.products && data.products.length > 0) {
                appendProductCards(data.products);
            }

        } catch (err) {
            console.error('Zewar Chat Error:', err);
            typingEl.remove();
            const skeleton = document.getElementById('zewar-skeleton-row');
            if (skeleton) skeleton.remove();
            appendMessage('assistant', "I'm having trouble connecting right now. Please try again in a moment. 🙏");
        } finally {
            isLoading = false;
            toggleInput(true);
            document.getElementById('zewar-chat-input').focus();
        }
    }

    // --- Append a text message ---
    function appendMessage(role, text, imageSrc = null) {
        const messagesContainer = document.getElementById('zewar-chat-messages');
        const msgEl = document.createElement('div');
        msgEl.className = `zewar-msg ${role}`;

        let html = '';
        if (imageSrc) {
            html += `<img src="${imageSrc}" class="zewar-msg-img" alt="Uploaded outfit"><br>`;
        }

        html += renderMarkdown(escapeHTML(text));
        msgEl.innerHTML = html;
        messagesContainer.appendChild(msgEl);
        scrollToBottom();
    }

    // --- Append generated image with sparkle burst ---
    function appendGeneratedImage(url) {
        const messagesContainer = document.getElementById('zewar-chat-messages');
        const container = document.createElement('div');
        container.className = 'zewar-chat-generated-image-container';

        container.innerHTML = `
            <div class="generated-image-title"><i class="fas fa-sparkles"></i> ✨ AI Styling Concept Preview</div>
            <img src="${url}" class="zewar-generated-img" alt="AI Styling Preview"
                 onerror="this.parentElement.remove()">
        `;

        const img = container.querySelector('img');
        img.addEventListener('load', () => {
            // Sparkle burst after image loads
            const burst = document.createElement('div');
            burst.className = 'zewar-sparkle-burst';
            burst.textContent = '✨ ✨ ✨';
            container.appendChild(burst);
            setTimeout(() => burst.remove(), 1500);
            scrollToBottom();
        });

        messagesContainer.appendChild(container);
        scrollToBottom();
    }

    // --- Append product cards — horizontal row with staggered animation ---
    function appendProductCards(products) {
        const messagesContainer = document.getElementById('zewar-chat-messages');

        // Wrapper with scroll-hint gradient
        const wrapper = document.createElement('div');
        wrapper.className = 'zewar-products-scroll-hint';

        const container = document.createElement('div');
        container.className = 'zewar-chat-products';

        products.forEach((p, index) => {
            const price = p.discountPrice || p.price;
            const card = document.createElement('a');
            card.className = 'zewar-chat-product-card';
            card.href = `product.html?id=${p.id}`;
            card.target = '_blank';
            card.style.animationDelay = `${index * 0.1}s`;
            card.innerHTML = `
                <img src="${escapeHTML(p.image || '')}"
                     alt="${escapeHTML(p.title)}"
                     onerror="this.src='https://via.placeholder.com/135x105?text=Jewelry'">
                <div class="product-info">
                    <h5>${escapeHTML(p.title)}</h5>
                    <div class="product-meta">
                        <span class="product-price">₹${Number(price).toLocaleString('en-IN')}</span>
                        <span>${escapeHTML(p.category || '')}</span>
                    </div>
                    <div class="product-tap-label"><i class="fas fa-arrow-up-right-from-square" style="font-size:0.6rem;"></i> Tap to view</div>
                </div>
            `;
            container.appendChild(card);
        });

        wrapper.appendChild(container);
        messagesContainer.appendChild(wrapper);
        scrollToBottom();
    }

    // --- Typing indicator ---
    function showTyping() {
        const messagesContainer = document.getElementById('zewar-chat-messages');
        const typing = document.createElement('div');
        typing.className = 'zewar-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typing);
        scrollToBottom();
        return typing;
    }

    // --- Markdown renderer (supports **bold**, *italic*, [links](url), newlines) ---
    function renderMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n/g, '<br>');
    }

    // --- Helpers ---
    function scrollToBottom() {
        const mc = document.getElementById('zewar-chat-messages');
        if (!mc) return;
        requestAnimationFrame(() => {
            mc.scrollTop = mc.scrollHeight;
        });
    }

    function toggleInput(enabled) {
        const uploadBtn = document.getElementById('zewar-chat-upload-btn');
        const input = document.getElementById('zewar-chat-input');
        const btn = document.getElementById('zewar-chat-send');
        if (uploadBtn) uploadBtn.disabled = !enabled;
        if (input) input.disabled = !enabled;
        if (btn) btn.disabled = !enabled;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
})();

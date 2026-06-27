// ============================================================
// ZEWAR AI STYLIST — Chat Widget (Vanilla JS with Multimodal Image Support)
// Self-contained: injects HTML, manages state, calls /api/chat
// ============================================================
(function () {
    'use strict';

    const BACKEND = window.BACKEND_URL || '';
    const MAX_HISTORY = 10; // Max messages sent for context
    let conversation = [];
    let isOpen = false;
    let isLoading = false;

    // Image Upload State
    let selectedImageBase64 = null;
    let selectedImageMime = null;
    let selectedImageSrc = null;

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
                <input type="text" id="zewar-chat-input" placeholder="Ask about styling or upload outfit photo..." autocomplete="off">
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
                // Show welcome message on first open
                if (messagesContainer.children.length === 0) {
                    showWelcome();
                }
            }
        });

        closeBtn.addEventListener('click', () => {
            isOpen = false;
            fab.classList.remove('active');
            panel.classList.remove('open');
        });

        // Send on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);

        // Upload Button triggers hidden File Input
        uploadBtn.addEventListener('click', () => {
            if (!isLoading) fileInput.click();
        });

        // File Input Change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Restrict file size (max 4MB)
            if (file.size > 4 * 1024 * 1024) {
                alert('Image must be under 4MB');
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                const dataUrl = evt.target.result;
                selectedImageSrc = dataUrl;

                // Extract base64 and mime type
                const commaIdx = dataUrl.indexOf(',');
                selectedImageBase64 = dataUrl.substring(commaIdx + 1);
                selectedImageMime = file.type;

                // Show preview
                previewImg.src = dataUrl;
                previewContainer.style.display = 'flex';
                scrollToBottom();
            };
            reader.readAsDataURL(file);
        });

        // Remove Image Preview
        removeImgBtn.addEventListener('click', clearSelectedImage);

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                isOpen = false;
                fab.classList.remove('active');
                panel.classList.remove('open');
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

    // --- Welcome Message ---
    function showWelcome() {
        const welcomeText = `Hi! 💎 I'm your personal Zewar stylist. I can help you with:\n\n✨ **Product recommendations** for your outfit\n🎨 **Styling advice** for any occasion\n🧴 **Jewelry care tips** to keep your pieces shining\n\n**Tip:** You can upload a photo of your outfit by clicking the 📎 button!`;

        appendMessage('assistant', welcomeText);

        // Suggestion chips
        const suggestions = [
            'Earrings under ₹1000',
            'Styling for a red saree',
            'How to clean artificial jewelry?',
            'Show me necklaces'
        ];

        const messagesContainer = document.getElementById('zewar-chat-messages');
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'zewar-chat-suggestions';
        suggestions.forEach(text => {
            const chip = document.createElement('button');
            chip.className = 'zewar-chat-suggestion-chip';
            chip.textContent = text;
            chip.addEventListener('click', () => {
                document.getElementById('zewar-chat-input').value = text;
                chipsDiv.remove();
                sendMessage();
            });
            chipsDiv.appendChild(chip);
        });
        messagesContainer.appendChild(chipsDiv);
        scrollToBottom();
    }

    // --- Send Message ---
    async function sendMessage() {
        const input = document.getElementById('zewar-chat-input');
        const text = input.value.trim();
        
        // Prevent empty sends unless an image is uploaded
        if ((!text && !selectedImageBase64) || isLoading) return;

        // Remove suggestion chips if they exist
        const chips = document.querySelector('.zewar-chat-suggestions');
        if (chips) chips.remove();

        const displayQuery = text || "Suggest matching jewelry for this outfit";

        // Show user message (pass along the image source if uploaded)
        appendMessage('user', displayQuery, selectedImageSrc);
        
        // Add to local history context
        conversation.push({ role: 'user', content: displayQuery });
        input.value = '';

        // Capture local variables and clear state immediately for preview responsiveness
        const imagePayload = selectedImageBase64;
        const mimePayload = selectedImageMime;
        clearSelectedImage();

        // Show typing indicator
        isLoading = true;
        toggleInput(false);
        const typingEl = showTyping();

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

            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }

            const data = await res.json();

            // Remove typing indicator
            typingEl.remove();

            // Show AI reply
            appendMessage('assistant', data.reply);
            conversation.push({ role: 'assistant', content: data.reply });

            // Show product cards if any
            if (data.products && data.products.length > 0) {
                appendProductCards(data.products);
            }

        } catch (err) {
            console.error('Zewar Chat Error:', err);
            typingEl.remove();
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

        // Simple markdown-ish rendering: **bold** and newlines
        html += escapeHTML(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        // Convert product links [Product Name](/product.html?id=xxx) to clickable links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        msgEl.innerHTML = html;
        messagesContainer.appendChild(msgEl);
        scrollToBottom();
    }

    // --- Append product cards ---
    function appendProductCards(products) {
        const messagesContainer = document.getElementById('zewar-chat-messages');
        const container = document.createElement('div');
        container.className = 'zewar-chat-products';
        container.style.animation = 'zewar-msg-in 0.3s ease-out';

        products.forEach(p => {
            const price = p.discountPrice || p.price;
            const card = document.createElement('a');
            card.className = 'zewar-chat-product-card';
            card.href = `product.html?id=${p.id}`;
            card.target = '_blank';
            card.innerHTML = `
                <img src="${escapeHTML(p.image || 'https://via.placeholder.com/56?text=No+Image')}" 
                     alt="${escapeHTML(p.title)}"
                     onerror="this.src='https://via.placeholder.com/56?text=No+Image'">
                <div class="product-info">
                    <h5>${escapeHTML(p.title)}</h5>
                    <div class="product-meta">
                        <span class="product-price">₹${Number(price).toLocaleString('en-IN')}</span>
                        <span>${escapeHTML(p.category || '')}</span>
                    </div>
                </div>
                <div class="product-arrow"><i class="fas fa-chevron-right"></i></div>
            `;
            container.appendChild(card);
        });

        messagesContainer.appendChild(container);
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

    // --- Helpers ---
    function scrollToBottom() {
        const mc = document.getElementById('zewar-chat-messages');
        requestAnimationFrame(() => {
            mc.scrollTop = mc.scrollHeight;
        });
    }

    function toggleInput(enabled) {
        const uploadBtn = document.getElementById('zewar-chat-upload-btn');
        const input = document.getElementById('zewar-chat-input');
        const btn = document.getElementById('zewar-chat-send');
        if (uploadBtn) uploadBtn.disabled = !enabled;
        input.disabled = !enabled;
        btn.disabled = !enabled;
    }

    // Escape raw HTML strings
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
})();

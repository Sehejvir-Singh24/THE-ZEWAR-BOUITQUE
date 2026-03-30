// ============================================================
// ZEWAR BOUTIQUE — Backend Configuration
// This file is loaded by all frontend pages.
// In production: points to the Render API server.
// In local development: falls back to localhost:3000.
// ============================================================
window.BACKEND_URL = (function () {
    // If running locally (localhost or 127.0.0.1), use local server
    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';
    return isLocal
        ? 'http://localhost:3000'
        : 'https://the-zewar-bouitque.onrender.com';
})();

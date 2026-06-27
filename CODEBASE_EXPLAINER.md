# Zewar Boutique — Codebase Explainer

This document provides a technical walkthrough of **The Zewar Boutique** codebase, detailing the folder structure, core features, and architectural flow.

---

## 📂 Directory & File Structure

```
zewar-boutique/
├── .env                        # Environment credentials (port, database, API keys)
├── package.json                # Project dependencies (Express, Mongoose, Gemini SDK, Razorpay)
├── server.js                   # Node.js Express server & REST API endpoints
├── generate-embeddings.js      # One-off CLI script to backfill product vector embeddings
│
├── index.html                  # Homepage (featured collections, gallery)
├── shop.html                   # Store catalog (category filtering)
├── product.html                # Product Detail Page (PDP - zoom, accordions, carousel)
├── checkout.html               # Multi-step checkout & payment processing
├── dashboard.html              # Customer order history & account dashboard
├── admin.html                  # Admin portal (add/edit products, track analytics/orders)
│
├── script.js                   # Main frontend engine (cart, auth modal, zoom, accordion)
├── admin.js                    # Admin panel frontend interactions
├── config.js                   # Shared configuration (auto-detects local vs production backend)
├── styles.css                  # Core design system stylesheet (custom HSL tokens, animations)
├── admin.css                   # Admin panel styling
│
├── chat-widget.js              # Floating AI Stylist UI & conversation handler
├── chat-widget.css             # Chat widget aesthetics (dark theme & gold accents)
│
├── daemon/                     # Daemon service configurations
├── images/                     # Local asset images (logo, lifestyle covers)
└── netlify.toml                # Netlify SPA redirect rules & security headers
```

---

## ⚙️ Core Architecture & Code Overview

### 1. Database Layer (MongoDB Atlas + Mongoose)
The database uses **MongoDB Atlas** with Mongoose schemas defined in [server.js](file:///D:/projects/zewar-boutique/server.js#L63-L87):
* **`Product`**: Stores inventory details (`price`, `stock`, `category`, `description`, `images`, and `descriptionEmbedding` vector array).
* **`Order`**: Stores transactional data (`customerId`, `total`, `status`, `fulfillment`, `items`, and payment gateway references).
* **`Customer`**: CRM data tracking user profiles, password hashes, historical spend, and total orders.
* **`Promo`**: Database of discount codes, validation types (percentage vs flat), min spend limits, and expiry dates.

### 2. Backend Server & REST API ([server.js](file:///D:/projects/zewar-boutique/server.js))
Built on **Express.js**, running on Node.
* **Static Assets**: Serves the root directory static files locally (`app.use(express.static(__dirname))`).
* **CORS Policy**: Configured to dynamically authorize requests originating from either Netlify production sites or local Live Server setups (`127.0.0.1:5500`).
* **Clog Mitigation (DNS Override)**: Bypasses Indian ISP DNS restrictions on database connections by hardcoding Google DNS resolvers globally into Node's process thread.

### 3. AI Styling Assistant (RAG Pipeline)
Integrated natively via `@google/generative-ai` with MongoDB Atlas Vector Search:
* **Vector Generation**: Converts text representations of products into 3072-dimensional arrays using `gemini-embedding-2` in [generate-embeddings.js](file:///D:/projects/zewar-boutique/generate-embeddings.js) and dynamically inside [server.js](file:///D:/projects/zewar-boutique/server.js#L110-L136) on product creation or editing.
* **Three-Stage Multimodal RAG + AI Styling Preview**:
  1. **Image Interpretation**: When a user uploads a photo, `gemini-3.1-flash-lite` analyzes the outfit to produce a descriptive search query.
  2. **Vector Retrieval & Smart Category Balancing**: Computes query embeddings and queries MongoDB using `$vectorSearch` to fetch up to 40 candidate matching jewelry items. It dynamically groups items by category. If the user explicitly asks for a category (e.g. "necklace"), it returns up to 6 of that category. For general queries, it enforces a balanced limit of exactly 2 items per category.
  3. **Contextual Synthesizer**: Feeds matching product metadata, conversation history, the outfit image, and the user's styling query to the model to generate a rich markdown stylist recommendation.
  4. **AI Concept Styling Preview**: Formulates a text prompt combining the outfit description and the top recommended jewelry item, generating a live image on-the-fly using the free Pollinations.ai API. This generation is intentionally conditional and only runs if the user uploads an image or mentions styling intent.
* **Security & Control**: Rate-limited dynamically to prevent model key depletion. Uses optimized `flash-lite` variants to maximize free tier requests (up to 1,500/day).

### 4. Checkout & Payments
* **Stock Deductions**: Ensures real-time inventory validation before generating orders.
* **Razorpay Gateway**: Integrated in [server.js](file:///D:/projects/zewar-boutique/server.js#L219) and [checkout.html](file:///D:/projects/zewar-boutique/checkout.html). Generates transactions on the Razorpay API, validates payment signatures using HMAC SHA-256 (`crypto`) inside `/api/orders/verify` to transition order status to "Paid".

### 5. Frontend Storefront Architecture
Built on **Vanilla HTML/CSS/JavaScript**:
* **Shared Configurations**: [config.js](file:///D:/projects/zewar-boutique/config.js) dynamically targets the backend URL. It uses `localhost:3000` when running locally, and points to the Render service (`https://the-zewar-bouitque.onrender.com`) in production.
* **Shopping Cart Engine**: Lives in [script.js](file:///D:/projects/zewar-boutique/script.js#L126). Injects the cart drawer HTML directly into the DOM of every page, manages local storage state persistence (`zewar_cart`), and enforces stock limit bounds.
* **OTP Authentication Gate**: [script.js](file:///D:/projects/zewar-boutique/script.js#L268) injects a global login screen that prompts users on entry. It supports both secure password login and one-time passcode verification using mock endpoints.

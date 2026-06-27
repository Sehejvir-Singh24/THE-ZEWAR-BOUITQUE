# Zewar Boutique — Changes & Lessons Log

This document records the incremental features, structural fixes, debugging paths, and learnings accumulated during the project's development.

---

## 📅 Timeline of Changes

### 1. Initial State
* Traditional static HTML storefront with vanilla styles.
* Backend Express server doing basic CRUD for products, orders, and promotions.
* Simple OTP and secure email credentials authentication.
* Cloudinary file upload integration.
* Razorpay payment gateway checkout hooks.

### 2. AI Stylist Assistant (RAG Pipeline)
* **Goal**: Integrate a conversational AI stylist capable of fetching jewelry from the database and offering correct care advice.
* **Implemented**:
  * Added Mongoose schema updates for vector search arrays (`descriptionEmbedding`).
  * Created `generate-embeddings.js` script to backfill products using Gemini.
  * Added `/api/chat` route in `server.js` matching user queries to products using Atlas Vector Search.
  * Built floating chat widget (`chat-widget.js` + `chat-widget.css`) loaded on all pages.

### 3. Multimodal Image Search
* **Goal**: Allow users to upload outfit photos for styling recommendations.
* **Implemented**:
  * Configured a Base64 file reader and image selector preview directly in the Vanilla JS chat interface.
  * Set up a **Two-Stage Multimodal RAG Pipeline** in `server.js` using `gemini-2.5-flash`:
    1. Gemini describes the outfit in the photo (Stage 1).
    2. Description text is embedded and searched via Atlas Vector Search (Stage 2).
    3. Retrieved products, query, and image are synthesized for the final recommendation (Stage 3).

### 4. AI Image Concept Preview
* **Goal**: Show users an AI-generated preview of a model wearing their described outfit styled with the top recommended jewelry.
* **Implemented**:
  * Added styling and container element updates in `chat-widget.js` and `chat-widget.css` to render preview images.
  * Formulated dynamic image prompts in `server.js` combining the outfit description (analyzed or user-text) and top recommended product category and details.
  * Integrated Pollinations.ai as a free, high-speed, and unlimited text-to-image API.

---

## 🛠️ Errors Encountered & Fixed

### 1. MongoDB `querySrv ECONNREFUSED` on Mobile Hotspots
* **Issue**: When running the server or embedding scripts locally on standard mobile hotspot connections, Node.js failed to connect to MongoDB Atlas clusters, throwing DNS lookup errors.
* **Root Cause**: Indian ISPs (Jio/Airtel/Vi) block MongoDB SRV lookups on their cellular DNS server endpoints.
* **Solution**: Injected a global DNS override directly at the top of [server.js](file:///D:/projects/zewar-boutique/server.js) and [generate-embeddings.js](file:///D:/projects/zewar-boutique/generate-embeddings.js) to force Google DNS resolvers within the Node.js process:
  ```javascript
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  ```

### 2. Gemini `429 Too Many Requests` (Free Tier Limit)
* **Issue**: Backend requests to `gemini-2.0-flash` were failing with 429 errors indicating zero remaining free tier input quota.
* **Root Cause**: The user's specific API key was rate-limited for model variant `gemini-2.0-flash`.
* **Solution**: Switched the endpoint model to `gemini-2.5-flash` in [server.js](file:///D:/projects/zewar-boutique/server.js), which was verified to have active quota and responded instantly.

### 3. Gemini `400 Bad Request` on `systemInstruction`
* **Issue**: The Gemini API returned validation errors when starting chat sessions: `Invalid value at 'system_instruction' (type.googleapis.com/google.ai.generativelanguage.v1beta.Content)`.
* **Root Cause**: Passing `systemInstruction` as a raw string inside `startChat` is rejected by the SDK/API which expects a structured `Content` object.
* **Solution**: Initialized the system instructions inside the `getGenerativeModel()` options object using the correct structure:
  ```javascript
  const modelInstance = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: {
          role: 'system',
          parts: [{ text: STYLIST_SYSTEM_PROMPT }]
      }
  });
  ```

### 4. Vector Search Dimension Mismatch (768 vs 3072)
* **Issue**: Running vector searches against MongoDB threw search errors.
* **Root Cause**: The initial plan configured the MongoDB Atlas index with `numDimensions: 768` (matching `text-embedding-004`). However, since we used `gemini-embedding-2`, it outputted 3072-dimensional vectors.
* **Solution**: Instructed the user to configure the index with `numDimensions: 3072` inside their Atlas dashboard to match the vector size exactly.

### 5. RAG Context Category Starvation on Compound Queries
* **Issue**: Compound user requests (e.g. "suggest me bangles and a pendant set") returned matching items for only one category (necklaces) and completely starved the other (bangles).
* **Root Cause**: The RAG vector search limits were set to `limit: 3`. High-scoring necklace products filled all 3 available slots, so the LLM did not receive any bangle products in the retrieval context.
* **Solution**: Increased the database `$vectorSearch` and text search fallback limits to `6` in `server.js` to provide the LLM with a broader context pool containing products from both categories.

### 6. Google Imagen 3/4 Paid Plan Restriction (400)
* **Issue**: Direct calls to `imagen-4.0-generate-001:predict` returned `400 Bad Request` stating "Imagen 3 is only available on paid plans."
* **Root Cause**: Google AI Studio disables access to its image generation models for free-tier developer keys.
* **Solution**: Replaced the Google Imagen API calls with the open, high-quality, and completely free **Pollinations.ai** API (`https://image.pollinations.ai/prompt/...`), which works instantly and requires no keys or billing configurations.

---

## 🔍 Diagnostics (Checked & Confirmed Working)

* **Shopping Cart Persistence**: Checked `localStorage` integration in `script.js` — functions perfectly. Out-of-stock boundary alerts enforce correct checkout constraints.
* **CORS Policy Header Alignment**: Confirmed Netlify hostnames (`thezewarboutique.netlify.app` / `zewar-boutique.netlify.app`) are mapped explicitly inside the server's allowed origins list.
* **SPA Routing Fallback**: Tested `netlify.toml` redirects. All virtual directory path lookups redirect correctly to `index.html` without throwing server 404s.

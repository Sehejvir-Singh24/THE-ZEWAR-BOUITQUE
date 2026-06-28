# Zewar Boutique & Zewar AI Stylist 💍✨

A modern, full-stack e-commerce platform for a premium jewelry boutique, featuring **Zewar AI**—an advanced multimodal AI personal stylist.

This project showcases a production-ready e-commerce architecture tightly integrated with a cutting-edge Retrieval-Augmented Generation (RAG) pipeline to provide personalized shopping experiences.

---

## 🌟 The Star Feature: Zewar AI Stylist

**Zewar AI** isn't just a chatbot; it's a multimodal AI stylist that understands context, style, and visual aesthetics.

*   **Multimodal RAG Pipeline:** Users can upload a photo of their outfit. The AI (powered by **Gemini 3.1 Flash-Lite**) analyzes the clothing style, color, and occasion to recommend the perfect jewelry match.
*   **Vector Search Matching:** Product descriptions and metadata are embedded using `gemini-embedding-2` and stored in **MongoDB Atlas**. The AI uses `$vectorSearch` to find semantically matching products in real-time.
*   **AI Concept Previews:** Once a recommendation is made, Zewar AI dynamically generates a visual preview using **Pollinations.ai**, showing the user an on-the-fly concept of how the jewelry pairs with their outfit.
*   **Beautiful UI:** The chat widget features premium aesthetics with glassmorphism, aurora backgrounds, and smooth micro-animations, providing a high-end luxury feel.

---

## 🛒 Full-Stack E-Commerce Features

Beyond the AI, Zewar Boutique is a complete e-commerce solution:

*   **Custom Admin Panel:** A secure dashboard to manage products, view orders, and track revenue analytics.
*   **Secure Checkout & Payments:** Integrated with **Razorpay** for seamless payment processing with HMAC SHA-256 signature validation.
*   **Real-time Cart & Stock Management:** Cart state persists in local storage, with real-time stock validation during checkout.
*   **Authentication Gate:** OTP and password-based login flows.
*   **Dynamic Product Pages:** Image zoom, accordions, and related product carousels.

---

## 🛠️ Tech Stack

**Frontend:**
*   Vanilla HTML5, CSS3, JavaScript (ES6+)
*   Custom Design System (HSL tokens, CSS variables, Glassmorphism)

**Backend:**
*   Node.js & Express.js
*   RESTful API Architecture

**Database & AI:**
*   MongoDB Atlas (Document storage & Vector Database)
*   Mongoose ODM
*   Google Generative AI (Gemini 3.1 Flash-Lite & Embeddings)
*   Pollinations.ai (Image Generation)

**Payments:**
*   Razorpay API

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   MongoDB Atlas account (with Vector Search index configured)
*   Google Gemini API Key
*   Razorpay Account (Test credentials)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/zewar-boutique-ai-stylist.git
    cd zewar-boutique-ai-stylist
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory and add the following keys:
    ```env
    PORT=3000
    MONGODB_URI=your_mongodb_connection_string
    GEMINI_API_KEY=your_gemini_api_key
    RAZORPAY_KEY_ID=your_razorpay_key_id
    RAZORPAY_KEY_SECRET=your_razorpay_key_secret
    ```
    *Note: Never commit your `.env` file to version control.*

4.  **Run the Server**
    ```bash
    npm start
    ```
    The application will run on `http://localhost:3000`.

---

## 🧠 Architecture Overview

If you want to dive deeper into how the database, routing, and AI integration works, check out the [CODEBASE_EXPLAINER.md](./CODEBASE_EXPLAINER.md) included in this repository.

require('dotenv').config();
const dns = require('dns');
// Force Google DNS for mobile hotspots/unreliable carrier DNS
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS: allow Netlify frontend + local dev ---
const allowedOrigins = [
    process.env.FRONTEND_URL,          // e.g. https://zewar-boutique.netlify.app
    'https://thezewarboutique.netlify.app', // Explicitly allow the live frontend
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000'
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Render health checks)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS: ' + origin));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(__dirname));

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// --- Cloudinary Configuration ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Multer + Cloudinary Storage ---
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'zewar-boutique',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }]
    }
});
const upload = multer({ storage });

// --- Mongoose Schemas ---
const productSchema = new mongoose.Schema({
    id: String, title: String, sku: String, price: Number, costPrice: Number,
    discountPrice: Number, stock: Number, category: String, description: String,
    images: [String], image: String,
    descriptionEmbedding: [Number]
}, { strict: false });

const orderSchema = new mongoose.Schema({
    id: String, date: String, customerId: String, customerName: String,
    total: Number, status: String, fulfillment: String, items: Array,
    shippingAddress: Object, source: String, paymentMode: String, tracking: String
}, { strict: false });

const customerSchema = new mongoose.Schema({
    id: String, name: String, email: String, phone: String,
    password: String, spend: Number, orders: Number, shippingAddress: Object
}, { strict: false });

const promotionSchema = new mongoose.Schema({
    id: String, code: String, type: String, value: Number, expiry: String, minSpend: Number
}, { strict: false });

const Product  = mongoose.model('Product',  productSchema);
const Order    = mongoose.model('Order',    orderSchema);
const Customer = mongoose.model('Customer', customerSchema);
const Promo    = mongoose.model('Promo',    promotionSchema);

// --- Gemini AI Setup ---
let genAI = null;
let embeddingModel = null;
let chatModel = null;

if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
    chatModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    console.log('✅ Gemini AI initialized');
} else {
    console.warn('⚠️  GEMINI_API_KEY not set — AI chat features disabled.');
}

// Helper: build text for embedding a product
function buildEmbeddingText(product) {
    const parts = [
        product.title || '',
        product.category ? `Category: ${product.category}` : '',
        product.description || '',
        product.price ? `Price: ₹${product.price}` : '',
        product.discountPrice ? `Sale Price: ₹${product.discountPrice}` : ''
    ];
    return parts.filter(Boolean).join('. ').trim();
}

// Helper: generate embedding vector for a product and save it
async function embedProduct(product) {
    if (!embeddingModel) return;
    try {
        const text = buildEmbeddingText(product);
        const result = await embeddingModel.embedContent(text);
        product.descriptionEmbedding = result.embedding.values;
        await product.save();
    } catch (err) {
        console.error(`⚠️  Embedding failed for ${product.title}:`, err.message);
    }
}

// --- API ROUTES ---

// Dashboard Analytics
app.get('/api/dashboard', async (req, res) => {
    const orders   = await Order.find();
    const products = await Product.find();
    const revenue  = orders.filter(o => o.status === 'Paid').reduce((s, o) => s + o.total, 0);
    const activeOrders = orders.filter(o => o.fulfillment !== 'Delivered' && o.status === 'Paid').length;
    const lowStock = products.filter(p => (p.stock || 0) < 5).length;
    res.json({ totalSales: orders.length, activeOrders, revenue, lowStock });
});

// Products
app.get('/api/products', async (req, res) => res.json(await Product.find()));

app.post('/api/products', upload.array('images', 5), async (req, res) => {
    let imageUrls = req.body.existingImages ? JSON.parse(req.body.existingImages) : [];
    if (req.files) req.files.forEach(f => imageUrls.push(f.path));
    if (req.body.imageUrl) imageUrls.push(req.body.imageUrl);
    const p = new Product({
        id: Date.now().toString(), title: req.body.title,
        sku: req.body.sku || `SKU-${Date.now().toString().slice(-4)}`,
        price: parseFloat(req.body.price), costPrice: parseFloat(req.body.costPrice || 0),
        discountPrice: req.body.discount ? parseFloat(req.body.discount) : null,
        stock: parseInt(req.body.stock || 0), category: req.body.category,
        description: req.body.desc || '', images: imageUrls,
        image: imageUrls[0] || 'https://via.placeholder.com/300?text=No+Image'
    });
    await p.save();
    // Auto-generate embedding for new product (non-blocking)
    embedProduct(p).catch(() => {});
    res.json(p);
});

app.put('/api/products/:id', upload.array('images', 5), async (req, res) => {
    const p = await Product.findOne({ id: req.params.id });
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.body.stock !== undefined) p.stock = parseInt(req.body.stock);
    if (req.body.price !== undefined) p.price = parseFloat(req.body.price);
    if (req.body.discountPrice) p.discountPrice = parseFloat(req.body.discountPrice);
    if (req.body.clearDiscount === 'true') p.discountPrice = null;
    if (req.files && req.files.length > 0) {
        if (!p.images) p.images = [p.image];
        req.files.forEach(f => p.images.push(f.path));
        if (p.image && p.image.includes('placeholder')) p.image = req.files[0].path;
    }
    p.markModified('images');
    await p.save();
    // Re-generate embedding on update (non-blocking)
    embedProduct(p).catch(() => {});
    res.json({ success: true, product: p });
});

app.delete('/api/products/:id/image', async (req, res) => {
    const p = await Product.findOne({ id: req.params.id });
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    p.images = (p.images || []).filter(img => img !== req.body.image);
    if (p.image === req.body.image) p.image = p.images[0] || 'https://via.placeholder.com/300?text=No+Image';
    p.markModified('images');
    await p.save();
    res.json({ success: true, product: p });
});

app.delete('/api/products/:id', async (req, res) => {
    await Product.deleteOne({ id: req.params.id });
    res.json({ success: true });
});

// Orders
app.get('/api/orders', async (req, res) => res.json(await Order.find()));

app.put('/api/orders/:id', async (req, res) => {
    const o = await Order.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (o) res.json(o); else res.status(404).json({ error: 'Order not found' });
});

app.get('/api/orders/customer/:id', async (req, res) => {
    res.json((await Order.find({ customerId: req.params.id })).reverse());
});

// Customers
app.get('/api/customers', async (req, res) => res.json(await Customer.find()));

// Promotions
app.get('/api/promotions', async (req, res) => res.json(await Promo.find()));
app.post('/api/promotions', async (req, res) => {
    const p = new Promo({ id: Date.now().toString(), ...req.body });
    await p.save(); res.json(p);
});
app.delete('/api/promotions/:id', async (req, res) => {
    await Promo.deleteOne({ id: req.params.id }); res.json({ success: true });
});

// --- Auth & CRM ---
const mergeCustomer = async (profile) => {
    let existing = null;
    if (profile.email) existing = await Customer.findOne({ email: profile.email });
    if (!existing && profile.phone) existing = await Customer.findOne({ phone: profile.phone });
    if (existing) {
        if (!existing.email && profile.email) existing.email = profile.email;
        if (!existing.phone && profile.phone) existing.phone = profile.phone;
        if (profile.name && (!existing.name || existing.name === 'Guest')) existing.name = profile.name;
        await existing.save();
    } else {
        existing = new Customer({ id: 'c' + Date.now(), name: profile.name || 'Guest', email: profile.email || '', phone: profile.phone || '', spend: 0, orders: 0 });
        await existing.save();
    }
    return existing;
};

let otpStore = {};
app.post('/api/auth/otp', (req, res) => { otpStore[req.body.phone] = "1234"; res.json({ success: true }); });
app.post('/api/auth/verify', async (req, res) => {
    const { phone, otp } = req.body;
    if (otpStore[phone] === otp) { delete otpStore[phone]; res.json({ success: true, customer: await mergeCustomer({ phone }) }); }
    else res.status(401).json({ success: false, message: 'Invalid OTP' });
});
app.post('/api/auth/google', async (req, res) => res.json({ success: true, customer: await mergeCustomer(req.body) }));

app.post('/api/auth/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    if (await Customer.findOne({ email })) return res.status(400).json({ success: false, message: 'Email address is already in use.' });
    const c = new Customer({ id: 'c' + Date.now(), name: `${firstName} ${lastName}`.trim(), email, password, phone: '', spend: 0, orders: 0 });
    await c.save();
    res.json({ success: true, customer: c });
});

app.post('/api/auth/login', async (req, res) => {
    const c = await Customer.findOne({ email: req.body.email, password: req.body.password });
    if (c) res.json({ success: true, customer: c });
    else res.status(401).json({ success: false, message: 'Invalid email or incorrect password.' });
});

// --- Checkout ---
app.post('/api/orders/checkout', async (req, res) => {
    const payload = req.body;
    const products = await Product.find();
    let outOfStockItem = '';
    let stockValid = payload.cart.every(item => {
        const p = products.find(x => x.id === item.id);
        if (!p || (p.stock || 0) < item.qty) { outOfStockItem = item.title; return false; }
        return true;
    });
    if (!stockValid) return res.status(400).json({ success: false, message: `${outOfStockItem} is out of stock or insufficient quantity.` });
    for (const item of payload.cart) {
        const p = await Product.findOne({ id: item.id });
        if (p) { p.stock -= item.qty; await p.save(); }
    }
    let customer = await Customer.findOne({ email: payload.customer.email });
    if (!customer && payload.customer.phone) customer = await Customer.findOne({ phone: payload.customer.phone });
    if (customer) {
        if (!customer.phone) customer.phone = payload.customer.phone;
        customer.spend = (customer.spend || 0) + payload.total;
        customer.orders = (customer.orders || 0) + 1;
        await customer.save();
    } else {
        customer = new Customer({ id: 'c' + Date.now(), name: `${payload.customer.firstName} ${payload.customer.lastName}`.trim(), email: payload.customer.email, phone: payload.customer.phone, password: '', spend: payload.total, orders: 1 });
        await customer.save();
    }
    const newOrder = new Order({ id: `ORD-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), customerId: customer.id, customerName: customer.name, total: payload.total, status: 'Payment Pending', fulfillment: 'Processing', items: payload.cart, shippingAddress: payload.customer.address, source: 'Online - Web', paymentMode: 'Credit Card / UPI Gateway' });
    
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        try {
            const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
            const rpOrder = await razorpay.orders.create({
                amount: Math.round(payload.total * 100), // in paise
                currency: "INR",
                receipt: newOrder.id
            });
            newOrder.razorpayOrderId = rpOrder.id;
            await newOrder.save();
            return res.json({ success: true, order: newOrder, customer, razorpayOrderId: rpOrder.id, razorpayKeyId: process.env.RAZORPAY_KEY_ID, amount: rpOrder.amount });
        } catch (e) {
            console.error("Razorpay error:", e);
            return res.status(500).json({ success: false, message: 'Payment gateway error.' });
        }
    } else {
        // Fallback for when Razorpay API Keys are not set
        await newOrder.save();
        res.json({ success: true, order: newOrder, customer });
    }
});

app.post('/api/orders/verify', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                    .update(body.toString())
                                    .digest('hex');
    
    if (expectedSignature === razorpay_signature) {
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
        if (order) {
            order.status = 'Paid';
            await order.save();
            res.json({ success: true, message: 'Payment verified successfully', order });
        } else {
            res.status(404).json({ success: false, message: 'Order not found' });
        }
    } else {
        res.status(400).json({ success: false, message: 'Invalid signature' });
    }
});

// --- POS ---
app.post('/api/admin/pos-order', async (req, res) => {
    const payload = req.body;
    const product = await Product.findOne({ id: payload.productId });
    if (!product) return res.status(400).json({ success: false, message: 'Product not found' });
    if ((product.stock || 0) < payload.qty) return res.status(400).json({ success: false, message: `Insufficient inventory. Only ${product.stock} remaining.` });
    product.stock -= Number(payload.qty);
    await product.save();
    let customer = payload.customerId ? await Customer.findOne({ id: payload.customerId }) : null;
    if (!customer) {
        customer = new Customer({ id: 'c' + Date.now(), name: payload.customerName || 'Walk-in Customer', email: '', phone: payload.customerPhone || '', password: '', spend: 0, orders: 0 });
        await customer.save();
    }
    const totalPaid = Number(payload.overridePrice) * Number(payload.qty);
    customer.spend = (customer.spend || 0) + totalPaid;
    customer.orders = (customer.orders || 0) + 1;
    await customer.save();
    const newOrder = new Order({ id: `POS-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), customerId: customer.id, customerName: customer.name, total: totalPaid, status: 'Paid', fulfillment: payload.fulfillment, items: [{ id: product.id, title: product.title, price: Number(payload.overridePrice), qty: Number(payload.qty), image: product.image }], source: 'Offline - Manual', paymentMode: payload.paymentMode });
    await newOrder.save();
    res.json({ success: true, order: newOrder });
});

// --- AI Chat Route (RAG Pipeline) ---

// Simple in-memory rate limiter for /api/chat
const chatRateLimit = {};
const CHAT_RATE_LIMIT = 10; // max requests per minute per IP
const CHAT_RATE_WINDOW = 60 * 1000; // 1 minute

function checkChatRateLimit(ip) {
    const now = Date.now();
    if (!chatRateLimit[ip]) chatRateLimit[ip] = [];
    chatRateLimit[ip] = chatRateLimit[ip].filter(t => now - t < CHAT_RATE_WINDOW);
    if (chatRateLimit[ip].length >= CHAT_RATE_LIMIT) return false;
    chatRateLimit[ip].push(now);
    return true;
}

// System prompt with static category-level care tips
const STYLIST_SYSTEM_PROMPT = `You are the personal styling assistant for The Zewar Boutique, an Indian artificial (imitation) jewelry brand.

Your personality: Warm, knowledgeable, and fashion-forward. Think of yourself as a trusted friend who happens to be a jewelry expert.

RULES:
1. ONLY recommend products from the [RETRIEVED PRODUCTS] section below. NEVER invent or hallucinate products.
2. Always mention the product name, price (use ₹), and category when recommending.
3. When the user describes an outfit, provide specific pairing advice explaining WHY a piece works (color theory, neckline compatibility, occasion suitability).
4. For care questions, ONLY give the advice in the CARE GUIDE below. NEVER suggest baking soda, toothpaste, vinegar, lemon juice, or any abrasive/acidic substance on artificial jewelry — these DESTROY the plating.
5. If the user asks something unrelated to jewelry, fashion, or styling, politely say: "I'm best at helping with jewelry and styling! Is there a piece you'd like help with?"
6. Format product links as: [Product Name](/product.html?id=PRODUCT_ID)
7. Keep responses concise (under 150 words) and warm.
8. If no retrieved products match, say so honestly and suggest browsing the full collection.

--- JEWELRY CARE GUIDE (by category) ---

NECKLACES & PENDANT SETS:
• Store flat in an airtight zip-lock or velvet pouch to avoid tangling and oxidation.
• Apply perfume and makeup BEFORE wearing — chemicals tarnish plating.
• Wipe gently with a soft dry microfiber cloth after each wear.
• Remove before showering, swimming, or exercising.

EARRINGS (Studs, Hoops, Drops, Jhumkas):
• Clean posts with a dry cotton swab to prevent ear irritation.
• Store each pair separately to prevent scratching.
• Avoid sleeping in heavy earrings — this loosens clasps.

BANGLES & BRACELETS:
• Remove before washing hands or doing dishes.
• Store stacked with soft cloth between each bangle to prevent scratches.
• Gold-plated bangles should NEVER touch silver pieces — this causes discoloration.

RINGS:
• Remove before applying hand cream or sanitizer.
• Store in individual compartments.
• Avoid wearing in the gym — sweat accelerates tarnishing.

GENERAL (ALL CATEGORIES):
• Keep away from water, perfume, deodorant, and hairspray.
• Store in airtight pouches with silica gel packets to absorb moisture.
• NEVER use chemical jewelry cleaners designed for real gold/silver.
• If tarnishing begins, gently rub with a dry soft cloth — do NOT scrub.
---`;

app.post('/api/chat', async (req, res) => {
    // Rate limiting
    const clientIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    if (!checkChatRateLimit(clientIp)) {
        return res.status(429).json({ reply: "You're sending messages too quickly. Please wait a moment and try again. 🙏", products: [] });
    }

    // Check if AI is configured
    if (!genAI || !embeddingModel || !chatModel) {
        return res.status(503).json({ reply: "The AI stylist is currently unavailable. Please try again later.", products: [] });
    }

    const { message, image, mimeType, history } = req.body || {};
    
    // Prevent empty requests (allow empty text if image is uploaded)
    const hasText = message && typeof message === 'string' && message.trim().length > 0;
    const hasImage = image && typeof image === 'string' && image.trim().length > 0;

    if (!hasText && !hasImage) {
        return res.status(400).json({ reply: "Please type a message or upload an outfit photo so I can help you! 💎", products: [] });
    }

    const userMessageText = hasText ? message.trim() : "Suggest matching jewelry for this outfit";

    try {
        let searchPhrase = userMessageText;
        let imagePart = null;

        // Stage 1: Analyze the image if uploaded to get a styling search query
        if (hasImage) {
            imagePart = {
                inlineData: {
                    data: image,
                    mimeType: mimeType || 'image/jpeg'
                }
            };

            try {
                // Use the main chat model to describe the image in a search-friendly phrase
                const analysisResult = await chatModel.generateContent([
                    imagePart,
                    "Describe this outfit's color, pattern, neckline, and style in under 15 words for a database search query."
                ]);
                const imageDescription = analysisResult.response.text().trim();
                console.log('🔍 Image description generated:', imageDescription);
                
                // Combine the user text query and the image description to find products
                searchPhrase = `${userMessageText}. ${imageDescription}`;
            } catch (imgErr) {
                console.warn('⚠️ Image analysis failed, falling back to message text:', imgErr.message);
                imagePart = null;
            }
        }

        // 2. Embed the search query (could be text query + image description)
        const queryEmbedResult = await embeddingModel.embedContent(searchPhrase);
        const queryVector = queryEmbedResult.embedding.values;

        // 3. Vector Search — find top 3 relevant products
        let retrievedProducts = [];
        try {
            retrievedProducts = await Product.aggregate([
                {
                    $vectorSearch: {
                        index: 'product_embeddings',
                        path: 'descriptionEmbedding',
                        queryVector: queryVector,
                        numCandidates: 40,
                        limit: 6
                    }
                },
                {
                    $project: {
                        _id: 0,
                        id: 1, title: 1, category: 1, price: 1,
                        discountPrice: 1, description: 1, image: 1, stock: 1,
                        score: { $meta: 'vectorSearchScore' }
                    }
                }
            ]);
        } catch (vsErr) {
            console.warn('⚠️ Vector search failed (index may not exist yet):', vsErr.message);
            // Fallback: simple text search
            const searchRegex = new RegExp(searchPhrase.split(/\s+/).join('|'), 'i');
            retrievedProducts = await Product.find({
                $or: [
                    { title: searchRegex },
                    { category: searchRegex },
                    { description: searchRegex }
                ]
            }).select('id title category price discountPrice description image stock').limit(6).lean();
        }

        // 4. Build context for LLM
        let productContext = 'No matching products found in our catalog.';
        if (retrievedProducts.length > 0) {
            productContext = retrievedProducts.map((p, i) => {
                const price = p.discountPrice || p.price;
                return `Product ${i + 1}:\n  Name: ${p.title}\n  Category: ${p.category}\n  Price: ₹${price}\n  Description: ${p.description || 'N/A'}\n  Link ID: ${p.id}\n  In Stock: ${(p.stock || 0) > 0 ? 'Yes' : 'Out of Stock'}`;
            }).join('\n\n');
        }

        // 5. Build conversation for Gemini
        const conversationHistory = (history || []).slice(-MAX_HISTORY).map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
        }));

        // Remove the last user message from history since we send it in the session message
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            conversationHistory.pop();
        }

        const fullUserMessage = `[RETRIEVED PRODUCTS]\n${productContext}\n\n[USER QUESTION]\n${userMessageText}`;

        const modelInstance = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite',
            systemInstruction: {
                role: 'system',
                parts: [{ text: STYLIST_SYSTEM_PROMPT }]
            }
        });

        const chat = modelInstance.startChat({
            history: conversationHistory
        });

        // Stage 3: Call chat completion (passing the image generative part if it exists)
        let result;
        if (imagePart) {
            result = await chat.sendMessage([fullUserMessage, imagePart]);
        } else {
            result = await chat.sendMessage(fullUserMessage);
        }
        const reply = result.response.text();

        // 6. Return response
        // Only send products that are in stock
        const visibleProducts = retrievedProducts
            .filter(p => (p.stock || 0) > 0)
            .map(p => ({
                id: p.id,
                title: p.title,
                category: p.category,
                price: p.price,
                discountPrice: p.discountPrice,
                image: p.image
            }));

        let generatedImageUrl = null;
        if (visibleProducts.length > 0) {
            let outfitDesc = 'traditional Indian outfit';
            let shouldGenerate = false;

            if (hasImage) {
                shouldGenerate = true;
                if (searchPhrase.includes('. ')) {
                    outfitDesc = searchPhrase.split('. ').slice(1).join('. ').trim();
                }
            } else {
                const lowerText = userMessageText.toLowerCase();
                const hasOutfitWord = lowerText.includes('saree') || lowerText.includes('sari') || 
                                      lowerText.includes('lehenga') || lowerText.includes('gown') || 
                                      lowerText.includes('suit') || lowerText.includes('dress') ||
                                      lowerText.includes('anarkali') || lowerText.includes('kurti') ||
                                      lowerText.includes('outfit');
                                      
                const hasStylingIntent = lowerText.includes('styl') || lowerText.includes('pair') || 
                                         lowerText.includes('match') || lowerText.includes('wear') || 
                                         lowerText.includes('go with') || lowerText.includes('suggest') || 
                                         lowerText.includes('recommend');
                
                if (hasOutfitWord && hasStylingIntent) {
                    shouldGenerate = true;
                    outfitDesc = userMessageText;
                }
            }

            if (shouldGenerate) {
                const topProduct = visibleProducts[0];
                const promptText = `A professional catalog fashion photo of an Indian female model wearing a ${outfitDesc} styled with Zewar Boutique ${topProduct.title} ${topProduct.category}, studio lighting, highly detailed, premium jewelry boutique catalog.`;
                generatedImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
            }
        }

        res.json({ reply, products: visibleProducts, generatedImageUrl });

    } catch (err) {
        console.error('❌ /api/chat error:', err);
        res.status(500).json({
            reply: "I ran into an issue processing your request. Please try again! 🙏",
            products: []
        });
    }
});

const MAX_HISTORY = 10;

app.listen(PORT, () => console.log(`Zewar Boutique server running on port ${PORT}`));

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS: allow Netlify frontend + local dev ---
const allowedOrigins = [
    process.env.FRONTEND_URL,          // e.g. https://zewar-boutique.netlify.app
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
app.use(express.json());
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
    images: [String], image: String
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
    await newOrder.save();
    res.json({ success: true, order: newOrder, customer });
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

app.listen(PORT, () => console.log(`Zewar Boutique server running on port ${PORT}`));

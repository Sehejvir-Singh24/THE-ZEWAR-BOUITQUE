const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = __dirname;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Ensure images directory exists
const uploadDir = path.join(__dirname, 'images');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage });

// Helper to read/write JSON files
const getFileData = (filename) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([]));
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return []; }
};

const saveFileData = (filename, data) => {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
};

// Seed Dummy Data for new modules if empty
if (getFileData('customers.json').length === 0) {
    saveFileData('customers.json', [
        { id: "c1", name: "Aisha Khan", email: "aisha@example.com", phone: "+1234567890", spend: 450.00, orders: 2 },
        { id: "c2", name: "Sarah Jenkins", email: "sarahj@example.com", phone: "+0987654321", spend: 129.00, orders: 1 },
        { id: "c3", name: "Sophia Martinez", email: "sophia.m@example.com", phone: "+1122334455", spend: 899.00, orders: 4 }
    ]);
}
if (getFileData('orders.json').length === 0) {
    saveFileData('orders.json', [
        { id: "ORD-1001", date: new Date().toISOString(), customerId: "c1", customerName: "Aisha Khan", total: 299.00, status: "Paid", fulfillment: "Processing" },
        { id: "ORD-1002", date: new Date(Date.now() - 86400000*2).toISOString(), customerId: "c2", customerName: "Sarah Jenkins", total: 129.00, status: "Paid", fulfillment: "Shipped", tracking: "TRK987654321" },
        { id: "ORD-1003", date: new Date(Date.now() - 86400000*5).toISOString(), customerId: "c3", customerName: "Sophia Martinez", total: 450.00, status: "Paid", fulfillment: "Delivered", tracking: "TRK123456789" }
    ]);
}
if (getFileData('promotions.json').length === 0) {
    saveFileData('promotions.json', [
        { id: "p1", code: "ZEWAR10", type: "percentage", value: 10, expiry: "2026-12-31", minSpend: 100 },
        { id: "p2", code: "WELCOME50", type: "flat", value: 50, expiry: "2026-06-30", minSpend: 250 }
    ]);
}

// --- API ROUTES ---

// Dashboard Analytics
app.get('/api/dashboard', (req, res) => {
    const orders = getFileData('orders.json');
    const products = getFileData('products.json');
    
    const revenue = orders.filter(o => o.status === 'Paid').reduce((sum, o) => sum + o.total, 0);
    const activeOrders = orders.filter(o => o.fulfillment !== 'Delivered' && o.status === 'Paid').length;
    const lowStock = products.filter(p => (p.stock || 0) < 5).length;
    
    res.json({ totalSales: orders.length, activeOrders, revenue, lowStock });
});

// Products CRUD
app.get('/api/products', (req, res) => res.json(getFileData('products.json')));
app.post('/api/products', upload.array('images', 5), (req, res) => {
    const products = getFileData('products.json');
    
    let imageUrls = req.body.existingImages ? JSON.parse(req.body.existingImages) : [];
    if (req.files && req.files.length > 0) {
        req.files.forEach(f => imageUrls.push(`./images/${f.filename}`));
    }
    if (req.body.imageUrl) imageUrls.push(req.body.imageUrl);

    const newProduct = {
        id: Date.now().toString(),
        title: req.body.title,
        sku: req.body.sku || `SKU-${Date.now().toString().slice(-4)}`,
        price: parseFloat(req.body.price),
        costPrice: parseFloat(req.body.costPrice || 0),
        discountPrice: req.body.discount ? parseFloat(req.body.discount) : null,
        stock: parseInt(req.body.stock || 0),
        category: req.body.category,
        description: req.body.desc || '',
        images: imageUrls,
        image: imageUrls[0] || 'https://via.placeholder.com/300?text=No+Image'
    };
    products.push(newProduct);
    saveFileData('products.json', products);
    res.json(newProduct);
});
app.put('/api/products/:id', upload.array('images', 5), (req, res) => {
    let products = getFileData('products.json');
    const index = products.findIndex(p => p.id === req.params.id);
    if (index > -1) {
        if (req.body.stock !== undefined) products[index].stock = parseInt(req.body.stock);
        if (req.body.price !== undefined) products[index].price = parseFloat(req.body.price);
        
        if (req.body.discountPrice) products[index].discountPrice = parseFloat(req.body.discountPrice);
        if (req.body.clearDiscount === 'true') products[index].discountPrice = null;
        
        if (req.files && req.files.length > 0) {
            if (!products[index].images) products[index].images = [products[index].image];
            req.files.forEach(f => products[index].images.push(`./images/${f.filename}`));
            
            // Swap placeholder main if necessary
            if (products[index].image && products[index].image.includes('placeholder')) {
                products[index].image = `./images/${req.files[0].filename}`;
            }
        }
        
        saveFileData('products.json', products);
        res.json({ success: true, product: products[index] });
    } else {
        res.status(404).json({ success: false, message: 'Product not found' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    let products = getFileData('products.json').filter(p => p.id !== req.params.id);
    saveFileData('products.json', products);
    res.json({ success: true });
});

// Orders CRUD
app.get('/api/orders', (req, res) => res.json(getFileData('orders.json')));
app.put('/api/orders/:id', (req, res) => {
    let orders = getFileData('orders.json');
    const index = orders.findIndex(o => o.id === req.params.id);
    if (index > -1) {
        orders[index] = { ...orders[index], ...req.body };
        saveFileData('orders.json', orders);
        res.json(orders[index]);
    } else {
        res.status(404).json({error: "Order not found"});
    }
});

// Customers
app.get('/api/customers', (req, res) => res.json(getFileData('customers.json')));

// Promotions
app.get('/api/promotions', (req, res) => res.json(getFileData('promotions.json')));
app.post('/api/promotions', (req, res) => {
    let promos = getFileData('promotions.json');
    const newP = { id: Date.now().toString(), ...req.body };
    promos.push(newP);
    saveFileData('promotions.json', promos);
    res.json(newP);
});
app.delete('/api/promotions/:id', (req, res) => {
    let promos = getFileData('promotions.json').filter(p => p.id !== req.params.id);
    saveFileData('promotions.json', promos);
    res.json({ success: true });
});

// --- AUTH & CRM MERGE LOGIC ---
const mergeCustomer = (profile) => {
    let customers = getFileData('customers.json');
    let existing = null;
    
    if (profile.email) existing = customers.find(c => c.email === profile.email);
    if (!existing && profile.phone) existing = customers.find(c => c.phone === profile.phone);
    
    if (existing) {
        if (!existing.email && profile.email) existing.email = profile.email;
        if (!existing.phone && profile.phone) existing.phone = profile.phone;
        if (profile.name && (!existing.name || existing.name === 'Guest')) existing.name = profile.name;
    } else {
        existing = { id: 'c' + Date.now(), name: profile.name || 'Guest', email: profile.email || '', phone: profile.phone || '', spend: 0, orders: 0 };
        customers.push(existing);
    }
    saveFileData('customers.json', customers);
    return existing;
};

let otpStore = {};

app.post('/api/auth/otp', (req, res) => {
    const { phone } = req.body;
    otpStore[phone] = "1234"; // Mock OTP
    res.json({ success: true, message: 'OTP sent' });
});

app.post('/api/auth/verify', (req, res) => {
    const { phone, otp } = req.body;
    if (otpStore[phone] === otp) {
        delete otpStore[phone];
        res.json({ success: true, customer: mergeCustomer({ phone }) });
    } else {
        res.status(401).json({ success: false, message: 'Invalid OTP' });
    }
});

app.post('/api/auth/google', (req, res) => {
    res.json({ success: true, customer: mergeCustomer(req.body) });
});

app.post('/api/auth/register', (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    let customers = getFileData('customers.json');
    
    if (customers.find(c => c.email === email)) {
        return res.status(400).json({ success: false, message: 'Email address is already in use.' });
    }
    
    const newCustomer = {
        id: 'c' + Date.now(),
        name: `${firstName} ${lastName}`.trim(),
        email,
        password, // Not hashed purely for local demonstration purposes
        phone: '',
        spend: 0,
        orders: 0
    };
    customers.push(newCustomer);
    saveFileData('customers.json', customers);
    res.json({ success: true, customer: newCustomer });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    let customers = getFileData('customers.json');
    const customer = customers.find(c => c.email === email && c.password === password);
    if (customer) {
        res.json({ success: true, customer });
    } else {
        res.status(401).json({ success: false, message: 'Invalid email or incorrect password.' });
    }
});

// --- CHECKOUT MUTATION ---
app.post('/api/orders/checkout', (req, res) => {
    const payload = req.body;
    let customers = getFileData('customers.json');
    let orders = getFileData('orders.json');
    let products = getFileData('products.json');
    
    // Validate Stock First
    let stockValid = true;
    let outOfStockItem = '';
    payload.cart.forEach(cartItem => {
        let p = products.find(x => x.id === cartItem.id);
        if(!p || (p.stock || 0) < cartItem.qty) {
            stockValid = false;
            outOfStockItem = cartItem.title;
        }
    });
    
    if(!stockValid) {
        return res.status(400).json({ success: false, message: `Payment Rejected: ${outOfStockItem} is currently out of stock or insufficient quantity.` });
    }
    
    // Deduct Stock
    payload.cart.forEach(cartItem => {
        let p = products.find(x => x.id === cartItem.id);
        if(p) p.stock -= cartItem.qty;
    });
    
    let customer = customers.find(c => c.email === payload.customer.email);
    if (!customer && payload.customer.phone) customer = customers.find(c => c.phone === payload.customer.phone);
    
    if (customer) {
        if (!customer.phone) customer.phone = payload.customer.phone;
        if (!customer.shippingAddress && payload.customer.address.street) customer.shippingAddress = payload.customer.address;
        customer.spend = (customer.spend || 0) + payload.total;
        customer.orders = (customer.orders || 0) + 1;
    } else {
        customer = {
            id: 'c' + Date.now(),
            name: `${payload.customer.firstName} ${payload.customer.lastName}`.trim(),
            email: payload.customer.email,
            phone: payload.customer.phone,
            password: '', 
            shippingAddress: payload.customer.address.street ? payload.customer.address : null,
            spend: payload.total,
            orders: 1
        };
        customers.push(customer);
    }
    
    const newOrder = {
        id: `ORD-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        customerId: customer.id,
        customerName: customer.name,
        total: payload.total,
        status: 'Payment Pending',
        fulfillment: 'Processing',
        items: payload.cart,
        shippingAddress: payload.customer.address,
        source: 'Online - Web',
        paymentMode: 'Credit Card / UPI Gateway'
    };
    orders.push(newOrder);
    
    saveFileData('products.json', products);
    saveFileData('customers.json', customers);
    saveFileData('orders.json', orders);
    
    res.json({ success: true, order: newOrder, customer });
});

// --- POS MANUAL ENTRY MUTATION ---
app.post('/api/admin/pos-order', (req, res) => {
    const payload = req.body; 
    let customers = getFileData('customers.json');
    let orders = getFileData('orders.json');
    let products = getFileData('products.json');
    
    let product = products.find(p => p.id === payload.productId);
    if(!product) return res.status(400).json({ success: false, message: 'Product not found' });
    if((product.stock || 0) < payload.qty) return res.status(400).json({ success: false, message: `Insufficient inventory. Only ${product.stock} remaining.` });
    
    product.stock -= payload.qty;
    
    let customer = customers.find(c => c.id === payload.customerId);
    if (!customer) {
        customer = {
            id: 'c' + Date.now(),
            name: payload.customerName || 'Walk-in Customer',
            email: '', phone: payload.customerPhone || '', password: '', 
            shippingAddress: null, spend: 0, orders: 0
        };
        customers.push(customer);
    }
    
    const totalPaid = Number(payload.overridePrice) * Number(payload.qty);
    customer.spend = (customer.spend || 0) + totalPaid;
    customer.orders = (customer.orders || 0) + 1;
    
    const newOrder = {
        id: `POS-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        customerId: customer.id,
        customerName: customer.name,
        total: totalPaid,
        status: 'Paid',
        fulfillment: payload.fulfillment,
        items: [{ id: product.id, title: product.title, price: Number(payload.overridePrice), qty: Number(payload.qty), image: product.image }],
        shippingAddress: null,
        source: 'Offline - Manual',
        paymentMode: payload.paymentMode
    };
    orders.push(newOrder);
    
    saveFileData('products.json', products);
    saveFileData('customers.json', customers);
    saveFileData('orders.json', orders);
    
    res.json({ success: true, order: newOrder });
});

app.get('/api/orders/customer/:id', (req, res) => {
    const orders = getFileData('orders.json');
    res.json(orders.filter(o => o.customerId === req.params.id).reverse());
});

app.listen(PORT, () => console.log(`Zewar Heavy-Duty Admin API running on port ${PORT}`));

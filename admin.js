const API = (window.BACKEND_URL || '') + '/api';
let chartInstance;

window.login = function() {
    if (document.getElementById('admin-password').value === 'zewar123') {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'flex';
        initDashboard();
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

window.switchTab = function(tabId, event) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    
    if(event) {
        event.currentTarget.classList.add('active');
        document.getElementById('page-title').textContent = event.currentTarget.textContent.trim() + ' Management';
        if(tabId === 'dashboard') document.getElementById('page-title').textContent = 'Dashboard Overview';
    }
}

async function initDashboard() {
    try {
        const res = await fetch(`${API}/dashboard`);
        const stats = await res.json();
        
        document.getElementById('kpi-revenue').textContent = `₹${stats.revenue.toLocaleString('en-IN')}`;
        document.getElementById('kpi-orders').textContent = stats.activeOrders;
        document.getElementById('kpi-sales').textContent = stats.totalSales;
        document.getElementById('kpi-lowstock').textContent = stats.lowStock;

        // Render Chart
        const ctx = document.getElementById('salesChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        
        let dynamicData = [120, 290, 150, stats.revenue > 150 ? stats.revenue : 400]; // Dummy curve
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Revenue ($)',
                    data: dynamicData,
                    borderColor: '#d4af37',
                    backgroundColor: 'rgba(212, 175, 55, 0.1)',
                    tension: 0.4, fill: true,
                    pointBackgroundColor: '#d4af37',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#d4af37',
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true, grid: { color: '#2d313a' }, ticks: {color: '#9aa0a6'} }, 
                    x: { grid: { color: '#2d313a' }, ticks: {color: '#9aa0a6'} } 
                }, 
                plugins: { legend: { display: false } }
            }
        });

        loadProducts();
        loadOrders();
        loadCustomers();
        loadPromos();
    } catch(err) {
        console.error("Dashboard init failed", err);
    }
}

let currentProducts = [];
async function loadProducts() {
    try {
        const res = await fetch(`${API}/products`);
        const prods = await res.json();
        currentProducts = [...prods];
        const tbody = document.getElementById('products-tbody');
        tbody.innerHTML = prods.reverse().map(p => `
            <tr>
                <td><img src="${(p.images && p.images[0]) || p.image || 'https://via.placeholder.com/48'}" width="48" height="48" style="border-radius:6px; object-fit:cover;"></td>
                <td>
                    <strong style="display:block; margin-bottom:4px; color:var(--text-main);">${p.title}</strong>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${p.category}</span>
                </td>
                <td><span style="background:var(--bg-input); padding:4px 8px; border-radius:4px; font-size:0.85rem;">${p.sku || 'N/A'}</span></td>
                <td>${p.stock > 0 ? `<span style="color:var(--success)">${p.stock} in stock</span>` : '<span class="out-of-stock">Out of Stock</span>'}</td>
                <td><strong>₹${p.price.toLocaleString('en-IN')}</strong></td>
                <td>
                    <button class="btn" style="background:var(--primary-color); color:#fff; padding:6px 12px; font-size:0.8rem; margin-right:5px;" onclick="openEditProduct('${p.id}')" title="Quick Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn" style="background:var(--danger); color:#fff; padding:6px 12px; font-size:0.8rem;" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch(err) { console.error("Could not load products", err); }
}

async function loadOrders() {
    try {
        const res = await fetch(`${API}/orders`);
        const orders = await res.json();
        const tbody = document.getElementById('orders-tbody');
        tbody.innerHTML = orders.reverse().map(o => `
            <tr>
                <td><strong style="color:var(--accent)">${o.id}</strong></td>
                <td>${new Date(o.date).toLocaleDateString()}</td>
                <td>${o.customerName}</td>
                <td><span style="font-size:0.85rem; color:#aaa; font-weight:bold; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:3px; border:1px solid #444;"><i class="${o.source === 'Offline - Manual' ? 'fas fa-store' : 'fas fa-globe'}" style="margin-right:4px;"></i>${o.source || 'Online - Web'}</span></td>
                <td><span style="font-size:0.85rem; color:#fff;">${o.paymentMode || 'Credit Card / UPI'}</span></td>
                <td><strong>₹${o.total.toLocaleString('en-IN')}</strong></td>
                <td><span style="color:${o.status==='Paid'?'var(--success)':'var(--accent)'}; background:rgba(46,204,113,0.1); padding:4px 8px; border-radius:4px; font-size:0.85rem;">${o.status}</span></td>
                <td style="display:flex; align-items:center; gap:10px; border-bottom:none; margin-top:5px;">
                    <select class="status-dropdown" onchange="updateOrderStatus('${o.id}', this.value)">
                        <option ${o.fulfillment === 'Processing' ? 'selected':''}>Processing</option>
                        <option ${o.fulfillment === 'Shipped' ? 'selected':''}>Shipped</option>
                        <option ${o.fulfillment === 'Out for Delivery' ? 'selected':''}>Out for Delivery</option>
                        <option ${o.fulfillment === 'Delivered' ? 'selected':''}>Delivered</option>
                        <option ${o.fulfillment === 'Cancelled' ? 'selected':''}>Cancelled</option>
                    </select>
                    ${o.fulfillment === 'Shipped' && !o.tracking ? `<input type="text" class="tracking-input" placeholder="Tracking #" onblur="updateOrderTracking('${o.id}', this.value)">` : (o.tracking ? `<span style="font-size:0.85rem; color:var(--info); display:block;">Trk: ${o.tracking}</span>` : '')}
                </td>
            </tr>
        `).join('');
    } catch(err) {}
}

window.updateOrderStatus = async function(id, status) {
    await fetch(`${API}/orders/${id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fulfillment: status})});
    loadOrders();
    initDashboard(); // Refresh active orders count
}
window.updateOrderTracking = async function(id, tracking) {
    if(tracking.trim()) {
        await fetch(`${API}/orders/${id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({tracking})});
        loadOrders();
    }
}

async function loadCustomers() {
    try {
        const res = await fetch(`${API}/customers`);
        const custs = await res.json();
        document.getElementById('customers-tbody').innerHTML = custs.reverse().map(c => `
            <tr>
                <td><div style="display:flex; align-items:center; gap:10px;"><i class="fas fa-user-circle" style="font-size:1.5rem; color:var(--text-muted)"></i> <strong>${c.name}</strong></div></td>
                <td>${c.email || 'N/A'}</td><td>${c.phone || 'N/A'}</td>
                <td><strong style="color:var(--success);">₹${(c.spend || 0).toLocaleString('en-IN')}</strong></td>
                <td><span style="background:var(--bg-input); padding:4px 10px; border-radius:12px; font-size:0.85rem;">${c.orders || 0} orders</span></td>
            </tr>
        `).join('');
    } catch(err){ console.error("Error loading CRM data", err); }
}

async function loadPromos() {
    try {
        const res = await fetch(`${API}/promotions`);
        const promos = await res.json();
        document.getElementById('promos-tbody').innerHTML = promos.reverse().map(p => `
            <tr>
                <td><span style="background:rgba(212,175,55,0.1); color:var(--accent); padding:6px 12px; border-radius:4px; font-weight:bold; letter-spacing:1px; border:1px dashed var(--accent);">${p.code}</span></td>
                <td style="text-transform:capitalize;">${p.type}</td>
                <td><strong style="font-size:1.1rem;">${p.type==='percentage'?p.value+'%':'-$'+p.value}</strong></td>
                <td>${p.minSpend > 0 ? '$'+p.minSpend : 'None'}</td>
                <td>${p.expiry}</td>
                <td><button class="btn" style="background:var(--danger); color:#fff; padding:6px 12px; font-size:0.8rem;" onclick="deletePromo('${p.id}')"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
    } catch(err){}
}

// Submissions
document.getElementById('add-product-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Saving...'; btn.disabled = true;
    const fd = new FormData();
    ['title','sku','category','stock','price','cost','discount','desc'].forEach(id => {
        const val = document.getElementById('p-'+id).value;
        if(val) fd.append(id.replace('p-',''), val);
    });
    
    const files = document.getElementById('p-images').files;
    for(let i=0; i<files.length; i++) fd.append('images', files[i]);

    try {
        await fetch(`${API}/products`, { method: 'POST', body: fd });
        document.getElementById('product-modal').style.display='none';
        e.target.reset(); btn.textContent = 'Save Product into Inventory'; btn.disabled = false;
        loadProducts();
        initDashboard(); // Update low stock etc
    } catch(err) {
        console.error(err);
        btn.textContent = 'Save Product into Inventory'; btn.disabled = false;
        alert('Failed to save product');
    }
};

window.openEditProduct = function(id) {
    const p = currentProducts.find(x => x.id === id);
    if (p) {
        document.getElementById('edit-p-id').value = p.id;
        document.getElementById('edit-p-stock').value = p.stock || 0;
        document.getElementById('edit-p-price').value = p.price || 0;
        document.getElementById('edit-p-discount').value = p.discountPrice || p.price;
        
        const imgContainer = document.getElementById('edit-p-existing-images');
        imgContainer.innerHTML = '';
        if (p.images && p.images.length > 0) {
            p.images.forEach(img => {
                imgContainer.innerHTML += `
                    <div style="position:relative; display:inline-block; border:1px solid #444; border-radius:4px; overflow:hidden;">
                        <img src="${img}" width="80" height="80" style="object-fit:cover; display:block;">
                        <button type="button" onclick="deleteProductImage('${p.id}', '${img}')" style="position:absolute; top:2px; right:2px; background:var(--danger); color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer;" title="Delete Image">&times;</button>
                    </div>
                `;
            });
        } else {
            imgContainer.innerHTML = '<span style="color:#aaa; font-size:0.85rem;">No images available</span>';
        }

        document.getElementById('edit-product-modal').style.display = 'flex';
    }
}

window.deleteProductImage = async function(productId, imageUrl) {
    if(!confirm('Are you sure you want to remove this image?')) return;
    try {
        const res = await fetch(`${API}/products/${productId}/image`, {
            method: 'DELETE',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image: imageUrl })
        });
        const data = await res.json();
        if(data.success) {
            loadProducts();
            const p = currentProducts.find(x => x.id === productId);
            if (p) {
                p.images = p.images.filter(i => i !== imageUrl);
                if(p.image === imageUrl) p.image = p.images[0] || 'https://via.placeholder.com/300?text=No+Image';
                openEditProduct(productId);
            }
        } else alert('Failed to delete image: ' + data.message);
    } catch(err) {
        alert('Error deleting image');
    }
}

document.getElementById('edit-product-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.textContent = 'Saving...'; btn.disabled = true;
    const id = document.getElementById('edit-p-id').value;
    
    // Switch to FormData payload to wrap binaries
    const fd = new FormData();
    fd.append('stock', document.getElementById('edit-p-stock').value);
    fd.append('price', document.getElementById('edit-p-price').value);
    
    const dp = document.getElementById('edit-p-discount').value;
    const bp = document.getElementById('edit-p-price').value;
    if (dp && dp !== bp) {
        fd.append('discountPrice', dp);
    } else {
        fd.append('clearDiscount', 'true');
    }
    
    const files = document.getElementById('edit-p-images').files;
    for(let i=0; i<files.length; i++) fd.append('images', files[i]);

    try {
        const res = await fetch(`${API}/products/${id}`, {
            method: 'PUT',
            body: fd
        });
        const data = await res.json();
        if(data.success) {
            document.getElementById('edit-product-modal').style.display = 'none';
            document.getElementById('edit-p-images').value = ''; // Clean up buffer
            loadProducts();
            initDashboard();
        } else alert('Failed to update product');
    } catch(err) { alert('Error updating product'); }
    btn.textContent = 'Save Changes'; btn.disabled = false;
}

document.getElementById('add-promo-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = { 
        code: document.getElementById('pr-code').value.toUpperCase(), 
        type: document.getElementById('pr-type').value, 
        value: parseFloat(document.getElementById('pr-value').value), 
        minSpend: parseFloat(document.getElementById('pr-min').value||0), 
        expiry: document.getElementById('pr-expiry').value 
    };
    await fetch(`${API}/promotions`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    document.getElementById('promo-modal').style.display='none';
    e.target.reset();
    loadPromos();
};

window.deleteProduct = async (id) => { if(confirm('Delete product?')) { await fetch(`${API}/products/${id}`,{method:'DELETE'}); loadProducts(); initDashboard();} };
window.deletePromo = async (id) => { if(confirm('Delete promo?')) { await fetch(`${API}/promotions/${id}`,{method:'DELETE'}); loadPromos(); } };

// Omnichannel POS
let posProductsRaw = [];
window.openPOSModal = async function() {
    document.getElementById('pos-modal-overlay').classList.add('active');
    document.getElementById('pos-modal').style.display = 'block';
    
    const custRes = await fetch(`${API}/customers`);
    const customers = await custRes.json();
    let custHTML = '<option value="walk_in">Walk-in Customer (New)</option>';
    customers.forEach(c => custHTML += `<option value="${c.id}">${c.name} (${c.phone || c.email || 'No contact'})</option>`);
    document.getElementById('pos-customer').innerHTML = custHTML;
    
    const prodRes = await fetch(`${API}/products`);
    posProductsRaw = await prodRes.json();
    let prodHTML = '<option value="" disabled selected>-- Select Item --</option>';
    posProductsRaw.forEach(p => {
        prodHTML += `<option value="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.title} - ${p.stock} in stock - ₹${(p.discountPrice || p.price).toLocaleString('en-IN')}</option>`;
    });
    document.getElementById('pos-product').innerHTML = prodHTML;
}

window.closePOSModal = function() {
    document.getElementById('pos-modal-overlay').classList.remove('active');
    document.getElementById('pos-modal').style.display = 'none';
}

window.posProductSelected = function() {
    const pId = document.getElementById('pos-product').value;
    const prod = posProductsRaw.find(p => p.id === pId);
    if(prod) document.getElementById('pos-price').value = prod.discountPrice || prod.price;
}

window.submitPOSOrder = async function() {
    const payload = {
        customerId: document.getElementById('pos-customer').value === 'walk_in' ? '' : document.getElementById('pos-customer').value,
        customerName: document.getElementById('pos-new-cname').value,
        customerPhone: document.getElementById('pos-new-cphone').value,
        productId: document.getElementById('pos-product').value,
        qty: document.getElementById('pos-qty').value,
        overridePrice: document.getElementById('pos-price').value,
        paymentMode: document.getElementById('pos-payment').value,
        fulfillment: document.getElementById('pos-fulfillment').value
    };
    
    if(!payload.productId || !payload.qty || !payload.overridePrice) return alert("Select product, qty and price!");
    
    try {
        const res = await fetch(`${API}/admin/pos-order`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            alert('POS Order securely finalized and inventory adjusted!');
            closePOSModal();
            loadOrders();
            loadProducts();
            initDashboard();
        } else alert(data.message);
    } catch(err) { alert('Error processing POS transaction'); }
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('change', (e) => {
        if(e.target.id === 'pos-customer') {
            document.getElementById('pos-new-customer-fields').style.display = e.target.value === 'walk_in' ? 'flex' : 'none';
        }
    });
});

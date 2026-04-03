document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const menuToggle = document.querySelector('#mobile-menu');
    const navMenu = document.querySelector('.nav-menu');

    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('is-active');
        navMenu.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    const navLinks = document.querySelectorAll('.nav-links');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('is-active');
            navMenu.classList.remove('active');
        });
    });

    // Sticky Navbar shadow on scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Reveal animations on scroll
    const revealElements = document.querySelectorAll('.reveal-fade, .reveal-up, .about-text, .about-image');
    
    // Add initial classes for old elements
    document.querySelectorAll('.about-text, .about-image').forEach(el => {
        el.classList.add('reveal-up');
    });

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 100;

        document.querySelectorAll('.reveal-fade, .reveal-up').forEach(el => {
            const elementTop = el.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                el.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    // Trigger once on load
    setTimeout(revealOnScroll, 100);

    // Fetch Products from Admin Backend
    const API_URL = (window.BACKEND_URL || '') + '/api/products';
    const productsGrid = document.getElementById('dynamic-products-grid');

    if (productsGrid) {
        fetch(API_URL)
            .then(res => res.json())
            .then(products => {
                const urlParams = new URLSearchParams(window.location.search);
                const categoryFilter = urlParams.get('category');
                
                const shopTitle = document.getElementById('shop-page-title');
                if (shopTitle && categoryFilter) {
                    shopTitle.textContent = categoryFilter;
                } else if (shopTitle) {
                    shopTitle.textContent = "All Products";
                }

                if (categoryFilter) {
                    products = products.filter(p => p.category === categoryFilter);
                }

                if (products.length === 0) {
                    productsGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#888; padding:2rem;">No products found in this category.</p>';
                    return;
                }
                
                productsGrid.innerHTML = '';
                // Render products in reverse chronological order
                products.reverse().forEach(p => {
                    const priceHTML = p.discountPrice 
                        ? `<span class="original-price" style="text-decoration:line-through; color:#999; margin-right:10px;">₹${p.price.toLocaleString('en-IN')}</span>
                           <span class="sale-price" style="color:#e74c3c; font-weight:bold;">₹${p.discountPrice.toLocaleString('en-IN')}</span>`
                        : `<span style="font-weight:bold;">₹${p.price.toLocaleString('en-IN')}</span>`;

                    const card = document.createElement('div');
                    card.className = 'product-card';
                    card.style.cssText = 'background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 5px 20px rgba(0,0,0,0.06); transition:transform 0.3s ease; text-align:center; padding-bottom:1.5rem; border-top: 3px solid transparent;';
                    
                    card.onmouseover = () => {
                        card.style.transform = 'translateY(-10px)';
                        card.style.borderColor = 'var(--secondary-color)';
                    };
                    card.onmouseout = () => {
                        card.style.transform = 'translateY(0)';
                        card.style.borderColor = 'transparent';
                    };

                    const stockBlock = p.stock <= 0 ? 
                        `<button class="btn btn-outline" style="padding: 10px 25px; font-size:0.95rem; width:100%; border:1px solid #ccc; color:#999; cursor:not-allowed;" disabled>Sold Out</button>` :
                        `<button class="btn btn-primary" style="padding: 10px 25px; font-size:0.95rem; width:100%; border:none; cursor:pointer;" onclick="addToCart('${p.id}', '${p.title.replace(/'/g, "\\'")}', ${p.discountPrice || p.price}, '${p.image}', ${p.stock})"><i class="fas fa-shopping-bag"></i> Add to Cart</button>`;

                    card.innerHTML = `
                        <div class="p-img-wrapper" style="height:350px; overflow:hidden; background:#1a1a1a; display:flex; justify-content:center; align-items:center; cursor:pointer;" onclick="window.location.href='product.html?id=${p.id}'">
                            <img src="${p.image}" alt="${p.title}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.5s ease;" onerror="this.src='https://via.placeholder.com/350?text=No+Image'; this.style.width='auto'; this.style.height='auto';">
                        </div>
                        <div style="padding: 1.5rem 1.5rem 0;">
                            <span style="font-size:0.8rem; text-transform:uppercase; color:var(--secondary-color); letter-spacing:1px; font-weight:bold;">${p.category}</span>
                            <a href="product.html?id=${p.id}" style="text-decoration:none;"><h3 style="margin: 0.5rem 0; font-family:'Playfair Display', serif; color:var(--primary-color); font-size: 1.5rem; transition:0.2s;">${p.title}</h3></a>
                            <div style="margin-bottom: 1.2rem; font-size: 1.1rem; color:#444;">${priceHTML}</div>
                            ${stockBlock}
                        </div>
                    `;
                    productsGrid.appendChild(card);
                });
            })
            .catch(err => {
                console.error("Error loading products:", err);
                productsGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#e74c3c; padding:2rem;">Unable to connect to the store database. Is the server running?</p>';
            });
    }

    // --- Shopping Cart Injection & Logic ---
    const cartHTML = `
        <div id="cart-overlay" class="cart-overlay"></div>
        <div id="cart-drawer" class="cart-drawer">
            <div class="cart-header">
                <h2>Your Cart</h2>
                <span id="close-cart" class="close-cart">&times;</span>
            </div>
            <div id="cart-items" class="cart-items">
                <!-- Items will be injected here -->
            </div>
            <div class="cart-footer">
                <div class="cart-subtotal">
                    <span>Subtotal</span>
                    <span id="cart-total-price">₹0</span>
                </div>
                <button class="btn btn-primary proceed-btn" onclick="window.location.href='checkout.html'">Proceed to Checkout</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', cartHTML);

    const cartDrawer = document.getElementById('cart-drawer');
    const cartOverlay = document.getElementById('cart-overlay');
    const closeCartBtn = document.getElementById('close-cart');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalPrice = document.getElementById('cart-total-price');
    
    let cart = JSON.parse(localStorage.getItem('zewar_cart') || '[]');

    function openCart() {
        cartDrawer.classList.add('open');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; 
        renderCart();
    }

    function closeCart() {
        cartDrawer.classList.remove('open');
        cartOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    closeCartBtn.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    // Bind all cart icons
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.cart-icon-trigger');
        if (trigger) {
            e.preventDefault();
            openCart();
        }
    });

    window.addToCart = function(id, title, price, image, maxStock) {
        const existing = cart.find(item => item.id === id);
        if (existing) {
            if (maxStock !== undefined && existing.qty >= maxStock) {
                alert(`You already have ${existing.qty} of this item in your cart, which is all we have in stock!`);
                openCart();
                return;
            }
            existing.qty = (existing.qty || 1) + 1;
            existing.maxStock = maxStock;
        } else {
            if (maxStock !== undefined && maxStock <= 0) {
                alert(`Sorry, this item is out of stock.`);
                return;
            }
            cart.push({ id, title, price: parseFloat(price), image, qty: 1, maxStock: maxStock });
        }
        localStorage.setItem('zewar_cart', JSON.stringify(cart));
        openCart();
    };

    window.updateQty = function(id, delta) {
        const item = cart.find(i => i.id === id);
        if (item) {
            const newQty = item.qty + delta;
            if (delta > 0 && item.maxStock !== undefined && newQty > item.maxStock) {
                alert(`You already have ${item.qty} of this item in your cart, which is all we have in stock!`);
                return;
            }
            item.qty = newQty;
            if (item.qty <= 0) {
                cart = cart.filter(i => i.id !== id);
            }
            localStorage.setItem('zewar_cart', JSON.stringify(cart));
            renderCart();
        }
    };

    window.removeFromCart = function(id) {
        cart = cart.filter(i => i.id !== id);
        localStorage.setItem('zewar_cart', JSON.stringify(cart));
        renderCart();
    };

    function renderCart() {
        cartItemsContainer.innerHTML = '';
        let subtotal = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-box-open"></i>
                    <p style="font-size:1.1rem; color:#444; margin-bottom:1.5rem; font-family:'Playfair Display', serif;">Your jewelry box is currently empty</p>
                    <button class="btn btn-primary" style="padding: 10px 30px;" onclick="closeCart()">Continue Shopping</button>
                </div>
            `;
            cartTotalPrice.textContent = '₹0';
            return;
        }

        cart.forEach(item => {
            subtotal += item.price * item.qty;
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.title}" class="cart-item-img" onerror="this.src='https://via.placeholder.com/90?text=No+Image'">
                <div class="cart-item-details">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 10px;">
                        <h4 class="cart-item-title">${item.title}</h4>
                        <span class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
                    </div>
                    <div class="cart-item-actions">
                        <div class="qty-controls">
                            <span class="qty-btn" onclick="updateQty('${item.id}', -1)">−</span>
                            <span class="qty-num">${item.qty || 1}</span>
                            <span class="qty-btn" onclick="updateQty('${item.id}', 1)">+</span>
                        </div>
                        <button class="remove-item" onclick="removeFromCart('${item.id}')" title="Remove"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `;
            cartItemsContainer.appendChild(itemEl);
        });
        
        cartTotalPrice.textContent = '₹' + subtotal.toLocaleString('en-IN');
    }
    
    // --- Auth Modal Injection & Logic ---
    const authHTML = `
        <div id="auth-overlay" class="cart-overlay"></div>
        <div id="auth-modal" class="auth-modal">
            <span id="close-auth" class="close-cart" style="right:1rem; top:1rem;">&times;</span>
            <div class="auth-box">
                <h2 style="font-family:var(--font-heading); margin-bottom:1.5rem; color:var(--primary-color);">Welcome to Zewar</h2>
                
                <button class="btn google-btn" onclick="googleLogin()">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="G" style="width:20px; height:20px;">
                    Continue with Google
                </button>
                
                <div class="auth-divider"><span>OR</span></div>
                
                <!-- Step 1: Phone Input -->
                <div id="auth-step-1">
                    <label style="display:block; text-align:left; font-size:0.85rem; color:#666; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">Mobile Number</label>
                    <div style="display:flex; margin-bottom:1.5rem;">
                        <select id="country-code" style="padding:12px; background:#f9f9f9; border:1px solid #ddd; border-right:none; border-radius:4px 0 0 4px; outline:none;">
                            <option value="+91">+91 (IN)</option>
                            <option value="+1">+1 (US)</option>
                            <option value="+44">+44 (UK)</option>
                        </select>
                        <input type="tel" id="phone-number" placeholder="Enter mobile number" style="flex:1; padding:12px; border:1px solid #ddd; border-radius:0 4px 4px 0; outline:none;">
                    </div>
                    <button class="btn btn-primary" style="width:100%; padding:14px; font-size:1.05rem; margin-bottom:1rem;" onclick="sendOTP()">Send OTP</button>
                </div>

                <!-- Step 2: OTP Entry -->
                <div id="auth-step-2" style="display:none;">
                    <p style="color:#555; margin-bottom:1rem; font-size:0.95rem;">Enter the 4-digit code sent to <br><strong id="display-phone"></strong></p>
                    <div class="otp-container">
                        <input type="text" class="otp-box" maxlength="1" onkeyup="otpJump(this, event)">
                        <input type="text" class="otp-box" maxlength="1" onkeyup="otpJump(this, event)">
                        <input type="text" class="otp-box" maxlength="1" onkeyup="otpJump(this, event)">
                        <input type="text" class="otp-box" maxlength="1" onkeyup="otpJump(this, event)">
                    </div>
                    <button class="btn btn-primary" style="width:100%; padding:14px; font-size:1.05rem; margin-bottom:1rem;" onclick="verifyOTP()">Verify & Login</button>
                    <p style="font-size:0.85rem; color:#888;"><span id="otp-timer">Resend OTP in 00:30</span></p>
                </div>

                <div class="auth-fallback" style="margin-top:2rem;">
                    <a href="#" onclick="toggleAuthForms('login')" style="color:var(--secondary-color); font-size:0.9rem; text-decoration:none; font-weight:bold;">Continue with Email & Password</a>
                </div>
                
                <!-- Sign In Form -->
                <div id="auth-email-login" style="display:none; margin-top:1.5rem; text-align:left;">
                    <h3 style="color:var(--primary-color); font-family:var(--font-heading); margin-bottom:1rem; text-align:center;">Sign In Securely</h3>
                    
                    <label style="font-size:0.85rem; color:#666; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">Email Address</label>
                    <input type="email" id="login-email" class="auth-input" placeholder="Enter your email" onkeyup="validateEmail(this)">
                    
                    <label style="font-size:0.85rem; color:#666; font-weight:bold; letter-spacing:1px; text-transform:uppercase; margin-top:10px; display:block;">Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="login-password" class="auth-input" placeholder="Enter your password">
                        <i class="fas fa-eye toggle-password" onclick="togglePassword('login-password', this)"></i>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin:10px 0 20px;">
                        <label style="font-size:0.85rem; color:#666; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" id="remember-me"> Remember Me
                        </label>
                        <a href="#" style="color:var(--secondary-color); font-size:0.85rem; text-decoration:none;">Forgot Password?</a>
                    </div>

                    <button class="btn btn-primary" style="width:100%; padding:14px; font-size:1.05rem;" onclick="processEmailLogin()">Sign In</button>
                    
                    <p style="text-align:center; font-size:0.9rem; color:#666; margin-top:15px;">
                        New to Zewar? <a href="#" onclick="toggleAuthForms('signup')" style="color:var(--secondary-color); font-weight:bold; text-decoration:none;">Create an Account</a>
                    </p>
                </div>

                <!-- Sign Up Form -->
                <div id="auth-email-signup" style="display:none; margin-top:1.5rem; text-align:left;">
                    <h3 style="color:var(--primary-color); font-family:var(--font-heading); margin-bottom:1rem; text-align:center;">Create an Account</h3>
                    
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; color:#666; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">First Name</label>
                            <input type="text" id="reg-fname" class="auth-input" placeholder="First">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; color:#666; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">Last Name</label>
                            <input type="text" id="reg-lname" class="auth-input" placeholder="Last">
                        </div>
                    </div>

                    <label style="font-size:0.85rem; color:#666; font-weight:bold; letter-spacing:1px; text-transform:uppercase; margin-top:10px; display:block;">Email Address</label>
                    <input type="email" id="reg-email" class="auth-input" placeholder="Enter valid email" onkeyup="validateEmail(this)">
                    
                    <label style="font-size:0.85rem; color:#666; font-weight:bold; letter-spacing:1px; text-transform:uppercase; margin-top:10px; display:block;">Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="reg-password" class="auth-input" placeholder="Minimum 6 characters">
                        <i class="fas fa-eye toggle-password" onclick="togglePassword('reg-password', this)"></i>
                    </div>

                    <label style="font-size:0.85rem; color:#666; font-weight:bold; letter-spacing:1px; text-transform:uppercase; margin-top:10px; display:block;">Confirm Password</label>
                    <div class="password-wrapper">
                        <input type="password" id="reg-confirm" class="auth-input" placeholder="Must match password">
                        <i class="fas fa-eye toggle-password" onclick="togglePassword('reg-confirm', this)"></i>
                    </div>

                    <button class="btn btn-primary" style="width:100%; padding:14px; font-size:1.05rem; margin-top:20px;" onclick="processRegistration()">Create Account</button>
                    
                    <p style="text-align:center; font-size:0.9rem; color:#666; margin-top:15px;" id="auth-back-login">
                        Already have an account? <a href="#" onclick="toggleAuthForms('login')" style="color:var(--secondary-color); font-weight:bold; text-decoration:none;">Sign In</a>
                    </p>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', authHTML);

    const authModal = document.getElementById('auth-modal');
    const authOverlay = document.getElementById('auth-overlay');
    const closeAuthBtn = document.getElementById('close-auth');
    
    let authRequired = false;

    function openAuth(required = false) {
        authRequired = required;
        authModal.classList.add('open');
        authOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (required) {
            // Show a welcoming gate message
            const h2 = authModal.querySelector('.auth-box h2');
            if (h2) h2.textContent = 'Welcome to Zewar Boutique';
            const subtitle = authModal.querySelector('.auth-box');
            if (subtitle && !authModal.querySelector('#gate-subtitle')) {
                const p = document.createElement('p');
                p.id = 'gate-subtitle';
                p.style.cssText = 'color:#888; font-size:0.9rem; margin-top:-1rem; margin-bottom:1.5rem;';
                p.textContent = 'Please sign in or create an account to continue shopping.';
                h2.insertAdjacentElement('afterend', p);
            }
        }
    }
    window.closeAuth = function() {
        authModal.classList.remove('open');
        authOverlay.classList.remove('active');
        document.body.style.overflow = '';
        // Reset state
        document.getElementById('auth-step-1').style.display = 'block';
        document.getElementById('auth-step-2').style.display = 'none';
        document.querySelector('.auth-fallback').style.display = 'block';
        document.querySelector('.google-btn').style.display = 'flex';
        document.querySelector('.auth-divider').style.display = 'flex';
        document.querySelector('.auth-box h2').style.display = 'block';
        
        document.getElementById('auth-email-login').style.display = 'none';
        document.getElementById('auth-email-signup').style.display = 'none';
        clearInterval(timerInterval);
    }
    
    closeAuthBtn.addEventListener('click', () => { if (!authRequired) closeAuth(); });
    authOverlay.addEventListener('click', () => { if (!authRequired) closeAuth(); });

    // Auth Gate: open modal if no session on page load
    const existingUser = sessionStorage.getItem('zewar_customer') || localStorage.getItem('zewar_customer');
    if (!existingUser) {
        openAuth(true);
    }

    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.auth-icon-trigger');
        if (trigger) { 
            e.preventDefault(); 
            const user = sessionStorage.getItem('zewar_customer') || localStorage.getItem('zewar_customer');
            if (user) {
                window.location.href = 'dashboard.html';
            } else {
                openAuth(); 
            }
        }
    });

    let currentPhone = '';
    let timerInterval;

    window.sendOTP = async function() {
        const phone = document.getElementById('country-code').value + document.getElementById('phone-number').value;
        if (!phone || phone.length < 8) return alert('Enter valid phone format');
        currentPhone = phone;
        
        await fetch((window.BACKEND_URL || '') + '/api/auth/otp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({phone}) });
        
        document.getElementById('auth-step-1').style.display = 'none';
        document.getElementById('auth-step-2').style.display = 'block';
        document.getElementById('display-phone').textContent = phone;
        
        // Start timer
        let timeLeft = 30;
        document.getElementById('otp-timer').textContent = `Resend OTP in 00:${timeLeft}`;
        document.querySelector('.otp-box').focus(); // Auto focus first box
        timerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('otp-timer').textContent = `Resend OTP in 00:${timeLeft < 10 ? '0'+timeLeft : timeLeft}`;
            if(timeLeft <= 0) {
                clearInterval(timerInterval);
                document.getElementById('otp-timer').innerHTML = `<a href="#" onclick="sendOTP()" style="color:var(--secondary-color); text-decoration:none; font-weight:bold;">Resend OTP</a>`;
            }
        }, 1000);
    }
    
    window.otpJump = function(el, e) {
        if(e.key >= 0 && e.key <= 9) {
            if(el.nextElementSibling) el.nextElementSibling.focus();
        } else if (e.key === 'Backspace') {
            if(el.previousElementSibling) el.previousElementSibling.focus();
        }
    }

    window.verifyOTP = async function() {
        const boxes = document.querySelectorAll('.otp-box');
        let otp = Array.from(boxes).map(b => b.value).join('');
        if(otp.length < 4) return alert('Enter full 4 digit OTP (hint: type 1234)');
        
        const res = await fetch((window.BACKEND_URL || '') + '/api/auth/verify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({phone: currentPhone, otp}) });
        const data = await res.json();
        
        if (data.success) {
            sessionStorage.setItem('zewar_customer', JSON.stringify(data.customer));
            authRequired = false;
            closeAuth();
        } else alert('Invalid OTP');
    }

    window.googleLogin = async function() {
        const names = ['Aisha Khan', 'Sarah Jenkins', 'Sophia Martinez', 'Emma Watson'];
        const mockName = names[Math.floor(Math.random()*names.length)];
        const mockEmail = mockName.split(' ')[0].toLowerCase() + '@example.com';
        
        const res = await fetch((window.BACKEND_URL || '') + '/api/auth/google', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: mockName, email: mockEmail}) });
        const data = await res.json();
        if(data.success) { 
            sessionStorage.setItem('zewar_customer', JSON.stringify(data.customer));
            authRequired = false;
            closeAuth();
        }
    }

    window.validateEmail = function(input) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (input.value === '') {
            input.classList.remove('valid', 'invalid');
        } else if (re.test(input.value)) {
            input.classList.add('valid');
            input.classList.remove('invalid');
        } else {
            input.classList.add('invalid');
            input.classList.remove('valid');
        }
    }
    window.togglePassword = function(inputId, icon) {
        const input = document.getElementById(inputId);
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = "password";
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
    
    window.toggleAuthForms = function(formType) {
        document.getElementById('auth-step-1').style.display = 'none';
        document.getElementById('auth-step-2').style.display = 'none';
        document.querySelector('.auth-fallback').style.display = 'none';
        document.querySelector('.google-btn').style.display = 'none';
        document.querySelector('.auth-divider').style.display = 'none';
        document.querySelector('.auth-box h2').style.display = 'none';

        if (formType === 'login') {
            document.getElementById('auth-email-login').style.display = 'block';
            document.getElementById('auth-email-signup').style.display = 'none';
        } else {
            document.getElementById('auth-email-login').style.display = 'none';
            document.getElementById('auth-email-signup').style.display = 'block';
        }
    }

    window.processEmailLogin = async function() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('remember-me').checked;
        
        if(!email || !password) return alert('Please enter both your email and password.');
        
        try {
            const res = await fetch((window.BACKEND_URL || '') + '/api/auth/login', { 
                method: 'POST', headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({email, password}) 
            });
            const data = await res.json();
            if(data.success) { 
                if(remember) localStorage.setItem('zewar_customer', JSON.stringify(data.customer));
                else sessionStorage.setItem('zewar_customer', JSON.stringify(data.customer));
                authRequired = false;
                closeAuth();
            } else alert(data.message);
        } catch(err) { alert('Server disabled or unavailable'); }
    }

    window.processRegistration = async function() {
        const firstName = document.getElementById('reg-fname').value;
        const lastName = document.getElementById('reg-lname').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        
        if(!firstName || !email || !password) return alert('Please fill in all required fields.');
        if(password !== confirm) return alert('Passwords do not match.');
        if(password.length < 6) return alert('Password must be at least 6 characters.');
        if(!document.getElementById('reg-email').classList.contains('valid')) return alert('Please enter a valid email address.');

        try {
            const res = await fetch((window.BACKEND_URL || '') + '/api/auth/register', { 
                method: 'POST', headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({firstName, lastName, email, password}) 
            });
            const data = await res.json();
            if(data.success) { 
                sessionStorage.setItem('zewar_customer', JSON.stringify(data.customer));
                authRequired = false;
                closeAuth();
            } else alert(data.message);
        } catch(err) { alert('Server unavailable'); }
    }
    
    // --- PDP Zoom Effect ---
    const mainImgContainer = document.getElementById('zoom-container');
    const mainImg = document.getElementById('main-product-img');

    if (mainImgContainer && mainImg) {
        mainImgContainer.addEventListener('mousemove', (e) => {
            const rect = mainImgContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;
            
            mainImg.style.transformOrigin = `${xPercent}% ${yPercent}%`;
            mainImg.style.transform = 'scale(2.5)';
        });

        mainImgContainer.addEventListener('mouseleave', () => {
            mainImg.style.transformOrigin = 'center center';
            mainImg.style.transform = 'scale(1)';
        });
    }

    // Thumbnail click logic
    window.changeMainImage = function(element) {
        if(mainImg) {
            mainImg.src = element.src;
            const thumbnails = document.querySelectorAll('.pdp-thumb');
            thumbnails.forEach(t => t.classList.remove('active'));
            element.classList.add('active');
        }
    };

    // --- PDP Accordions ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const icon = this.querySelector('i');
            
            // Close all others
            accordionHeaders.forEach(otherHeader => {
                if (otherHeader !== this) {
                    const otherContent = otherHeader.nextElementSibling;
                    const otherIcon = otherHeader.querySelector('i');
                    otherContent.style.maxHeight = null;
                    otherIcon.classList.remove('fa-minus');
                    otherIcon.classList.add('fa-plus');
                }
            });

            if (content.style.maxHeight) {
                // If open, close it
                content.style.maxHeight = null;
                icon.classList.remove('fa-minus');
                icon.classList.add('fa-plus');
            } else {
                // Open it
                content.style.maxHeight = content.scrollHeight + 'px';
                icon.classList.remove('fa-plus');
                icon.classList.add('fa-minus');
            }
        });
    });

    // Initialize first accordion as open
    if (accordionHeaders.length > 0) {
        accordionHeaders[0].click();
    }

    // --- PDP Dynamic Fetching ---
    if (window.location.pathname.includes('product.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        
        if (productId) {
            fetch(API_URL)
                .then(res => res.json())
                .then(products => {
                    const product = products.find(p => p.id === productId);
                    if (product) {
                        document.querySelector('.pdp-title').innerHTML = product.title;
                        document.querySelector('.pdp-category').innerHTML = product.category;
                        document.querySelector('.pdp-price').innerHTML = '₹' + (product.discountPrice || product.price).toLocaleString('en-IN');
                        document.querySelector('.pdp-description').innerText = product.description || 'No description available.';
                        
                        const addBtn = document.querySelector('.pdp-add-cart');
                        addBtn.setAttribute('onclick', `addToCart('${product.id}', '${product.title.replace(/'/g, "\\'")}', ${product.discountPrice || product.price}, '${product.image}', ${product.stock})`);
                        if(product.stock <= 0) {
                            addBtn.textContent = 'Out of Stock';
                            addBtn.disabled = true;
                            addBtn.style.background = '#ccc';
                            addBtn.style.cursor = 'not-allowed';
                            addBtn.style.color = '#333';
                        }
                        
                        const images = product.images && product.images.length > 0 ? product.images : [product.image];
                        const mainImg = document.getElementById('main-product-img');
                        const thumbContainer = document.querySelector('.pdp-thumbnails');
                        
                        mainImg.src = images[0];
                        
                        thumbContainer.innerHTML = images.map((img, index) => `
                            <img src="${img}" class="pdp-thumb ${index === 0 ? 'active' : ''}" onclick="changeMainImage(this)" alt="Thumbnail">
                        `).join('');
                    } else {
                        document.querySelector('.pdp-info').innerHTML = '<h2>Product not found.</h2>';
                    }
                })
                .catch(err => console.error("Could not load PDP data", err));
        }
    }

});

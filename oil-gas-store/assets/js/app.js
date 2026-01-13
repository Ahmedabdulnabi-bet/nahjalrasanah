// assets/js/app.js

import { firebaseConfig } from './firebase-config.js';

import { 
  initializeApp 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';

import { // (جديد) إضافة خدمات المصادقة
  getAuth,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  getDoc, // لإصلاح fetchProductDetails
  doc // لإصلاح fetchProductDetails
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // (جديد) تهيئة خدمة المصادقة

// Get references to collections
const productsCol = collection(db, 'products'); 
const rfqsCol = collection(db, 'rfqs');

// DOM elements
const productListEl = document.getElementById('product-list'); 
const rfqListEl = document.getElementById('rfq-list');
const rfqForm = document.getElementById('rfq-form');
const rfqCountEl = document.getElementById('rfq-count');

// DOM elements for Authentication UI (جديد)
const authLink = document.getElementById('auth-link');
let currentUser = null;

// RFQ localStorage key
const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v1';
let products = []; // لتخزين المنتجات محليًا للرجوع إليها

// ---------- local RFQ helpers ----------
function getRfqCart() {
  // ... (نفس الدالة)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RFQ);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRfqCart(cart) {
  // ... (نفس الدالة)
  try {
    window.localStorage.setItem(STORAGE_KEY_RFQ, JSON.stringify(cart));
  } catch {}
}

function addToRfq(itemId, qty = 1) {
  // ... (نفس الدالة)
  const cart = getRfqCart();
  const idx = cart.findIndex((c) => c.id === itemId);
  if (idx >= 0) cart[idx].qty += qty;
  else cart.push({ id: itemId, qty });
  saveRfqCart(cart);
}

function updateRfqItem(id, qty) {
  // ... (نفس الدالة)
  const cart = getRfqCart();
  const idx = cart.findIndex((c) => c.id === id);
  if (idx >= 0) {
    cart[idx].qty = parseInt(qty, 10);
  }
  saveRfqCart(cart);
}

function removeRfqItem(id) {
  // ... (نفس الدالة)
  const cart = getRfqCart().filter((c) => c.id !== id);
  saveRfqCart(cart);
}

function clearRfqCart() {
  // ... (نفس الدالة)
  window.localStorage.removeItem(STORAGE_KEY_RFQ);
}

// ------------------------------------------------------------------
// (جديد) Authentication UI Logic
// ------------------------------------------------------------------

function updateAuthUI() {
    if (authLink) {
        if (currentUser) {
            // المستخدم مسجل الدخول
            authLink.href = '#'; 
            authLink.textContent = 'Logout';
            authLink.title = `Logged in as: ${currentUser.email}`;
            authLink.addEventListener('click', handleLogout, { once: true });
        } else {
            // المستخدم غير مسجل الدخول
            authLink.href = 'admin.html';
            authLink.textContent = 'Admin Login';
            authLink.title = 'Go to Admin Panel';
            authLink.removeEventListener('click', handleLogout);
        }
    }
}

async function handleLogout(e) {
    e.preventDefault();
    try {
        await signOut(auth);
    } catch (err) {
        console.error('Logout error:', err);
        alert('Failed to log out.');
    }
}


// ------------------------------------------------------------------
// Catalog Rendering (index.html)
// ------------------------------------------------------------------

function renderProducts(productsToRender) {
    // ... (نفس الدالة التي أرسلتها في الرد السابق)
    if (!productListEl) return;
    productListEl.innerHTML = ''; 

    if (productsToRender.length === 0) {
        productListEl.innerHTML = '<div class="col-12"><p class="alert alert-info">No products found in the catalog.</p></div>';
        return;
    }

    productsToRender.forEach(product => {
        const cardCol = document.createElement('div');
        cardCol.className = 'col';

        // ... (تجنب تحميل الفيديو المكسور)
        cardCol.innerHTML = `
            <div class="card product-card h-100 shadow-sm border-0">
                <img src="${product.image || 'assets/images/product-placeholder.png'}" class="card-img-top" alt="${product.name}" loading="lazy">
                <div class="card-body d-flex flex-column">
                    <span class="badge bg-secondary mb-1 align-self-start">${product.category || 'N/A'}</span>
                    <h5 class="card-title fw-semibold mb-1">${product.name}</h5>
                    <p class="card-text small text-muted mb-3">Part No: ${product.partNumber || 'N/A'}</p>
                    <p class="card-text small mb-4">${product.shortDescription || 'No description provided.'}</p>
                    <div class="mt-auto d-flex justify-content-between align-items-center">
                        <a href="product.html?id=${product.id}" class="btn btn-sm btn-outline-primary">View Details</a>
                        <button class="btn btn-sm btn-success add-to-rfq-btn" data-id="${product.id}">
                            <i class="bi bi-cart-plus"></i> Add to RFQ
                        </button>
                    </div>
                </div>
            </div>
        `;
        productListEl.appendChild(cardCol);
    });

    document.querySelectorAll('.add-to-rfq-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            addToRfq(id, 1);
            renderRfq(); 
            alert('Product added to RFQ basket!');
        });
    });
}


async function initHome() {
    if (!productListEl) return;

    productListEl.innerHTML = '<div class="col-12"><p class="text-center text-muted">Loading products...</p></div>';

    try {
        const snapshot = await getDocs(productsCol);
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log('Fetched products:', products); // التشخيص الذي أضفناه سابقاً

        const activeProducts = products.filter(p => p.isActive !== false);

        renderProducts(activeProducts);

    } catch (err) {
        console.error('Error fetching products from Firestore:', err);
        productListEl.innerHTML = '<div class="col-12"><p class="alert alert-danger">Error loading product catalog. Please check your Firebase Security Rules (products: allow read: if true;).</p></div>';
    }
    renderRfq(); 
}

// ------------------------------------------------------------------
// Product Details Logic (product.html) - (جديد)
// ------------------------------------------------------------------

async function fetchProductDetails(productId) {
    try {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error fetching product details:", error);
        return null;
    }
}

async function initProductPage() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    if (!productId) {
        document.getElementById('product-details').innerHTML = '<p class="alert alert-warning">Product ID is missing.</p>';
        return;
    }

    const product = await fetchProductDetails(productId);
    const detailsContainer = document.getElementById('product-details');

    if (product) {
        document.title = `${product.name} | Nahj Al-Rasanah`;

        // عرض تفاصيل المنتج 
        detailsContainer.innerHTML = `
            <div class="row g-5">
                <div class="col-md-5">
                    <img src="${product.image || 'assets/images/product-placeholder.png'}" class="img-fluid rounded shadow" alt="${product.name}">
                </div>
                <div class="col-md-7">
                    <h1 class="fw-bold mb-3">${product.name}</h1>
                    <p class="lead text-muted mb-4">${product.shortDescription || ''}</p>
                    
                    <div class="d-flex gap-2 mb-4">
                        <span class="badge bg-primary">Part No: ${product.partNumber || 'N/A'}</span>
                        <span class="badge bg-secondary">${product.category || 'N/A'}</span>
                    </div>

                    <div class="d-grid gap-2 d-md-flex justify-content-md-start mb-5">
                        <button class="btn btn-lg btn-success add-to-rfq-btn" data-id="${product.id}">
                            <i class="bi bi-cart-plus"></i> Add to RFQ
                        </button>
                        ${product.datasheet ? `<a href="${product.datasheet}" target="_blank" class="btn btn-lg btn-outline-info"><i class="bi bi-file-earmark-pdf"></i> Datasheet</a>` : ''}
                    </div>

                    <ul class="nav nav-tabs" id="productTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="desc-tab" data-bs-toggle="tab" data-bs-target="#description" type="button" role="tab" aria-controls="description" aria-selected="true">Description</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="specs-tab" data-bs-toggle="tab" data-bs-target="#specs" type="button" role="tab" aria-controls="specs" aria-selected="false">Specifications</button>
                        </li>
                    </ul>
                    <div class="tab-content border border-top-0 p-3 rounded-bottom" id="productTabsContent">
                        <div class="tab-pane fade show active" id="description" role="tabpanel" aria-labelledby="desc-tab">
                            <p>${product.longDescription || 'No detailed description available.'}</p>
                        </div>
                        <div class="tab-pane fade" id="specs" role="tabpanel" aria-labelledby="specs-tab">
                            <ul class="list-unstyled">
                                ${product.specs ? Object.entries(product.specs).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('') : '<li>No specifications provided.</li>'}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // إضافة مستمع حدث زر "Add to RFQ"
        document.querySelector('.add-to-rfq-btn').addEventListener('click', (e) => {
            addToRfq(product.id, 1);
            renderRfq(); 
            alert('Product added to RFQ basket!');
        });

    } else {
        detailsContainer.innerHTML = '<p class="alert alert-danger">Product not found or an error occurred while loading.</p>';
    }
    renderRfq(); // لتحديث أيقونة السلة
}


// ------------------------------------------------------------------
// RFQ Basket Logic (rfq.html)
// ------------------------------------------------------------------

// ... (الدوال renderRfq و initRfq كما كانت سابقاً)
// يجب أن تكون موجودة هنا...

function renderRfq() {
  const cart = getRfqCart();
  rfqListEl && (rfqListEl.innerHTML = '');
  rfqCountEl && (rfqCountEl.textContent = cart.length);

  if (!rfqListEl) return;

  if (cart.length === 0) {
    rfqListEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Your RFQ basket is empty. Please add items from the catalog.</td></tr>';
    rfqForm && rfqForm.classList.add('d-none');
    return;
  }
  
  rfqForm && rfqForm.classList.remove('d-none');

  cart.forEach((item) => {
    const product = products.find(p => p.id === item.id) || { name: 'Unknown Product', partNumber: 'N/A' };

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.qty}</td>
      <td>${product.partNumber}</td>
      <td><a href="product.html?id=${item.id}">${product.name}</a></td>
      <td>
        <input type="number" class="form-control form-control-sm rfq-qty-input" data-id="${item.id}" value="${item.qty}" min="1" style="width: 80px;">
      </td>
      <td>
        <button class="btn btn-sm btn-outline-danger rfq-remove-btn" data-id="${item.id}">Remove</button>
      </td>
    `;
    rfqListEl.appendChild(tr);
  });

  document.querySelectorAll('.rfq-qty-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      updateRfqItem(id, e.target.value);
      renderRfq();
    });
  });

  document.querySelectorAll('.rfq-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      removeRfqItem(id);
      renderRfq();
    });
  });
}

async function initRfq() {
    // تحميل المنتجات أولاً لربطها بسلة RFQ
    try {
        const snapshot = await getDocs(productsCol);
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error fetching products for RFQ page:', err);
    }
    
    // محتوى إرسال طلب RFQ
    rfqForm && rfqForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cart = getRfqCart();
        if (cart.length === 0) {
            alert('Your RFQ basket is empty.');
            return;
        }

        const company = document.getElementById('company').value;
        const contact = document.getElementById('contact').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const project = document.getElementById('project').value;
        const delivery = document.getElementById('delivery').value;
        const notes = document.getElementById('notes').value;

        // إعداد البريد الإلكتروني (اختياري)
        const lines = [
            `Company: ${company}`,
            `Contact: ${contact}`,
            `Email: ${email}`,
            `Phone: ${phone}`,
            `Project: ${project || 'N/A'}`,
            `Delivery: ${delivery || 'N/A'}`,
            '\nRequested Items:',
            ...cart.map(ci => {
                const product = products.find(p => p.id === ci.id) || {};
                return `- ${ci.qty} x ${product.partNumber || 'N/A'} (${product.name || ci.id})`;
            }),
            '\nAdditional Notes:',
            notes || 'None provided.'
        ];

        try {
            const rfqDoc = {
                createdAt: serverTimestamp(),
                company,
                contact,
                email,
                phone,
                project,
                delivery,
                notes,
                items: cart.map(ci => ({
                    id: ci.id,
                    qty: ci.qty,
                    name: (products.find(p => p.id === ci.id) || {}).name || null,
                    partNumber: (products.find(p => p.id === ci.id) || {}).partNumber || null
                }))
            };

            const docRef = await addDoc(rfqsCol, rfqDoc);

            alert('Your RFQ has been submitted. Reference ID: ' + docRef.id);

            // فتح برنامج البريد كإشعار (اختياري)
            const to = 'rfq@nahjalrasanah.com';
            const subject = encodeURIComponent('RFQ – ' + company);
            const body = encodeURIComponent(lines.join('\n'));
            window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;

            // مسح السلة
            clearRfqCart();
            renderRfq();

        } catch (err) {
            console.error('Error saving RFQ', err);
            alert('Failed to submit RFQ. Please try again later.');
        }
    });

    // العرض الأولي
    renderRfq();
}


// ---------- init dispatcher ----------
function initCommon() {
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  
  // (جديد) مراقبة حالة المصادقة لتحديث زر الإدارة
  onAuthStateChanged(auth, (user) => {
      currentUser = user;
      updateAuthUI();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCommon();
  const page = document.body.getAttribute('data-page');
  
  if (page === 'home') {
      initHome(); // تشغيل منطق الصفحة الرئيسية (الكتالوج)
  } else if (page === 'rfq') {
      initRfq(); // تشغيل منطق صفحة سلة RFQ
  } else if (page === 'product') {
      initProductPage(); // تشغيل منطق صفحة تفاصيل المنتج
  }
});
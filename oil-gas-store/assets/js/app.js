// assets/js/app.js

console.log('App.js is running!'); // أضف هذا السطر

import { firebaseConfig } from './firebase-config.js';
//

import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs, // ضرورية لجلب المنتجات
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get references to collections
const productsCol = collection(db, 'products'); // (جديد) مرجع مجموعة المنتجات
const rfqsCol = collection(db, 'rfqs');

// DOM elements
const productListEl = document.getElementById('product-list'); // (جديد) عنصر قائمة المنتجات
const rfqListEl = document.getElementById('rfq-list');
const rfqForm = document.getElementById('rfq-form');
const rfqCountEl = document.getElementById('rfq-count');

// RFQ localStorage key
const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v1';
let products = []; // لتخزين المنتجات محليًا للرجوع إليها

// ---------- local RFQ helpers ----------
function getRfqCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RFQ);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRfqCart(cart) {
  try {
    window.localStorage.setItem(STORAGE_KEY_RFQ, JSON.stringify(cart));
  } catch {}
}

function addToRfq(itemId, qty = 1) {
  const cart = getRfqCart();
  const idx = cart.findIndex((c) => c.id === itemId);
  if (idx >= 0) cart[idx].qty += qty;
  else cart.push({ id: itemId, qty });
  saveRfqCart(cart);
}

function updateRfqItem(id, qty) {
  const cart = getRfqCart();
  const idx = cart.findIndex((c) => c.id === id);
  if (idx >= 0) {
    cart[idx].qty = parseInt(qty, 10);
  }
  saveRfqCart(cart);
}

function removeRfqItem(id) {
  const cart = getRfqCart().filter((c) => c.id !== id);
  saveRfqCart(cart);
}

function clearRfqCart() {
  window.localStorage.removeItem(STORAGE_KEY_RFQ);
}

// ------------------------------------------------------------------
// Catalog Rendering (index.html)
// ------------------------------------------------------------------

function renderProducts(productsToRender) {
    if (!productListEl) return;
    productListEl.innerHTML = ''; 

    if (productsToRender.length === 0) {
        productListEl.innerHTML = '<div class="col-12"><p class="alert alert-info">No products found in the catalog.</p></div>';
        return;
    }

    productsToRender.forEach(product => {
        const cardCol = document.createElement('div');
        cardCol.className = 'col';

        // استخدام هيكل بطاقة Bootstrap قياسي
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

    // إضافة مستمعي الأحداث لأزرار "Add to RFQ"
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
        
        // تصفية المنتجات غير النشطة (افتراضًا حقل 'isActive' موجود)
        const activeProducts = products.filter(p => p.isActive !== false);

        renderProducts(activeProducts);

    } catch (err) {
        console.error('Error fetching products from Firestore:', err);
        productListEl.innerHTML = '<div class="col-12"><p class="alert alert-danger">Error loading product catalog. Please check your Firebase connection and Security Rules.</p></div>';
    }
    // يجب تشغيل عرض سلة RFQ أيضاً بعد تحميل المنتجات
    renderRfq(); 
}


// ------------------------------------------------------------------
// RFQ Basket Logic (rfq.html)
// ------------------------------------------------------------------

// (محتوى renderRfq و initRfq كما في نسختك الأصلية، تم وضعه هنا لضمان الاكتمال)

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
  
  // إظهار النموذج إذا كان هناك عناصر في السلة
  rfqForm && rfqForm.classList.remove('d-none');

  cart.forEach((item) => {
    // العثور على المنتج من قائمة المنتجات التي تم تحميلها مسبقاً
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

  // إضافة مستمعي الأحداث
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
    // (جديد) تحميل المنتجات أولاً لربطها بسلة RFQ
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
}

document.addEventListener('DOMContentLoaded', () => {
  initCommon();
  const page = document.body.getAttribute('data-page');
  
  if (page === 'home') {
      initHome(); // تشغيل منطق الصفحة الرئيسية
  } else if (page === 'rfq') {
      initRfq(); // تشغيل منطق صفحة سلة RFQ
  }
  // صفحة المنتج product.html ومنطقها يظل كما هو إن وجد
});
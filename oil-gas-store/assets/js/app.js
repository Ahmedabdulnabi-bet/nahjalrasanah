// assets/js/app.js

import { firebaseConfig } from './firebase-config.js';

import { 
    initializeApp 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';

import { // استيراد وظائف المصادقة
    getAuth, 
    onAuthStateChanged,
    signOut // تم إضافتها للسماح بتسجيل الخروج من أي صفحة
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js'; 

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // تعريف المصادقة

// RFQ localStorage key
const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v1';

// DOM Elements
const authButton = document.getElementById('auth-button');
const authButtonText = document.getElementById('auth-button-text');
// العنصر الذي يتم التحكم به: رابط صفحة RFQs
const navRfqsLink = document.getElementById('nav-rfqs-link'); 

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
  if (idx >= 0) cart[idx].qty = qty;
  saveRfqCart(cart);
}

function removeRfqItem(id) {
  let cart = getRfqCart();
  cart = cart.filter((c) => c.id !== id);
  saveRfqCart(cart);
  // يجب أن تكون دالة renderRfq متاحة
  if (typeof renderRfq === 'function') renderRfq(); 
}

function clearRfqCart() {
  saveRfqCart([]);
  if (typeof renderRfq === 'function') renderRfq();
}


// ---------- Authentication UI (المنطق الجديد) ----------
function initAuthUI() {
    // يجب وجود العناصر في الـ DOM لتجنب الأخطاء
    if (!authButton || !authButtonText) return; 

    // مراقبة حالة المصادقة باستمرار
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // المستخدم مسجل الدخول
            authButton.href = '#'; // تغيير الرابط ليصبح زر وظيفي
            authButtonText.textContent = 'Admin Logout';
            authButton.classList.remove('btn-outline-light');
            authButton.classList.add('btn-outline-danger');
            
            // إضافة وظيفة تسجيل الخروج عند النقر
            authButton.onclick = async (e) => {
                e.preventDefault();
                try {
                    await signOut(auth);
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Failed to log out.');
                }
            };

            // إظهار رابط RFQs إذا كان موجودًا في الـ DOM
            navRfqsLink && navRfqsLink.classList.remove('d-none'); 

        } else {
            // المستخدم غير مسجل الدخول
            authButton.href = 'admin.html'; // إعادة الرابط لصفحة تسجيل الدخول
            authButtonText.textContent = 'Admin Login';
            authButton.classList.remove('btn-outline-danger');
            authButton.classList.add('btn-outline-light');
            
            // إزالة وظيفة تسجيل الخروج
            authButton.onclick = null;
            
            // إخفاء رابط RFQs إذا كان موجودًا في الـ DOM
            navRfqsLink && navRfqsLink.classList.add('d-none');
        }
    });
}

// ---------- Main RFQ rendering logic ----------
let allProducts = [];

async function fetchAllProducts() {
    try {
        const snap = await getDocs(collection(db, 'products'));
        // إضافة خاصية isActive افتراضية (هذا مهم لمعالجة المنتجات القديمة)
        return snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(), 
            isActive: d.data().isActive !== undefined ? d.data().isActive : true // افتراض النشاط إذا لم يتم تعيينه
        }));
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}

// دالة عرض عناصر RFQ
function renderRfq() {
  const cart = getRfqCart();
  const products = allProducts; // استخدام القائمة المحملة
  
  const rfqTableBody = document.getElementById('rfq-table-body');
  const rfqEmptyRow = document.getElementById('rfq-empty');
  const btnSubmit = document.querySelector('#rfq-form button[type="submit"]');

  if (!rfqTableBody || !rfqEmptyRow || !btnSubmit) return;
  
  rfqTableBody.innerHTML = '';

  if (cart.length === 0) {
    rfqEmptyRow.classList.remove('d-none');
    // لضمان عرض الرسالة الفارغة بشكل صحيح
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="5" class="text-center">${rfqEmptyRow.innerHTML}</td>`;
    rfqTableBody.appendChild(emptyRow);
    
    btnSubmit.disabled = true;
    return;
  }

  rfqEmptyRow.classList.add('d-none');
  btnSubmit.disabled = false;

  cart.forEach((item) => {
    const product = products.find(p => p.id === item.id) || { name: 'Unknown Product', partNumber: 'N/A', category: 'N/A' };
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${product.name}</td>
      <td>${product.partNumber}</td>
      <td>
        <input type="number" class="form-control form-control-sm rfq-qty-input" value="${item.qty}" data-id="${item.id}" min="1">
      </td>
      <td>${product.category}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="removeRfqItem('${item.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1zM2.5 4v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4zM3 3h10V2H3z"/>
          </svg>
        </button>
      </td>
    `;
    rfqTableBody.appendChild(row);

    // إضافة مستمع حدث لتحديث الكمية
    const qtyInput = row.querySelector('.rfq-qty-input');
    if (qtyInput) {
        qtyInput.addEventListener('change', (e) => {
            const newQty = parseInt(e.target.value, 10);
            if (newQty > 0) {
                updateRfqItem(e.target.getAttribute('data-id'), newQty);
            } else {
                e.target.value = 1;
                updateRfqItem(e.target.getAttribute('data-id'), 1);
            }
        });
    }
  });
}

// دالة لمعالجة إرسال RFQ
async function submitRfq(e) {
  e.preventDefault();
  const cart = getRfqCart();
  if (cart.length === 0) {
      alert('Your RFQ basket is empty.');
      return;
  }

  const formData = new FormData(e.target);
  const company = formData.get('company');
  const contact = formData.get('contact');
  const email = formData.get('email');
  const phone = formData.get('phone');
  const project = formData.get('project');
  const delivery = formData.get('delivery');
  const notes = formData.get('notes');

  const lines = [
    `Dear Nahj Al-Rasanah Sales Team,`,
    `We would like to request a quotation for the following items:`,
    ``,
    `--- RFQ Details ---`,
    `Company: ${company}`,
    `Contact: ${contact}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Project/Field: ${project || 'N/A'}`,
    `Delivery: ${delivery || 'N/A'}`,
    ``,
    `--- Requested Items ---`,
    `| Qty | Part No. | Product Name |`,
    `|:---:|:---|:---|`,
  ];

  cart.forEach(ci => {
      const product = allProducts.find(p => p.id === ci.id) || { name: 'Unknown Product', partNumber: 'N/A' };
      lines.push(`| ${ci.qty} | ${product.partNumber || 'N/A'} | ${product.name} |`);
  });

  lines.push(``, `--- Additional Notes ---`);
  lines.push(notes || 'No additional notes provided.');
  lines.push(``, `Best Regards,`, `${contact}`);

  try {
      // 1. الحفظ في Firestore
      const rfqDoc = {
          company,
          contact,
          email,
          phone,
          project,
          delivery,
          notes,
          createdAt: serverTimestamp(),
          items: cart.map(ci => ({
              id: ci.id,
              qty: ci.qty,
              name: (allProducts.find(p => p.id === ci.id) || {}).name || null,
              partNumber: (allProducts.find(p => p.id === ci.id) || {}).partNumber || null
          }))
      };

      const rfqsCol = collection(db, 'rfqs');
      const docRef = await addDoc(rfqsCol, rfqDoc);

      // 2. فتح عميل البريد الإلكتروني (لتضمين تفاصيل الطلب)
      const to = 'rfq@nahjalrasanah.com';
      const subject = encodeURIComponent('RFQ – ' + company);
      const body = encodeURIComponent(lines.join('\n'));
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;

      // 3. مسح السلة بعد الإرسال
      alert(`Your RFQ has been submitted and saved. Reference ID: ${docRef.id}. Please check your email client to send the request.`);
      clearRfqCart();
      renderRfq();

  } catch (err) {
      console.error('Error saving or submitting RFQ', err);
      alert('Failed to submit RFQ. Please try again later.');
  }
}

// دالة لمعالجة إضافة منتج من الصفحة الرئيسية/صفحة المنتج
function handleAddToCart() {
  const btnAddToCart = document.getElementById('btn-add-to-rfq');
  if (btnAddToCart) {
    btnAddToCart.addEventListener('click', () => {
      const productId = btnAddToCart.getAttribute('data-product-id');
      const qtyInput = document.getElementById('product-qty-input');
      const qty = parseInt(qtyInput ? qtyInput.value : 1, 10);
      addToRfq(productId, qty);
      alert('Product added to RFQ basket!');
    });
  }
}

// دالة لعرض المنتجات في الصفحة الرئيسية (تحتاج إلى DOM elements خاصة بها)
function renderProducts(products) {
    // هذا مجرد نموذج، يجب أن تكون لديك عناصر HTML لتقديم المنتجات
    const catalogContainer = document.getElementById('catalog-container');
    if (!catalogContainer) return;
    
    // تصفية المنتجات النشطة فقط للعرض العام
    const activeProducts = products.filter(p => p.isActive);

    catalogContainer.innerHTML = activeProducts.map(p => `
        <div class="col-sm-6 col-lg-4 col-xl-3">
            <div class="card h-100 product-card shadow-sm">
                <img src="${p.image || 'assets/images/product-placeholder.png'}" class="card-img-top" alt="${p.name}">
                <div class="card-body d-flex flex-column">
                    <span class="small text-muted mb-1">${p.category}</span>
                    <h5 class="card-title fw-semibold mb-2">${p.name}</h5>
                    <p class="card-text small text-muted flex-grow-1">${p.shortDescription}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <a href="product.html?id=${p.id}" class="btn btn-sm btn-outline-primary">View Details</a>
                        <button class="btn btn-sm btn-success btn-add-rfq" data-id="${p.id}" data-name="${p.name}">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cart-plus" viewBox="0 0 16 16">
                            <path d="M9 5.5a.5.5 0 0 0-1 0V7H6.5a.5.5 0 0 0 0 1H8v1.5a.5.5 0 0 0 1 0V8h1.5a.5.5 0 0 0 0-1H9z"/>
                            <path d="M.5 1a.5.5 0 0 0 0 1h1.115l.401 1.607 1.493 8.955A.5.5 0 0 0 5 13h9a.5.5 0 0 0 .491-.408l1.5-8A.5.5 0 0 0 14.5 3H2.895zm1.92 9.006A.5.5 0 0 1 2.5 10a.5.5 0 0 1-.49-.408L1.764 6H14.5a.5.5 0 0 1 .49.408L14.236 10H2.525z"/>
                            <path d="M5.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"/>
                          </svg>
                          Add to RFQ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // إضافة مستمعات الأحداث لزر الإضافة إلى السلة
    document.querySelectorAll('.btn-add-rfq').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            addToRfq(id, 1);
            alert(`"${e.currentTarget.getAttribute('data-name')}" added to RFQ basket.`);
        });
    });
}

// دالة لعرض تفاصيل المنتج في صفحة المنتج
function renderProduct(product) {
    // هذا مجرد نموذج، يجب أن تكون لديك عناصر HTML لتقديم تفاصيل المنتج
    const container = document.getElementById('product-details-container');
    if (!container) return;
    
    // ... منطق عرض تفاصيل المنتج ...
    container.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h1 class="h3 fw-bold">${product.name}</h1>
                <p class="text-muted mb-2">${product.category} · Part No: ${product.partNumber}</p>
                <p class="lead">${product.shortDescription}</p>
                <p>${product.longDescription}</p>
                
                <h6 class="fw-semibold mt-4">Key Specifications</h6>
                <ul class="list-unstyled small">
                    ${Object.entries(product.specs || {}).map(([key, value]) => `
                        <li><span class="fw-semibold">${key}:</span> ${value}</li>
                    `).join('')}
                </ul>

                <div class="d-flex align-items-center gap-3 mt-4">
                    <input type="number" id="product-qty-input" class="form-control" value="1" min="1" style="width: 100px;">
                    <button class="btn btn-success" id="btn-add-to-rfq" data-product-id="${product.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cart-plus" viewBox="0 0 16 16">
                            <path d="M9 5.5a.5.5 0 0 0-1 0V7H6.5a.5.5 0 0 0 0 1H8v1.5a.5.5 0 0 0 1 0V8h1.5a.5.5 0 0 0 0-1H9z"/>
                            <path d="M.5 1a.5.5 0 0 0 0 1h1.115l.401 1.607 1.493 8.955A.5.5 0 0 0 5 13h9a.5.5 0 0 0 .491-.408l1.5-8A.5.5 0 0 0 14.5 3H2.895zm1.92 9.006A.5.5 0 0 1 2.5 10a.5.5 0 0 1-.49-.408L1.764 6H14.5a.5.5 0 0 1 .49.408L14.236 10H2.525z"/>
                            <path d="M5.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"/>
                        </svg>
                        Add to RFQ Basket
                    </button>
                </div>
            </div>
            <div class="col-md-6">
                <img src="${product.image || 'assets/images/product-placeholder.png'}" class="img-fluid rounded shadow-sm" alt="${product.name}">
            </div>
        </div>
    `;
    handleAddToCart(); // ربط زر الإضافة بعد العرض
}

// ---------- Page Initialization Functions ----------

async function initHome() {
  const loading = document.getElementById('catalog-loading');
  if (loading) loading.classList.remove('d-none');
  
  allProducts = await fetchAllProducts();
  renderProducts(allProducts);

  if (loading) loading.classList.add('d-none');
}

async function initProduct() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  if (!productId) {
      document.getElementById('product-details-container').innerHTML = '<p class="text-danger">Product ID is missing.</p>';
      return;
  }

  allProducts = await fetchAllProducts();
  const product = allProducts.find(p => p.id === productId);

  if (product) {
      document.title = `${product.name} | Nahj Al-Rasanah`;
      renderProduct(product);
  } else {
      document.getElementById('product-details-container').innerHTML = '<p class="text-danger">Product not found.</p>';
  }
}

async function initRfq() {
  // 1. تحميل المنتجات مرة واحدة
  allProducts = await fetchAllProducts();
  
  // 2. إعداد مستمعي الأحداث
  const rfqForm = document.getElementById('rfq-form');
  const btnClearRfq = document.getElementById('btn-clear-rfq');
  
  if (rfqForm) {
      rfqForm.addEventListener('submit', submitRfq);
  }

  if (btnClearRfq) {
      btnClearRfq.addEventListener('click', clearRfqCart);
  }

  // 3. العرض الأولي
  renderRfq();
}

// وظائف صفحات أخرى (admin.html و rfqs.html) سيتم التعامل معها بواسطة ملفات JS منفصلة (admin.js)


// ---------- init dispatcher ----------
function initCommon() {
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  initAuthUI(); // استدعاء دالة المصادقة
}

// جعل الدالة removeRfqItem متاحة عالميًا للـ onclick في renderRfq
window.removeRfqItem = removeRfqItem; 

document.addEventListener('DOMContentLoaded', () => {
  initCommon();
  const page = document.body.getAttribute('data-page');
  if (page === 'home') initHome();
  else if (page === 'rfq') initRfq();
  else if (page === 'product') initProduct();
  // صفحات admin و rfqs تستخدم ملف admin.js
});
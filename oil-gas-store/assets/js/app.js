// assets/js/app.js

import { firebaseConfig } from './firebase-config.js';

import { 
  initializeApp 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';

import { 
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
  getDoc,
  doc,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Collections
const productsCol = collection(db, 'products');
const rfqsCol = collection(db, 'rfqs');

// RFQ storage
const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v1';
let products = [];
let filteredProducts = [];

// ---------- Helper Functions ----------
function getRfqCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RFQ);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRfqCart(cart) {
  try {
    localStorage.setItem(STORAGE_KEY_RFQ, JSON.stringify(cart));
    updateRfqCount();
  } catch (error) {
    console.error('Error saving RFQ cart:', error);
  }
}

function addToRfq(itemId, qty = 1) {
  const cart = getRfqCart();
  const idx = cart.findIndex(item => item.id === itemId);
  
  if (idx >= 0) {
    cart[idx].qty += qty;
  } else {
    cart.push({ id: itemId, qty });
  }
  
  saveRfqCart(cart);
  showNotification('Product added to RFQ basket!', 'success');
}

function removeRfqItem(itemId) {
  const cart = getRfqCart().filter(item => item.id !== itemId);
  saveRfqCart(cart);
}

function clearRfqCart() {
  localStorage.removeItem(STORAGE_KEY_RFQ);
  updateRfqCount();
}

function updateRfqCount() {
  const cart = getRfqCart();
  const countElements = document.querySelectorAll('.rfq-count');
  
  countElements.forEach(el => {
    const count = cart.reduce((total, item) => total + item.qty, 0);
    el.textContent = count > 0 ? `(${count})` : '';
    el.classList.toggle('visible', count > 0);
  });
}

function showNotification(message, type = 'success') {
  // Remove existing notifications
  const existing = document.querySelector('.global-notification');
  if (existing) existing.remove();
  
  // Create new notification
  const notification = document.createElement('div');
  notification.className = `global-notification alert alert-${type} alert-dismissible fade show`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
    max-width: 400px;
  `;
  
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      const bsAlert = new bootstrap.Alert(notification);
      bsAlert.close();
    }
  }, 3000);
}

// ---------- Catalog Functions ----------
async function loadProducts() {
  try {
    const snapshot = await getDocs(productsCol);
    products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filter active products
    filteredProducts = products.filter(p => p.isActive !== false);
    
    return filteredProducts;
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

function renderProducts(productsList) {
  const productListEl = document.getElementById('product-list');
  if (!productListEl) return;
  
  if (productsList.length === 0) {
    productListEl.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">
          No products found. Try changing your filters.
        </div>
      </div>
    `;
    return;
  }
  
  productListEl.innerHTML = productsList.map(product => `
    <div class="col">
      <div class="card product-card h-100 shadow-sm border-0">
        <div class="product-image-container" style="height: 200px; overflow: hidden;">
          <img src="${product.image || 'assets/images/product-placeholder.png'}" 
               class="card-img-top" 
               alt="${product.name}"
               style="width: 100%; height: 100%; object-fit: contain; padding: 10px;">
        </div>
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge bg-secondary">${product.category || 'N/A'}</span>
            <small class="text-muted">${product.partNumber || ''}</small>
          </div>
          <h5 class="card-title fw-semibold mb-2" style="font-size: 1rem;">${product.name}</h5>
          <p class="card-text small text-muted flex-grow-1">${product.shortDescription || ''}</p>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <a href="product.html?id=${product.id}" class="btn btn-sm btn-outline-primary">View Details</a>
            <button class="btn btn-sm btn-success add-to-rfq-btn" data-id="${product.id}">
              <i class="bi bi-cart-plus"></i> Add to RFQ
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  
  // Add event listeners to Add to RFQ buttons
  document.querySelectorAll('.add-to-rfq-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.closest('.add-to-rfq-btn').dataset.id;
      addToRfq(productId, 1);
    });
  });
}

function setupFilters() {
  const categoryFilter = document.getElementById('category-filter');
  const segmentFilter = document.getElementById('segment-filter');
  const sortFilter = document.getElementById('sort-filter');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  
  if (categoryFilter) {
    // Populate category filter
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
    
    categoryFilter.addEventListener('change', filterProducts);
  }
  
  if (segmentFilter) {
    // Populate segment filter
    const segments = [...new Set(products.map(p => p.segment).filter(Boolean))];
    segments.forEach(segment => {
      const option = document.createElement('option');
      option.value = segment;
      option.textContent = segment;
      segmentFilter.appendChild(option);
    });
    
    segmentFilter.addEventListener('change', filterProducts);
  }
  
  if (sortFilter) {
    sortFilter.addEventListener('change', filterProducts);
  }
  
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      filterProducts();
    });
    
    searchInput.addEventListener('input', debounce(filterProducts, 300));
  }
}

function filterProducts() {
  const categoryFilter = document.getElementById('category-filter');
  const segmentFilter = document.getElementById('segment-filter');
  const sortFilter = document.getElementById('sort-filter');
  const searchInput = document.getElementById('search-input');
  
  let result = [...filteredProducts];
  
  // Apply category filter
  if (categoryFilter && categoryFilter.value) {
    result = result.filter(p => p.category === categoryFilter.value);
  }
  
  // Apply segment filter
  if (segmentFilter && segmentFilter.value) {
    result = result.filter(p => p.segment === segmentFilter.value);
  }
  
  // Apply search
  if (searchInput && searchInput.value.trim()) {
    const searchTerm = searchInput.value.toLowerCase().trim();
    result = result.filter(p => 
      (p.name && p.name.toLowerCase().includes(searchTerm)) ||
      (p.partNumber && p.partNumber.toLowerCase().includes(searchTerm)) ||
      (p.shortDescription && p.shortDescription.toLowerCase().includes(searchTerm)) ||
      (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
  }
  
  // Apply sorting
  if (sortFilter) {
    switch(sortFilter.value) {
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default: // 'name-asc'
        result.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  
  renderProducts(result);
  
  // Show/hide empty message
  const emptyMsg = document.getElementById('catalog-empty');
  if (emptyMsg) {
    emptyMsg.classList.toggle('d-none', result.length > 0);
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ---------- Product Details ----------
async function loadProductDetails() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  const container = document.getElementById('product-details');
  
  if (!productId || !container) return;
  
  try {
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      container.innerHTML = `
        <div class="alert alert-warning">
          Product not found. <a href="index.html#catalog">Return to catalog</a>
        </div>
      `;
      return;
    }
    
    const product = { id: docSnap.id, ...docSnap.data() };
    
    // Update page title
    document.title = `${product.name} | Nahj Al-Rasanah`;
    
    // Update breadcrumb
    const breadcrumb = document.querySelector('.breadcrumb .active');
    if (breadcrumb) breadcrumb.textContent = product.name;
    
    container.innerHTML = `
      <div class="row g-4">
        <div class="col-lg-5">
          <div class="card shadow-sm mb-3">
            <div class="card-body text-center p-4">
              <img src="${product.image || 'assets/images/product-placeholder.png'}" 
                   class="img-fluid rounded" 
                   alt="${product.name}"
                   style="max-height: 300px;">
            </div>
          </div>
          
          ${product.datasheet ? `
          <div class="card shadow-sm mb-3">
            <div class="card-body">
              <h6 class="fw-semibold mb-2">Documentation</h6>
              <a href="${product.datasheet}" 
                 target="_blank" 
                 class="btn btn-outline-info w-100">
                <i class="bi bi-file-earmark-pdf"></i> Download Datasheet
              </a>
            </div>
          </div>
          ` : ''}
        </div>
        
        <div class="col-lg-7">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h1 class="h3 fw-bold mb-2">${product.name}</h1>
              <div class="d-flex gap-2 mb-3">
                <span class="badge bg-primary">${product.partNumber || 'N/A'}</span>
                <span class="badge bg-secondary">${product.category || 'N/A'}</span>
                ${product.segment ? `<span class="badge bg-info">${product.segment}</span>` : ''}
              </div>
            </div>
            <button class="btn btn-success add-to-rfq-detail-btn" data-id="${product.id}">
              <i class="bi bi-cart-plus"></i> Add to RFQ
            </button>
          </div>
          
          <p class="lead text-muted mb-4">${product.shortDescription || ''}</p>
          
          ${product.longDescription ? `
          <div class="card shadow-sm mb-4">
            <div class="card-body">
              <h5 class="fw-semibold mb-3">Product Description</h5>
              <p class="mb-0">${product.longDescription}</p>
            </div>
          </div>
          ` : ''}
          
          <div class="card shadow-sm">
            <div class="card-body">
              <h5 class="fw-semibold mb-3">Technical Specifications</h5>
              <div class="table-responsive">
                <table class="table table-striped table-sm">
                  <tbody>
                    ${product.specs ? Object.entries(product.specs).map(([key, value]) => `
                      <tr>
                        <th style="width: 40%;">${key}</th>
                        <td>${value}</td>
                      </tr>
                    `).join('') : `
                      <tr>
                        <td colspan="2" class="text-center text-muted">
                          No specifications available
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          ${product.tags && product.tags.length > 0 ? `
          <div class="mt-3">
            <h6 class="fw-semibold mb-2">Tags</h6>
            <div class="d-flex flex-wrap gap-2">
              ${product.tags.map(tag => `<span class="badge bg-light text-dark border">${tag}</span>`).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Add event listener for Add to RFQ button
    const addBtn = container.querySelector('.add-to-rfq-detail-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addToRfq(product.id, 1);
      });
    }
    
  } catch (error) {
    console.error('Error loading product:', error);
    container.innerHTML = `
      <div class="alert alert-danger">
        Error loading product details. Please try again later.
      </div>
    `;
  }
}

// ---------- RFQ Page Functions ----------
function renderRfqTable() {
  const tableBody = document.getElementById('rfq-table-body');
  const emptyMsg = document.getElementById('rfq-empty');
  const clearBtn = document.getElementById('btn-clear-rfq');
  const rfqForm = document.getElementById('rfq-form');
  
  if (!tableBody) return;
  
  const cart = getRfqCart();
  
  if (cart.length === 0) {
    tableBody.innerHTML = '';
    if (emptyMsg) emptyMsg.classList.remove('d-none');
    if (rfqForm) rfqForm.classList.add('d-none');
    return;
  }
  
  if (emptyMsg) emptyMsg.classList.add('d-none');
  if (rfqForm) rfqForm.classList.remove('d-none');
  
  tableBody.innerHTML = cart.map(item => {
    const product = products.find(p => p.id === item.id) || {
      name: 'Unknown Product',
      partNumber: 'N/A',
      category: 'N/A'
    };
    
    return `
      <tr>
        <td>${product.name}</td>
        <td>${product.partNumber}</td>
        <td>
          <input type="number" 
                 class="form-control form-control-sm rfq-qty-input" 
                 data-id="${item.id}"
                 value="${item.qty}" 
                 min="1" 
                 style="width: 80px;">
        </td>
        <td>${product.category}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger rfq-remove-btn" data-id="${item.id}">
            Remove
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event listeners
  tableBody.querySelectorAll('.rfq-qty-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const qty = parseInt(e.target.value) || 1;
      const cart = getRfqCart();
      const item = cart.find(item => item.id === id);
      if (item) {
        item.qty = qty;
        saveRfqCart(cart);
        renderRfqTable();
      }
    });
  });
  
  tableBody.querySelectorAll('.rfq-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('.rfq-remove-btn').dataset.id;
      removeRfqItem(id);
      renderRfqTable();
      showNotification('Item removed from RFQ basket', 'warning');
    });
  });
  
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm('Are you sure you want to clear all items from your RFQ basket?')) {
        clearRfqCart();
        renderRfqTable();
        showNotification('RFQ basket cleared', 'info');
      }
    };
  }
}

function setupRfqForm() {
  const form = document.getElementById('rfq-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cart = getRfqCart();
    if (cart.length === 0) {
      showNotification('Your RFQ basket is empty', 'warning');
      return;
    }
    
    // Get form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Prepare items list
    const items = cart.map(item => {
      const product = products.find(p => p.id === item.id) || {};
      return {
        id: item.id,
        qty: item.qty,
        name: product.name || 'Unknown',
        partNumber: product.partNumber || 'N/A'
      };
    });
    
    try {
      // Save to Firestore
      const rfqDoc = {
        ...data,
        items,
        createdAt: serverTimestamp(),
        status: 'pending'
      };
      
      await addDoc(rfqsCol, rfqDoc);
      
      // Prepare email
      const emailBody = `
        RFQ Request from Nahj Al-Rasanah Store
        
        Company: ${data.company}
        Contact Person: ${data.contact}
        Email: ${data.email}
        Phone: ${data.phone}
        Project: ${data.project || 'Not specified'}
        Delivery: ${data.delivery || 'Not specified'}
        
        Requested Items:
        ${items.map(item => `  - ${item.qty}x ${item.name} (Part: ${item.partNumber})`).join('\n')}
        
        Additional Notes:
        ${data.notes || 'None'}
        
        ---
        This RFQ was submitted through the Nahj Al-Rasanah Online Store.
      `;
      
      // Open email client
      const mailtoLink = `mailto:sales@nahjalrasanah.com?subject=RFQ from ${data.company}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailtoLink, '_blank');
      
      // Clear cart and show success message
      clearRfqCart();
      form.reset();
      renderRfqTable();
      showNotification('RFQ submitted successfully! Email client opened.', 'success');
      
    } catch (error) {
      console.error('Error submitting RFQ:', error);
      showNotification('Error submitting RFQ. Please try again.', 'danger');
    }
  });
}

// ---------- Authentication ----------
function setupAuth() {
  const authLink = document.getElementById('auth-link');
  const authButton = document.getElementById('auth-button');
  
  const elements = [];
  if (authLink) elements.push(authLink);
  if (authButton) elements.push(authButton);
  
  onAuthStateChanged(auth, (user) => {
    elements.forEach(el => {
      if (user) {
        // User is signed in
        el.innerHTML = '<i class="bi bi-box-arrow-right"></i> Logout';
        el.href = '#';
        el.onclick = async (e) => {
          e.preventDefault();
          try {
            await signOut(auth);
            window.location.reload();
          } catch (error) {
            console.error('Logout error:', error);
          }
        };
      } else {
        // User is signed out
        el.innerHTML = '<i class="bi bi-person-fill-lock"></i> Admin Login';
        el.href = 'admin.html';
        el.onclick = null;
      }
    });
  });
}

// ---------- Initialize ----------
async function initHome() {
  await loadProducts();
  renderProducts(filteredProducts);
  setupFilters();
  updateRfqCount();
}

async function initRfq() {
  await loadProducts();
  renderRfqTable();
  setupRfqForm();
  updateRfqCount();
}

async function initProduct() {
  await loadProductDetails();
  updateRfqCount();
}

function initCommon() {
  // Update copyright year
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
  
  // Setup authentication
  setupAuth();
  
  // Update RFQ count on all pages
  updateRfqCount();
}

// ---------- Main Entry Point ----------
document.addEventListener('DOMContentLoaded', async () => {
  initCommon();
  
  const page = document.body.getAttribute('data-page');
  
  switch(page) {
    case 'home':
      await initHome();
      break;
    case 'rfq':
      await initRfq();
      break;
    case 'product':
      await initProduct();
      break;
  }
});
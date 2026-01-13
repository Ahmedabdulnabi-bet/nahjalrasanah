// assets/js/app-fixed.js
import { firebaseConfig, COLLECTIONS, USER_ROLES } from './firebase-config.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  doc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state
let products = [];
let filteredProducts = [];
const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v2';

// ========== HELPER FUNCTIONS ==========
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
    return true;
  } catch (error) {
    console.error('Error saving RFQ cart:', error);
    return false;
  }
}

function updateRfqCount() {
  const cart = getRfqCart();
  const count = cart.reduce((total, item) => total + item.qty, 0);
  
  document.querySelectorAll('.rfq-count').forEach(el => {
    if (count > 0) {
      el.textContent = count;
      el.classList.remove('d-none');
    } else {
      el.classList.add('d-none');
    }
  });
}

function showNotification(message, type = 'success') {
  const existing = document.querySelector('.global-notification');
  if (existing) existing.remove();
  
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
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// ========== PRODUCT FUNCTIONS ==========
async function loadProducts() {
  try {
    console.log('Loading products from Firestore...');
    
    // Query only active products
    const productsQuery = query(
      collection(db, COLLECTIONS.PRODUCTS),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(productsQuery);
    
    products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    filteredProducts = [...products];
    console.log(`Loaded ${products.length} active products`);
    
    return products;
  } catch (error) {
    console.error('Error loading products:', error);
    showNotification('Error loading products', 'danger');
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
          <i class="bi bi-info-circle"></i> No products found. Try changing your filters.
        </div>
      </div>
    `;
    return;
  }
  
  productListEl.innerHTML = productsList.map(product => {
    // Format vendor name (show only if available)
    const vendorName = product.vendorInfo?.vendorName ? 
      `<small class="text-muted d-block">Supplier: ${product.vendorInfo.vendorName}</small>` : '';
    
    return `
      <div class="col">
        <div class="card product-card h-100 shadow-sm border-0">
          <div class="product-image-container position-relative" style="height: 200px; overflow: hidden;">
            <img src="${product.image || 'assets/images/product-placeholder.png'}" 
                 class="card-img-top" 
                 alt="${product.name}"
                 style="width: 100%; height: 100%; object-fit: contain; padding: 10px;"
                 onerror="this.src='assets/images/product-placeholder.png'">
            ${product.isFeatured ? `
              <span class="position-absolute top-0 start-0 m-2 badge bg-warning">
                <i class="bi bi-star-fill"></i> Featured
              </span>
            ` : ''}
          </div>
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge bg-primary">${product.category || 'General'}</span>
              <small class="text-muted">${product.partNumber || 'N/A'}</small>
            </div>
            <h5 class="card-title fw-semibold mb-2" style="font-size: 1rem;">${product.name}</h5>
            ${vendorName}
            <p class="card-text small text-muted flex-grow-1">${product.shortDescription || 'No description available'}</p>
            <div class="d-flex justify-content-between align-items-center mt-3">
              <a href="product.html?id=${product.id}" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-eye"></i> Details
              </a>
              <button class="btn btn-sm btn-success add-to-rfq-btn" data-id="${product.id}">
                <i class="bi bi-cart-plus"></i> Add to RFQ
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners
  document.querySelectorAll('.add-to-rfq-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.closest('.add-to-rfq-btn').dataset.id;
      addToRfq(productId);
    });
  });
}

function addToRfq(productId, qty = 1) {
  const cart = getRfqCart();
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    showNotification('Product not found', 'danger');
    return;
  }
  
  const existingIndex = cart.findIndex(item => item.id === productId);
  
  if (existingIndex >= 0) {
    cart[existingIndex].qty += qty;
  } else {
    cart.push({
      id: productId,
      qty: qty,
      name: product.name,
      partNumber: product.partNumber,
      category: product.category
    });
  }
  
  if (saveRfqCart(cart)) {
    showNotification(`${product.name} added to RFQ basket`, 'success');
  }
}

// ========== FILTERS ==========
function setupFilters() {
  const categoryFilter = document.getElementById('category-filter');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  
  // Populate category filter
  if (categoryFilter) {
    const categories = [...new Set(products
      .map(p => p.category)
      .filter(Boolean)
      .sort())];
    
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
    
    categoryFilter.addEventListener('change', applyFilters);
  }
  
  // Setup search
  if (searchForm && searchInput) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters();
    });
    
    searchInput.addEventListener('input', debounce(applyFilters, 300));
  }
}

function applyFilters() {
  const categoryFilter = document.getElementById('category-filter');
  const searchInput = document.getElementById('search-input');
  const sortFilter = document.getElementById('sort-filter');
  
  let result = [...products];
  
  // Category filter
  if (categoryFilter && categoryFilter.value) {
    result = result.filter(p => p.category === categoryFilter.value);
  }
  
  // Search filter
  if (searchInput && searchInput.value.trim()) {
    const term = searchInput.value.toLowerCase().trim();
    result = result.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.partNumber && p.partNumber.toLowerCase().includes(term)) ||
      (p.shortDescription && p.shortDescription.toLowerCase().includes(term)) ||
      (p.tags && p.tags.some(tag => tag.toLowerCase().includes(term)))
    );
  }
  
  // Sort
  if (sortFilter) {
    switch(sortFilter.value) {
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
        result.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
        break;
      case 'oldest':
        result.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds);
        break;
      default: // 'name-asc'
        result.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  
  renderProducts(result);
  
  // Show empty message
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

// ========== PRODUCT DETAILS ==========
async function loadProductDetails() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  const container = document.getElementById('product-details');
  
  if (!productId || !container) return;
  
  try {
    const docRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle"></i> 
          Product not found. <a href="index.html#catalog" class="alert-link">Return to catalog</a>
        </div>
      `;
      return;
    }
    
    const product = { id: docSnap.id, ...docSnap.data() };
    
    // Update page title
    document.title = `${product.name} | Nahj Al-Rasanah`;
    
    // Render product details
    container.innerHTML = createProductDetailsHTML(product);
    
    // Add event listeners
    const addBtn = container.querySelector('.add-to-rfq-detail-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => addToRfq(product.id));
    }
    
  } catch (error) {
    console.error('Error loading product:', error);
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-x-circle"></i> 
        Error loading product details. Please try again later.
      </div>
    `;
  }
}

function createProductDetailsHTML(product) {
  return `
    <div class="row g-4">
      <!-- Left Column: Images & Documents -->
      <div class="col-lg-5">
        <div class="card shadow-sm mb-3">
          <div class="card-body text-center p-4">
            <img src="${product.image || 'assets/images/product-placeholder.png'}" 
                 class="img-fluid rounded" 
                 alt="${product.name}"
                 style="max-height: 300px;"
                 onerror="this.src='assets/images/product-placeholder.png'">
          </div>
        </div>
        
        <!-- Documents -->
        <div class="card shadow-sm mb-3">
          <div class="card-body">
            <h6 class="fw-semibold mb-3">Documents & Media</h6>
            <div class="d-grid gap-2">
              ${product.datasheet ? `
                <a href="${product.datasheet}" 
                   target="_blank" 
                   class="btn btn-outline-info">
                  <i class="bi bi-file-earmark-pdf"></i> Download Datasheet
                </a>
              ` : ''}
              ${product.video ? `
                <a href="${product.video}" 
                   target="_blank" 
                   class="btn btn-outline-secondary">
                  <i class="bi bi-play-circle"></i> Watch Product Video
                </a>
              ` : ''}
            </div>
          </div>
        </div>
        
        <!-- Contact Info -->
        <div class="card shadow-sm">
          <div class="card-body">
            <h6 class="fw-semibold mb-3">Contact Information</h6>
            <ul class="list-unstyled small mb-0">
              <li class="mb-2">
                <i class="bi bi-envelope text-primary me-2"></i>
                <strong>Email:</strong> sales@nahjalrasanah.com
              </li>
              <li class="mb-2">
                <i class="bi bi-telephone text-primary me-2"></i>
                <strong>Phone:</strong> +964 784 349 9555
              </li>
              <li class="mb-2">
                <i class="bi bi-clock text-primary me-2"></i>
                <strong>Response Time:</strong> 24-48 hours
              </li>
              <li>
                <i class="bi bi-shield-check text-primary me-2"></i>
                <strong>Warranty:</strong> Through Nahj Al-Rasanah
              </li>
            </ul>
            <div class="alert alert-info mt-3 small">
              <i class="bi bi-info-circle me-2"></i>
              All communications are handled through Nahj Al-Rasanah
            </div>
          </div>
        </div>
      </div>
      
      <!-- Right Column: Product Info -->
      <div class="col-lg-7">
        <div class="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h1 class="h3 fw-bold mb-2">${product.name}</h1>
            <div class="d-flex flex-wrap gap-2 mb-3">
              <span class="badge bg-primary">${product.partNumber || 'N/A'}</span>
              <span class="badge bg-secondary">${product.category || 'N/A'}</span>
              ${product.segment ? `<span class="badge bg-info">${product.segment}</span>` : ''}
              ${product.vendorInfo?.vendorName ? `
                <span class="badge bg-light text-dark border">Supplier: ${product.vendorInfo.vendorName}</span>
              ` : ''}
            </div>
          </div>
          <button class="btn btn-success add-to-rfq-detail-btn" data-id="${product.id}">
            <i class="bi bi-cart-plus"></i> Add to RFQ
          </button>
        </div>
        
        <p class="lead text-muted mb-4">${product.shortDescription || ''}</p>
        
        <!-- Long Description -->
        ${product.longDescription ? `
        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <h5 class="fw-semibold mb-3">Product Description</h5>
            <div class="product-description">${product.longDescription}</div>
          </div>
        </div>
        ` : ''}
        
        <!-- Technical Specifications -->
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="fw-semibold mb-3">Technical Specifications</h5>
            <div class="table-responsive">
              <table class="table table-striped table-sm">
                <tbody>
                  ${product.specs && product.specs.length > 0 ? 
                    product.specs.map(spec => {
                      const [key, value] = spec.split(':').map(s => s.trim());
                      return key && value ? `
                        <tr>
                          <th style="width: 40%;">${key}</th>
                          <td>${value}</td>
                        </tr>
                      ` : '';
                    }).join('') : `
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
        
        <!-- Tags -->
        ${product.tags && product.tags.length > 0 ? `
        <div class="mt-4">
          <h6 class="fw-semibold mb-2">Tags</h6>
          <div class="d-flex flex-wrap gap-2">
            ${product.tags.map(tag => 
              `<span class="badge bg-light text-dark border">${tag}</span>`
            ).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ========== AUTHENTICATION ==========
function setupAuth() {
  const authContainers = document.querySelectorAll('#auth-nav-container, #auth-button');
  
  onAuthStateChanged(auth, (user) => {
    authContainers.forEach(container => {
      if (user) {
        // Check user role
        getUserRole(user.uid).then(role => {
          if (role === USER_ROLES.ADMIN || role === USER_ROLES.VENDOR) {
            container.innerHTML = `
              <a href="${role === USER_ROLES.ADMIN ? 'admin.html' : 'vendor-dashboard.html'}" 
                 class="btn btn-outline-light btn-sm d-flex align-items-center gap-1">
                <i class="bi bi-speedometer2"></i>
                <span>Dashboard</span>
              </a>
            `;
          } else {
            container.innerHTML = `
              <a href="admin.html" 
                 class="btn btn-outline-light btn-sm d-flex align-items-center gap-1">
                <i class="bi bi-person-fill-lock"></i>
                <span>Login</span>
              </a>
            `;
          }
        });
      } else {
        container.innerHTML = `
          <a href="admin.html" 
             class="btn btn-outline-light btn-sm d-flex align-items-center gap-1">
            <i class="bi bi-person-fill-lock"></i>
            <span>Login</span>
          </a>
        `;
      }
    });
  });
}

async function getUserRole(userId) {
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    return userDoc.exists() ? userDoc.data().role : null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

// ========== INITIALIZATION ==========
async function initHome() {
  console.log('Initializing home page...');
  await loadProducts();
  renderProducts(products);
  setupFilters();
  updateRfqCount();
}

async function initProduct() {
  console.log('Initializing product page...');
  await loadProducts(); // Load products for RFQ functionality
  await loadProductDetails();
  updateRfqCount();
}

function initCommon() {
  // Update copyright year
  const yearSpans = document.querySelectorAll('#year');
  yearSpans.forEach(span => {
    if (span) span.textContent = new Date().getFullYear();
  });
  
  // Setup authentication
  setupAuth();
  
  // Update RFQ count
  updateRfqCount();
}

// ========== MAIN ENTRY POINT ==========
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded');
  
  initCommon();
  
  const page = document.body.getAttribute('data-page');
  console.log('Current page:', page);
  
  try {
    switch(page) {
      case 'home':
        await initHome();
        break;
      case 'product':
        await initProduct();
        break;
      case 'rfq':
        // Will be handled by rfq.js
        break;
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showNotification('Error loading page content', 'danger');
  }
  
  console.log('Page initialization complete');
});
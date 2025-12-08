// assets/js/app.js - نسخة محسنة

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
  doc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const productListEl = document.getElementById('product-list');
const categoryFilter = document.getElementById('category-filter');
const segmentFilter = document.getElementById('segment-filter');
const sortFilter = document.getElementById('sort-filter');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const catalogEmpty = document.getElementById('catalog-empty');

// RFQ localStorage key
const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v1';
let products = [];
let filteredProducts = [];

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
    updateRfqCount();
  } catch {}
}

function addToRfq(itemId, qty = 1) {
  const cart = getRfqCart();
  const idx = cart.findIndex((c) => c.id === itemId);
  if (idx >= 0) {
    cart[idx].qty += qty;
  } else {
    cart.push({ id: itemId, qty });
  }
  saveRfqCart(cart);
  showNotification('Product added to RFQ basket!');
}

function updateRfqCount() {
  const count = getRfqCart().length;
  const rfqCountEl = document.getElementById('rfq-count');
  if (rfqCountEl) {
    rfqCountEl.textContent = count > 0 ? `RFQ (${count})` : 'RFQ';
  }
}

function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  notification.style.cssText = `
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
  `;
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// ---------- Catalog Functions ----------
function populateFilters() {
  if (!categoryFilter || !segmentFilter) return;
  
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const segments = [...new Set(products.map(p => p.segment).filter(Boolean))];
  
  // Populate category filter
  categoryFilter.innerHTML = '<option value="">All categories</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
  
  // Populate segment filter
  segmentFilter.innerHTML = '<option value="">All segments</option>';
  segments.forEach(seg => {
    const option = document.createElement('option');
    option.value = seg;
    option.textContent = seg;
    segmentFilter.appendChild(option);
  });
}

function filterAndSortProducts() {
  const category = categoryFilter ? categoryFilter.value : '';
  const segment = segmentFilter ? segmentFilter.value : '';
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const sortValue = sortFilter ? sortFilter.value : 'name-asc';
  
  filteredProducts = products.filter(p => {
    if (p.isActive === false) return false;
    
    // Category filter
    if (category && p.category !== category) return false;
    
    // Segment filter
    if (segment && p.segment !== segment) return false;
    
    // Search filter
    if (searchTerm) {
      const searchable = [
        p.name,
        p.partNumber,
        p.shortDescription,
        p.longDescription,
        ...(p.tags || [])
      ].join(' ').toLowerCase();
      return searchable.includes(searchTerm);
    }
    
    return true;
  });
  
  // Sort products
  filteredProducts.sort((a, b) => {
    switch (sortValue) {
      case 'name-asc':
        return (a.name || '').localeCompare(b.name || '');
      case 'name-desc':
        return (b.name || '').localeCompare(a.name || '');
      default:
        return 0;
    }
  });
  
  renderProducts();
}

function renderProducts() {
  if (!productListEl) return;
  
  if (filteredProducts.length === 0) {
    productListEl.innerHTML = '<div class="col-12"><p class="alert alert-info">No products found.</p></div>';
    if (catalogEmpty) catalogEmpty.classList.remove('d-none');
    return;
  }
  
  if (catalogEmpty) catalogEmpty.classList.add('d-none');
  productListEl.innerHTML = '';
  
  filteredProducts.forEach(product => {
    const cardCol = document.createElement('div');
    cardCol.className = 'col';
    
    cardCol.innerHTML = `
      <div class="card product-card h-100 shadow-sm border-0">
        <div style="height: 200px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          <img src="${product.image || 'assets/images/product-placeholder.png'}" 
               class="card-img-top" 
               alt="${product.name}" 
               style="max-height: 100%; max-width: 100%; object-fit: contain;">
        </div>
        <div class="card-body d-flex flex-column">
          <span class="badge bg-secondary mb-2 align-self-start">${product.category || 'N/A'}</span>
          <h5 class="card-title fw-semibold mb-1">${product.name}</h5>
          <p class="card-text small text-muted mb-2">Part No: ${product.partNumber || 'N/A'}</p>
          <p class="card-text small mb-3">${product.shortDescription || 'No description provided.'}</p>
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
  
  // Add event listeners to Add to RFQ buttons
  document.querySelectorAll('.add-to-rfq-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      addToRfq(id, 1);
    });
  });
}

// ---------- Product Details ----------
async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  const detailsContainer = document.getElementById('product-details');
  
  if (!productId || !detailsContainer) {
    detailsContainer.innerHTML = '<div class="alert alert-danger">Product ID is missing.</div>';
    return;
  }
  
  try {
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const product = { id: docSnap.id, ...docSnap.data() };
      document.title = `${product.name} | Nahj Al-Rasanah`;
      
      // Update breadcrumb
      const breadcrumb = document.querySelector('.breadcrumb .active');
      if (breadcrumb) breadcrumb.textContent = product.name;
      
      detailsContainer.innerHTML = `
        <div class="row g-5">
          <div class="col-md-5">
            <div class="card shadow-sm mb-3">
              <div class="card-body text-center">
                <img src="${product.image || 'assets/images/product-placeholder.png'}" 
                     class="img-fluid rounded" 
                     alt="${product.name}"
                     style="max-height: 400px;">
              </div>
            </div>
            ${product.datasheet ? `
            <div class="card shadow-sm">
              <div class="card-body">
                <h6 class="fw-semibold mb-2">Datasheet</h6>
                <a href="${product.datasheet}" target="_blank" class="btn btn-outline-info w-100">
                  <i class="bi bi-file-earmark-pdf"></i> Download PDF Datasheet
                </a>
              </div>
            </div>
            ` : ''}
          </div>
          <div class="col-md-7">
            <h1 class="fw-bold mb-2">${product.name}</h1>
            <div class="d-flex gap-2 mb-3">
              <span class="badge bg-primary">${product.partNumber || 'N/A'}</span>
              <span class="badge bg-secondary">${product.category || 'N/A'}</span>
              ${product.segment ? `<span class="badge bg-info">${product.segment}</span>` : ''}
            </div>
            
            <p class="lead mb-4">${product.shortDescription || ''}</p>
            
            ${product.longDescription ? `
            <div class="mb-4">
              <h5 class="fw-semibold mb-2">Description</h5>
              <p>${product.longDescription}</p>
            </div>
            ` : ''}
            
            <div class="d-grid gap-2 d-md-flex justify-content-md-start mb-5">
              <button class="btn btn-lg btn-success add-to-rfq-detail-btn" data-id="${product.id}">
                <i class="bi bi-cart-plus"></i> Add to RFQ
              </button>
              <a href="rfq.html" class="btn btn-lg btn-outline-primary">
                <i class="bi bi-cart"></i> View RFQ Basket
              </a>
            </div>
            
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
                          <td colspan="2" class="text-center text-muted">No specifications provided.</td>
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
      const addToRfqBtn = detailsContainer.querySelector('.add-to-rfq-detail-btn');
      if (addToRfqBtn) {
        addToRfqBtn.addEventListener('click', () => {
          addToRfq(product.id, 1);
        });
      }
      
    } else {
      detailsContainer.innerHTML = '<div class="alert alert-warning">Product not found.</div>';
    }
  } catch (error) {
    console.error('Error loading product:', error);
    detailsContainer.innerHTML = '<div class="alert alert-danger">Error loading product details.</div>';
  }
}

// ---------- RFQ Page Functions ----------
function initRfqPage() {
  const rfqTableBody = document.getElementById('rfq-table-body');
  const rfqEmpty = document.getElementById('rfq-empty');
  const rfqForm = document.getElementById('rfq-form');
  const clearRfqBtn = document.getElementById('btn-clear-rfq');
  
  if (!rfqTableBody) return;
  
  function renderRfqTable() {
    const cart = getRfqCart();
    
    if (cart.length === 0) {
      rfqTableBody.innerHTML = '';
      if (rfqEmpty) rfqEmpty.classList.remove('d-none');
      return;
    }
    
    if (rfqEmpty) rfqEmpty.classList.add('d-none');
    rfqTableBody.innerHTML = '';
    
    cart.forEach(item => {
      const product = products.find(p => p.id === item.id) || { 
        name: 'Unknown Product', 
        partNumber: 'N/A', 
        category: 'N/A' 
      };
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${product.name}</td>
        <td>${product.partNumber}</td>
        <td>
          <input type="number" class="form-control form-control-sm rfq-qty-input" 
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
      `;
      rfqTableBody.appendChild(tr);
    });
    
    // Add event listeners
    document.querySelectorAll('.rfq-qty-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const qty = parseInt(e.target.value);
        if (qty > 0) {
          updateRfqItem(id, qty);
        }
      });
    });
    
    document.querySelectorAll('.rfq-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        removeRfqItem(id);
      });
    });
  }
  
  function updateRfqItem(id, qty) {
    const cart = getRfqCart();
    const idx = cart.findIndex((c) => c.id === id);
    if (idx >= 0) {
      cart[idx].qty = qty;
      saveRfqCart(cart);
      renderRfqTable();
    }
  }
  
  function removeRfqItem(id) {
    const cart = getRfqCart().filter((c) => c.id !== id);
    saveRfqCart(cart);
    renderRfqTable();
    showNotification('Item removed from RFQ basket.', 'warning');
  }
  
  if (clearRfqBtn) {
    clearRfqBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all items from your RFQ basket?')) {
        localStorage.removeItem(STORAGE_KEY_RFQ);
        renderRfqTable();
        updateRfqCount();
        showNotification('RFQ basket cleared.', 'info');
      }
    });
  }
  
  if (rfqForm) {
    rfqForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cart = getRfqCart();
      
      if (cart.length === 0) {
        showNotification('Your RFQ basket is empty.', 'warning');
        return;
      }
      
      // Prepare email content
      const company = rfqForm.querySelector('[name="company"]').value;
      const contact = rfqForm.querySelector('[name="contact"]').value;
      const email = rfqForm.querySelector('[name="email"]').value;
      const phone = rfqForm.querySelector('[name="phone"]').value;
      const project = rfqForm.querySelector('[name="project"]').value || 'N/A';
      const delivery = rfqForm.querySelector('[name="delivery"]').value || 'N/A';
      const notes = rfqForm.querySelector('[name="notes"]').value || 'N/A';
      
      let emailBody = `RFQ Request\n\n`;
      emailBody += `Company: ${company}\n`;
      emailBody += `Contact Person: ${contact}\n`;
      emailBody += `Email: ${email}\n`;
      emailBody += `Phone: ${phone}\n`;
      emailBody += `Project/Field: ${project}\n`;
      emailBody += `Delivery Location/INCOTERM: ${delivery}\n\n`;
      emailBody += `REQUESTED ITEMS:\n`;
      emailBody += '----------------------------------------\n';
      
      cart.forEach(item => {
        const product = products.find(p => p.id === item.id) || { name: 'Unknown', partNumber: 'N/A' };
        emailBody += `${item.qty}x ${product.name} (Part No: ${product.partNumber})\n`;
      });
      
      emailBody += '\nAdditional Notes:\n';
      emailBody += notes;
      emailBody += '\n\n---\n';
      emailBody += 'This RFQ was generated from Nahj Al-Rasanah Oil & Gas Supplies Store';
      
      // Create mailto link
      const mailtoLink = `mailto:sales@nahjalrasanah.com?subject=RFQ from ${company}&body=${encodeURIComponent(emailBody)}`;
      
      // Open email client
      window.location.href = mailtoLink;
      
      showNotification('RFQ prepared! Please review and send the email.', 'success');
    });
  }
  
  renderRfqTable();
}

// ---------- Main Initialization ----------
async function initHome() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    filteredProducts = products.filter(p => p.isActive !== false);
    
    populateFilters();
    filterAndSortProducts();
    
    // Add event listeners for filters
    if (categoryFilter) categoryFilter.addEventListener('change', filterAndSortProducts);
    if (segmentFilter) segmentFilter.addEventListener('change', filterAndSortProducts);
    if (sortFilter) sortFilter.addEventListener('change', filterAndSortProducts);
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        filterAndSortProducts();
      });
    }
    
  } catch (err) {
    console.error('Error loading products:', err);
    if (productListEl) {
      productListEl.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error loading product catalog. Please try again later.</div></div>';
    }
  }
}

function initCommon() {
  // Update copyright year
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  
  // Update RFQ count
  updateRfqCount();
  
  // Authentication state
  onAuthStateChanged(auth, (user) => {
    const authButtons = document.querySelectorAll('#auth-button, #auth-link');
    authButtons.forEach(btn => {
      if (user) {
        btn.innerHTML = '<i class="bi bi-box-arrow-right"></i> Logout';
        btn.href = '#';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          signOut(auth).then(() => {
            window.location.reload();
          });
        });
      } else {
        btn.innerHTML = '<i class="bi bi-person-fill-lock"></i> Admin Login';
        btn.href = 'admin.html';
        btn.removeEventListener('click', () => {});
      }
    });
  });
}

// ---------- Initialize based on page ----------
document.addEventListener('DOMContentLoaded', () => {
  initCommon();
  const page = document.body.getAttribute('data-page');
  
  if (page === 'home') {
    initHome();
  } else if (page === 'product') {
    initProductPage();
  } else if (page === 'rfq') {
    initHome().then(() => {
      initRfqPage();
    });
  }
});
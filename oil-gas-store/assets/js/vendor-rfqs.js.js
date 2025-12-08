// assets/js/vendor-rfqs.js

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
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-rfqs-btn');
const rfqsTableBody = document.getElementById('rfqs-table-body');
const rfqsEmpty = document.getElementById('rfqs-empty');
const rfqsLoading = document.getElementById('rfqs-loading');
const deleteModal = document.getElementById('deleteModal');
const rfqDetailModal = document.getElementById('rfqDetailModal');
const rfqDetailContent = document.getElementById('rfq-detail-content');

// Global State
let currentUser = null;
let vendorProducts = [];
let vendorRfqs = [];
let currentFilter = 'all';
let rfqToDelete = null;

// Format date
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp || !timestamp.toDate) return 'N/A';
  return timestamp.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Show notification
function showNotification(message, type = 'success') {
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
  
  setTimeout(() => {
    if (notification.parentNode) {
      const bsAlert = new bootstrap.Alert(notification);
      bsAlert.close();
    }
  }, 3000);
}

// Load vendor's products
async function loadVendorProducts() {
  if (!currentUser) return [];
  
  try {
    const q = query(
      collection(db, 'products'),
      where('vendorId', '==', currentUser.uid)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error loading vendor products:', error);
    return [];
  }
}

// Load RFQs for vendor's products
async function loadVendorRFQs() {
  if (!currentUser) return [];
  
  try {
    // Get vendor's product IDs
    const productIds = vendorProducts.map(p => p.id);
    
    if (productIds.length === 0) {
      return [];
    }
    
    // Get all RFQs
    const rfqsSnapshot = await getDocs(
      query(collection(db, 'rfqs'), orderBy('createdAt', 'desc'))
    );
    
    // Filter RFQs that contain vendor's products
    let rfqs = rfqsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(rfq => {
        if (!rfq.items || !Array.isArray(rfq.items)) return false;
        
        // Check if any item belongs to this vendor
        return rfq.items.some(item => {
          // Check by product ID
          if (productIds.includes(item.id)) return true;
          
          // Check by vendorId in item
          if (item.vendorId === currentUser.uid) return true;
          
          return false;
        });
      });
    
    // Apply filter
    if (currentFilter !== 'all') {
      rfqs = rfqs.filter(rfq => rfq.status === currentFilter);
    }
    
    return rfqs;
  } catch (error) {
    console.error('Error loading vendor RFQs:', error);
    return [];
  }
}

// Update stats
function updateStats() {
  const total = vendorRfqs.length;
  const pending = vendorRfqs.filter(rfq => rfq.status === 'pending').length;
  
  // Count this week's RFQs
  const now = new Date();
  const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const weekCount = vendorRfqs.filter(rfq => {
    if (!rfq.createdAt?.toDate) return false;
    const rfqDate = rfq.createdAt.toDate();
    return rfqDate >= firstDayOfWeek;
  }).length;
  
  // Count today's RFQs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = vendorRfqs.filter(rfq => {
    if (!rfq.createdAt?.toDate) return false;
    const rfqDate = rfq.createdAt.toDate();
    return rfqDate >= today;
  }).length;
  
  // Update DOM
  document.getElementById('stats-total').textContent = total;
  document.getElementById('stats-pending').textContent = pending;
  document.getElementById('stats-week').textContent = weekCount;
  document.getElementById('stats-today').textContent = todayCount;
  
  // Update badge
  const badge = document.getElementById('rfq-count-badge');
  if (pending > 0) {
    badge.textContent = pending;
    badge.classList.remove('d-none');
  } else {
    badge.classList.add('d-none');
  }
}

// Render RFQs table
function renderRFQs() {
  if (!rfqsTableBody) return;
  
  if (vendorRfqs.length === 0) {
    rfqsTableBody.innerHTML = '';
    rfqsEmpty.classList.remove('d-none');
    return;
  }
  
  rfqsEmpty.classList.add('d-none');
  
  rfqsTableBody.innerHTML = vendorRfqs.map(rfq => {
    const date = rfq.createdAt?.toDate ? formatTimestamp(rfq.createdAt.toDate()) : 'N/A';
    const status = rfq.status || 'pending';
    const statusClass = status === 'pending' ? 'warning' : 
                       status === 'reviewed' ? 'info' : 
                       status === 'responded' ? 'success' : 'secondary';
    
    // Get vendor's products from this RFQ
    const vendorItems = rfq.items ? rfq.items.filter(item => {
      return vendorProducts.some(p => p.id === item.id) || item.vendorId === currentUser.uid;
    }) : [];
    
    const productsCount = vendorItems.length;
    const totalQty = vendorItems.reduce((sum, item) => sum + (item.qty || 1), 0);
    
    return `
      <tr>
        <td>
          <div class="fw-semibold">${rfq.company || 'N/A'}</div>
          <small class="text-muted">${rfq.project || 'No project'}</small>
        </td>
        <td>
          <div>${rfq.contact || 'N/A'}</div>
          <small class="text-muted">${rfq.email || ''}</small>
        </td>
        <td>
          <div>${productsCount} product(s)</div>
          <small class="text-muted">${totalQty} total units</small>
        </td>
        <td>
          <small class="text-muted">${date}</small>
        </td>
        <td>
          <span class="badge bg-${statusClass}">${status}</span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary view-rfq-btn me-1" data-rfq-id="${rfq.id}">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-rfq-btn" data-rfq-id="${rfq.id}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event listeners
  document.querySelectorAll('.view-rfq-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rfqId = e.target.closest('.view-rfq-btn').dataset.rfqId;
      viewRFQDetails(rfqId);
    });
  });
  
  document.querySelectorAll('.delete-rfq-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rfqId = e.target.closest('.delete-rfq-btn').dataset.rfqId;
      confirmDeleteRFQ(rfqId);
    });
  });
}

// View RFQ details
async function viewRFQDetails(rfqId) {
  try {
    const rfq = vendorRfqs.find(r => r.id === rfqId);
    if (!rfq) return;
    
    const date = rfq.createdAt?.toDate ? formatTimestamp(rfq.createdAt.toDate()) : 'N/A';
    const status = rfq.status || 'pending';
    
    // Get vendor's products from this RFQ
    const vendorItems = rfq.items ? rfq.items.filter(item => {
      return vendorProducts.some(p => p.id === item.id) || item.vendorId === currentUser.uid;
    }) : [];
    
    let itemsHTML = '';
    if (vendorItems.length > 0) {
      itemsHTML = vendorItems.map(item => {
        const product = vendorProducts.find(p => p.id === item.id) || {};
        return `
          <tr>
            <td>${item.qty || 1}</td>
            <td>${product.partNumber || item.partNumber || 'N/A'}</td>
            <td>${product.name || item.name || 'Unknown'}</td>
            <td>${product.category || 'N/A'}</td>
          </tr>
        `;
      }).join('');
    } else {
      itemsHTML = '<tr><td colspan="4" class="text-center text-muted">No products found</td></tr>';
    }
    
    rfqDetailContent.innerHTML = `
      <div class="row mb-4">
        <div class="col-md-6">
          <h6 class="fw-semibold mb-2">Company Information</h6>
          <p class="mb-1"><strong>Company:</strong> ${rfq.company || 'N/A'}</p>
          <p class="mb-1"><strong>Contact:</strong> ${rfq.contact || 'N/A'}</p>
          <p class="mb-1"><strong>Email:</strong> <a href="mailto:${rfq.email}">${rfq.email || 'N/A'}</a></p>
          <p class="mb-1"><strong>Phone:</strong> ${rfq.phone || 'N/A'}</p>
        </div>
        <div class="col-md-6">
          <h6 class="fw-semibold mb-2">Request Details</h6>
          <p class="mb-1"><strong>Project:</strong> ${rfq.project || 'Not specified'}</p>
          <p class="mb-1"><strong>Delivery:</strong> ${rfq.delivery || 'Not specified'}</p>
          <p class="mb-1"><strong>Status:</strong> <span class="badge bg-${status === 'pending' ? 'warning' : 'info'}">${status}</span></p>
          <p class="mb-0"><strong>Submitted:</strong> ${date}</p>
        </div>
      </div>
      
      <h6 class="fw-semibold mb-3">Requested Products (Your Products)</h6>
      <div class="table-responsive mb-4">
        <table class="table table-sm">
          <thead class="table-light">
            <tr>
              <th>Qty</th>
              <th>Part No</th>
              <th>Product Name</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
      </div>
      
      ${rfq.notes ? `
      <h6 class="fw-semibold mb-2">Additional Notes</h6>
      <div class="card bg-light">
        <div class="card-body">
          <p class="mb-0">${rfq.notes}</p>
        </div>
      </div>
      ` : ''}
    `;
    
    // Set delete button data
    document.getElementById('delete-rfq-btn').dataset.rfqId = rfqId;
    
    // Show modal
    const modal = new bootstrap.Modal(rfqDetailModal);
    modal.show();
    
    // Mark as viewed
    if (!rfq.viewed) {
      await markRFQAsViewed(rfqId);
    }
    
  } catch (error) {
    console.error('Error loading RFQ details:', error);
    showNotification('Error loading RFQ details', 'danger');
  }
}

// Mark RFQ as viewed
async function markRFQAsViewed(rfqId) {
  try {
    const rfqRef = doc(db, 'rfqs', rfqId);
    await updateDoc(rfqRef, {
      viewed: true,
      viewedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error marking RFQ as viewed:', error);
  }
}

// Confirm delete RFQ
function confirmDeleteRFQ(rfqId) {
  rfqToDelete = rfqId;
  const modal = new bootstrap.Modal(deleteModal);
  modal.show();
}

// Delete RFQ
async function deleteRFQ(rfqId) {
  try {
    // First verify this RFQ belongs to the vendor
    const rfq = vendorRfqs.find(r => r.id === rfqId);
    if (!rfq) {
      showNotification('RFQ not found or access denied', 'danger');
      return;
    }
    
    // Check if any item belongs to this vendor
    const hasVendorProducts = rfq.items?.some(item => {
      return vendorProducts.some(p => p.id === item.id) || item.vendorId === currentUser.uid;
    });
    
    if (!hasVendorProducts) {
      showNotification('You cannot delete this RFQ', 'danger');
      return;
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, 'rfqs', rfqId));
    
    // Remove from local array
    vendorRfqs = vendorRfqs.filter(r => r.id !== rfqId);
    
    // Update UI
    updateStats();
    renderRFQs();
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(deleteModal);
    if (modal) modal.hide();
    
    showNotification('RFQ deleted successfully', 'success');
    
  } catch (error) {
    console.error('Error deleting RFQ:', error);
    showNotification('Error deleting RFQ', 'danger');
  }
}

// Respond to RFQ
function respondToRFQ(rfqId) {
  const rfq = vendorRfqs.find(r => r.id === rfqId);
  if (!rfq) return;
  
  const emailBody = `
    Re: RFQ from ${rfq.company}
    
    Dear ${rfq.contact},
    
    Thank you for your interest in our products through Nahj Al-Rasanah platform.
    
    Regarding your RFQ submitted on ${rfq.createdAt?.toDate ? formatDate(rfq.createdAt.toDate()) : 'N/A'}:
    
    ${rfq.items?.filter(item => vendorProducts.some(p => p.id === item.id)).map(item => {
      const product = vendorProducts.find(p => p.id === item.id) || {};
      return `  - ${item.qty}x ${product.name || item.name} (Part: ${product.partNumber || item.partNumber})`;
    }).join('\n')}
    
    We will review your request and get back to you shortly with pricing and availability.
    
    Best regards,
    ${currentUser?.email || 'Vendor'}
    Nahj Al-Rasanah Platform
  `;
  
  const mailtoLink = `mailto:${rfq.email}?subject=Re: RFQ from ${rfq.company}&body=${encodeURIComponent(emailBody)}`;
  window.open(mailtoLink, '_blank');
  
  // Update status
  updateRFQStatus(rfqId, 'responded');
}

// Update RFQ status
async function updateRFQStatus(rfqId, status) {
  try {
    const rfqRef = doc(db, 'rfqs', rfqId);
    await updateDoc(rfqRef, {
      status: status,
      respondedAt: Timestamp.now(),
      vendorId: currentUser.uid
    });
    
    // Update local array
    const rfqIndex = vendorRfqs.findIndex(r => r.id === rfqId);
    if (rfqIndex !== -1) {
      vendorRfqs[rfqIndex].status = status;
    }
    
    // Update UI
    updateStats();
    renderRFQs();
    
  } catch (error) {
    console.error('Error updating RFQ status:', error);
  }
}

// Refresh data
async function refreshData() {
  showLoading(true);
  
  vendorProducts = await loadVendorProducts();
  vendorRfqs = await loadVendorRFQs();
  
  updateStats();
  renderRFQs();
  
  showLoading(false);
}

// Show/hide loading
function showLoading(show) {
  if (rfqsLoading) {
    rfqsLoading.style.display = show ? 'block' : 'none';
  }
  if (rfqsTableBody) {
    rfqsTableBody.style.opacity = show ? '0.5' : '1';
  }
}

// Initialize
async function init() {
  // Update copyright year
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
  
  // Setup authentication
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
      // User is signed in
      await refreshData();
    } else {
      // User is signed out, redirect to login
      window.location.href = 'vendor-login.html';
    }
  });
  
  // Event Listeners
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Error signing out:', error);
        showNotification('Error signing out', 'danger');
      }
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refreshing...';
      refreshBtn.disabled = true;
      
      await refreshData();
      
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
      refreshBtn.disabled = false;
      
      showNotification('RFQs refreshed successfully', 'success');
    });
  }
  
  // Filter options
  document.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilter = e.target.dataset.filter;
      
      // Update button text
      const filterBtn = document.querySelector('[data-bs-toggle="dropdown"]');
      if (filterBtn) {
        filterBtn.innerHTML = `<i class="bi bi-filter"></i> ${e.target.textContent}`;
      }
      
      refreshData();
    });
  });
  
  // Confirm delete button
  document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
    if (rfqToDelete) {
      deleteRFQ(rfqToDelete);
    }
  });
  
  // Respond button in modal
  document.getElementById('respond-rfq-btn')?.addEventListener('click', () => {
    const rfqId = document.getElementById('delete-rfq-btn').dataset.rfqId;
    if (rfqId) {
      respondToRFQ(rfqId);
      const modal = bootstrap.Modal.getInstance(rfqDetailModal);
      if (modal) modal.hide();
    }
  });
  
  // Delete button in modal
  document.getElementById('delete-rfq-btn')?.addEventListener('click', () => {
    const rfqId = document.getElementById('delete-rfq-btn').dataset.rfqId;
    if (rfqId) {
      const modal = bootstrap.Modal.getInstance(rfqDetailModal);
      if (modal) modal.hide();
      confirmDeleteRFQ(rfqId);
    }
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
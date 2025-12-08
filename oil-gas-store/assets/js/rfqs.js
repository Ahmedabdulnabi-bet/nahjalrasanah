// assets/js/rfqs.js - محسّن

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
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authMessage = document.getElementById('rfq-auth-message');
const rfqsSection = document.getElementById('rfqs-section');
const logoutBtn = document.getElementById('rfqs-logout-btn');
const currentUserEmailEl = document.getElementById('rfqs-current-user-email');
const rfqsTableBody = document.getElementById('rfqs-table-body');
const rfqsStatus = document.getElementById('rfqs-status');
const rfqsLoading = document.getElementById('rfqs-loading');
const rfqsEmpty = document.getElementById('rfqs-empty');
const refreshBtn = document.getElementById('refresh-rfqs-btn');
const rfqDetailsModal = document.getElementById('rfqDetailsModal');
const updateStatusModal = document.getElementById('updateStatusModal');

// State
let currentUser = null;
let userRole = 'guest';
let rfqs = [];
let currentPage = 1;
const pageSize = 10;
let lastVisible = null;
let hasMore = true;
let currentStatusFilter = 'all';

// Status colors
const statusColors = {
  pending: 'warning',
  reviewed: 'info',
  quoted: 'success',
  closed: 'secondary'
};

const statusLabels = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  quoted: 'Quoted',
  closed: 'Closed'
};

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp || !timestamp.toDate) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Load RFQs
async function loadRFQs(reset = true) {
  if (userRole === 'guest') return;
  
  if (reset) {
    currentPage = 1;
    lastVisible = null;
    hasMore = true;
    rfqs = [];
  }
  
  showLoading(true);
  
  try {
    let q = query(
      collection(db, 'rfqs'),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1) // Get one extra to check if there's more
    );
    
    // Apply status filter
    if (currentStatusFilter !== 'all') {
      q = query(q, where('status', '==', currentStatusFilter));
    }
    
    // Apply pagination
    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }
    
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    
    // Check if there are more pages
    hasMore = docs.length > pageSize;
    
    // Remove the extra doc
    const pageDocs = docs.slice(0, pageSize);
    
    if (reset) {
      rfqs = pageDocs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      rfqs = [...rfqs, ...pageDocs.map(d => ({ id: d.id, ...d.data() }))];
    }
    
    // Update last visible for pagination
    if (pageDocs.length > 0) {
      lastVisible = pageDocs[pageDocs.length - 1];
    }
    
    renderRFQs();
    updateStats();
    
  } catch (error) {
    console.error('Error loading RFQs:', error);
    rfqsStatus.textContent = 'Error loading RFQs. Please try again.';
    showError('Failed to load RFQs. Please check your connection.');
  } finally {
    showLoading(false);
  }
}

// Render RFQs table
function renderRFQs() {
  if (!rfqsTableBody) return;
  
  if (rfqs.length === 0) {
    rfqsTableBody.innerHTML = '';
    rfqsEmpty.classList.remove('d-none');
    return;
  }
  
  rfqsEmpty.classList.add('d-none');
  
  rfqsTableBody.innerHTML = rfqs.map((rfq, index) => {
    const date = rfq.createdAt?.toDate ? formatDate(rfq.createdAt.toDate()) : 'N/A';
    const itemsCount = rfq.items?.length || 0;
    const status = rfq.status || 'pending';
    const statusColor = statusColors[status] || 'secondary';
    
    return `
      <tr data-rfq-id="${rfq.id}">
        <td>
          <div class="small text-muted">${rfq.id.substring(0, 8)}...</div>
        </td>
        <td>
          <div class="fw-semibold">${rfq.company || 'N/A'}</div>
          <div class="small text-muted">${rfq.project || 'No project specified'}</div>
        </td>
        <td>
          <div>${rfq.contact || 'N/A'}</div>
          <div class="small text-muted">${rfq.email || ''}</div>
        </td>
        <td>
          <span class="badge bg-light text-dark">${itemsCount} item(s)</span>
        </td>
        <td>
          <div class="small">${date}</div>
        </td>
        <td>
          <span class="badge bg-${statusColor}">${statusLabels[status] || status}</span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary view-rfq-btn" data-rfq-id="${rfq.id}">
            <i class="bi bi-eye"></i> View
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event listeners to view buttons
  document.querySelectorAll('.view-rfq-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rfqId = e.target.closest('.view-rfq-btn').dataset.rfqId;
      viewRFQDetails(rfqId);
    });
  });
  
  // Update pagination
  updatePagination();
}

// Update statistics
function updateStats() {
  const totalCount = rfqs.length;
  const pendingCount = rfqs.filter(rfq => rfq.status === 'pending').length;
  const reviewedCount = rfqs.filter(rfq => rfq.status === 'reviewed').length;
  
  // Count this month's RFQs
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthCount = rfqs.filter(rfq => {
    if (!rfq.createdAt?.toDate) return false;
    const rfqDate = rfq.createdAt.toDate();
    return rfqDate >= firstDayOfMonth;
  }).length;
  
  // Update counters
  document.getElementById('rfq-total-count').textContent = totalCount;
  document.getElementById('rfq-pending-count').textContent = pendingCount;
  document.getElementById('rfq-reviewed-count').textContent = reviewedCount;
  document.getElementById('rfq-month-count').textContent = thisMonthCount;
}

// Update pagination
function updatePagination() {
  const pagination = document.getElementById('rfqs-pagination');
  if (!pagination) return;
  
  pagination.innerHTML = '';
  
  if (currentPage > 1) {
    const prevLi = document.createElement('li');
    prevLi.className = 'page-item';
    prevLi.innerHTML = `
      <a class="page-link" href="#" data-page="${currentPage - 1}">
        <i class="bi bi-chevron-left"></i> Previous
      </a>
    `;
    pagination.appendChild(prevLi);
  }
  
  // Page numbers
  const pageNumberLi = document.createElement('li');
  pageNumberLi.className = 'page-item disabled';
  pageNumberLi.innerHTML = `
    <span class="page-link">
      Page ${currentPage}
    </span>
  `;
  pagination.appendChild(pageNumberLi);
  
  if (hasMore) {
    const nextLi = document.createElement('li');
    nextLi.className = 'page-item';
    nextLi.innerHTML = `
      <a class="page-link" href="#" data-page="${currentPage + 1}">
        Next <i class="bi bi-chevron-right"></i>
      </a>
    `;
    pagination.appendChild(nextLi);
  }
  
  // Add event listeners
  pagination.querySelectorAll('.page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = parseInt(link.dataset.page);
      if (page > currentPage) {
        loadRFQs(false);
      } else if (page < currentPage) {
        // For previous page, we'd need to store history
        // For now, just reload from beginning
        loadRFQs(true);
      }
      currentPage = page;
    });
  });
}

// View RFQ details
async function viewRFQDetails(rfqId) {
  try {
    const docRef = doc(db, 'rfqs', rfqId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const rfq = { id: docSnap.id, ...docSnap.data() };
      const date = rfq.createdAt?.toDate ? formatTimestamp(rfq.createdAt.toDate()) : 'N/A';
      const status = rfq.status || 'pending';
      
      // Load products for item details
      const products = await loadProducts();
      
      let itemsHTML = '';
      if (rfq.items && rfq.items.length > 0) {
        itemsHTML = rfq.items.map(item => {
          const product = products.find(p => p.id === item.id) || {};
          return `
            <tr>
              <td>${item.qty || 1}</td>
              <td>${product.partNumber || item.partNumber || 'N/A'}</td>
              <td>${product.name || item.name || 'Unknown Item'}</td>
              <td class="text-end">${product.category || 'N/A'}</td>
            </tr>
          `;
        }).join('');
      } else {
        itemsHTML = '<tr><td colspan="4" class="text-center text-muted">No items found</td></tr>';
      }
      
      const modalContent = document.getElementById('rfq-details-content');
      modalContent.innerHTML = `
        <div class="row mb-4">
          <div class="col-md-6">
            <h6 class="fw-semibold mb-2">Company Information</h6>
            <p class="mb-1"><strong>Company:</strong> ${rfq.company || 'N/A'}</p>
            <p class="mb-1"><strong>Contact:</strong> ${rfq.contact || 'N/A'}</p>
            <p class="mb-1"><strong>Email:</strong> <a href="mailto:${rfq.email}">${rfq.email || 'N/A'}</a></p>
            <p class="mb-1"><strong>Phone:</strong> ${rfq.phone || 'N/A'}</p>
          </div>
          <div class="col-md-6">
            <h6 class="fw-semibold mb-2">Project Details</h6>
            <p class="mb-1"><strong>Project:</strong> ${rfq.project || 'Not specified'}</p>
            <p class="mb-1"><strong>Delivery:</strong> ${rfq.delivery || 'Not specified'}</p>
            <p class="mb-1"><strong>Status:</strong> <span class="badge bg-${statusColors[status]}">${statusLabels[status] || status}</span></p>
            <p class="mb-0"><strong>Submitted:</strong> ${date}</p>
          </div>
        </div>
        
        <h6 class="fw-semibold mb-3">Requested Items</h6>
        <div class="table-responsive mb-4">
          <table class="table table-sm">
            <thead class="table-light">
              <tr>
                <th>Qty</th>
                <th>Part No</th>
                <th>Item Name</th>
                <th class="text-end">Category</th>
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
      
      // Store RFQ ID for status update
      document.getElementById('rfq-id').value = rfqId;
      document.getElementById('rfq-status-select').value = status;
      
      // Show modal
      const modal = new bootstrap.Modal(rfqDetailsModal);
      modal.show();
      
    } else {
      showError('RFQ not found.');
    }
  } catch (error) {
    console.error('Error loading RFQ details:', error);
    showError('Failed to load RFQ details.');
  }
}

// Load products for reference
async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

// Update RFQ status
async function updateRFQStatus(rfqId, status, notes = '') {
  try {
    const docRef = doc(db, 'rfqs', rfqId);
    await updateDoc(docRef, {
      status: status,
      updatedAt: Timestamp.now(),
      adminNotes: notes
    });
    
    // Reload RFQs
    loadRFQs(true);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(updateStatusModal);
    if (modal) modal.hide();
    
    showSuccess('RFQ status updated successfully!');
    
  } catch (error) {
    console.error('Error updating RFQ status:', error);
    showError('Failed to update RFQ status.');
  }
}

// Show loading state
function showLoading(show) {
  if (rfqsLoading) {
    rfqsLoading.style.display = show ? 'block' : 'none';
  }
  if (rfqsTableBody) {
    rfqsTableBody.style.opacity = show ? '0.5' : '1';
  }
}

// Show success message
function showSuccess(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
  alert.style.cssText = `
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
  `;
  alert.innerHTML = `
    <i class="bi bi-check-circle"></i> ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alert);
  
  setTimeout(() => {
    if (alert.parentNode) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }
  }, 3000);
}

// Show error message
function showError(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger alert-dismissible fade show position-fixed';
  alert.style.cssText = `
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
  `;
  alert.innerHTML = `
    <i class="bi bi-exclamation-triangle"></i> ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alert);
  
  setTimeout(() => {
    if (alert.parentNode) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }
  }, 5000);
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
      userRole = 'vendor'; // Default role
      
      // Try to get user role from Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.role === 'admin') {
            userRole = 'admin';
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
      
      // Update UI for authenticated user
      if (authMessage) authMessage.classList.add('d-none');
      if (rfqsSection) rfqsSection.classList.remove('d-none');
      if (currentUserEmailEl) {
        currentUserEmailEl.textContent = user.email;
        currentUserEmailEl.classList.remove('d-none');
      }
      if (logoutBtn) logoutBtn.classList.remove('d-none');
      
      // Update subtitle with role
      const subtitle = document.getElementById('rfqs-subtitle');
      if (subtitle) {
        subtitle.textContent = `Logged in as ${userRole.toUpperCase()}`;
      }
      
      // Load RFQs
      await loadRFQs(true);
      
    } else {
      // User is signed out
      userRole = 'guest';
      if (authMessage) authMessage.classList.remove('d-none');
      if (rfqsSection) rfqsSection.classList.add('d-none');
      if (currentUserEmailEl) currentUserEmailEl.classList.add('d-none');
      if (logoutBtn) logoutBtn.classList.add('d-none');
    }
  });
  
  // Setup event listeners
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Error signing out:', error);
      }
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadRFQs(true);
    });
  }
  
  // Status filter
  document.querySelectorAll('[data-status]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      currentStatusFilter = e.target.dataset.status;
      loadRFQs(true);
    });
  });
  
  // Print RFQ button
  document.getElementById('print-rfq-btn')?.addEventListener('click', () => {
    window.print();
  });
  
  // Update status button
  document.getElementById('update-status-btn')?.addEventListener('click', () => {
    const updateModal = new bootstrap.Modal(updateStatusModal);
    updateModal.show();
  });
  
  // Save status button
  document.getElementById('save-status-btn')?.addEventListener('click', () => {
    const rfqId = document.getElementById('rfq-id').value;
    const status = document.getElementById('rfq-status-select').value;
    const notes = document.getElementById('rfq-status-notes').value;
    
    if (rfqId) {
      updateRFQStatus(rfqId, status, notes);
    }
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
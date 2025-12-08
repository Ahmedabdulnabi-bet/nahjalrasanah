// assets/js/vendor-dashboard.js

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
  limit,
  doc,
  getDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const vendorNameEl = document.getElementById('vendor-name');
const totalProductsEl = document.getElementById('total-products');
const totalRfqsEl = document.getElementById('total-rfqs');
const pendingRfqsEl = document.getElementById('pending-rfqs');
const monthRfqsEl = document.getElementById('month-rfqs');
const recentRfqsTable = document.getElementById('recent-rfqs-table');
const noRfqsMessage = document.getElementById('no-rfqs-message');
const refreshBtn = document.getElementById('refresh-dashboard-btn');
const accountEmailEl = document.getElementById('account-email');
const accountTypeEl = document.getElementById('account-type');
const memberSinceEl = document.getElementById('member-since');
const rfqNotificationBadge = document.getElementById('rfq-notification-badge');

// Global State
let currentUser = null;
let vendorProducts = [];
let vendorRfqs = [];

// Format date
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format timestamp
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
    // First get vendor's product IDs
    const productIds = vendorProducts.map(p => p.id);
    
    if (productIds.length === 0) {
      return [];
    }
    
    // Get all RFQs
    const rfqsSnapshot = await getDocs(
      query(collection(db, 'rfqs'), orderBy('createdAt', 'desc'))
    );
    
    // Filter RFQs that contain vendor's products
    const rfqs = rfqsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(rfq => {
        if (!rfq.items || !Array.isArray(rfq.items)) return false;
        
        // Check if any item belongs to this vendor
        return rfq.items.some(item => {
          // Check by product ID
          if (productIds.includes(item.id)) return true;
          
          // Check by vendorId in item (if stored)
          if (item.vendorId === currentUser.uid) return true;
          
          return false;
        });
      });
    
    return rfqs;
  } catch (error) {
    console.error('Error loading vendor RFQs:', error);
    return [];
  }
}

// Update dashboard stats
function updateDashboardStats() {
  // Update product count
  totalProductsEl.textContent = vendorProducts.length;
  
  // Update RFQ counts
  totalRfqsEl.textContent = vendorRfqs.length;
  
  const pendingCount = vendorRfqs.filter(rfq => rfq.status === 'pending').length;
  pendingRfqsEl.textContent = pendingCount;
  
  // Count this month's RFQs
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = vendorRfqs.filter(rfq => {
    if (!rfq.createdAt?.toDate) return false;
    const rfqDate = rfq.createdAt.toDate();
    return rfqDate >= firstDayOfMonth;
  }).length;
  
  monthRfqsEl.textContent = monthCount;
  
  // Update notification badge
  if (pendingCount > 0) {
    rfqNotificationBadge.textContent = pendingCount;
    rfqNotificationBadge.classList.remove('d-none');
  } else {
    rfqNotificationBadge.classList.add('d-none');
  }
}

// Render recent RFQs
function renderRecentRFQs() {
  if (!recentRfqsTable) return;
  
  const recentRFQs = vendorRfqs.slice(0, 5); // Last 5 RFQs
  
  if (recentRFQs.length === 0) {
    recentRfqsTable.innerHTML = '';
    noRfqsMessage.classList.remove('d-none');
    return;
  }
  
  noRfqsMessage.classList.add('d-none');
  
  recentRfqsTable.innerHTML = recentRFQs.map(rfq => {
    const date = rfq.createdAt?.toDate ? formatTimestamp(rfq.createdAt.toDate()) : 'N/A';
    const status = rfq.status || 'pending';
    const statusClass = status === 'pending' ? 'warning' : 
                       status === 'reviewed' ? 'info' : 
                       status === 'responded' ? 'success' : 'secondary';
    
    // Get first product name from RFQ
    const firstProduct = rfq.items && rfq.items.length > 0 ? rfq.items[0] : null;
    const productName = firstProduct ? firstProduct.name : 'Multiple Products';
    const totalQty = rfq.items ? rfq.items.reduce((sum, item) => sum + (item.qty || 1), 0) : 0;
    
    return `
      <tr>
        <td>
          <div class="fw-semibold">${rfq.company || 'N/A'}</div>
          <small class="text-muted">${rfq.contact || ''}</small>
        </td>
        <td>${productName}</td>
        <td>${totalQty}</td>
        <td>
          <small class="text-muted">${date}</small>
        </td>
        <td>
          <span class="badge bg-${statusClass}">${status}</span>
        </td>
        <td class="text-end">
          <a href="vendor-rfq-detail.html?id=${rfq.id}" class="btn btn-sm btn-outline-primary">
            <i class="bi bi-eye"></i> View
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

// Mark RFQ as viewed
async function markRFQAsViewed(rfqId) {
  try {
    const rfqRef = doc(db, 'rfqs', rfqId);
    await updateDoc(rfqRef, {
      viewed: true,
      viewedAt: new Date()
    });
  } catch (error) {
    console.error('Error marking RFQ as viewed:', error);
  }
}

// Update account info
function updateAccountInfo(user) {
  if (vendorNameEl) {
    vendorNameEl.textContent = user.displayName || user.email.split('@')[0];
  }
  
  if (accountEmailEl) {
    accountEmailEl.textContent = user.email;
  }
  
  if (memberSinceEl) {
    const createdDate = user.metadata.creationTime ? 
      new Date(user.metadata.creationTime) : new Date();
    memberSinceEl.textContent = formatDate(createdDate);
  }
}

// Refresh dashboard
async function refreshDashboard() {
  vendorProducts = await loadVendorProducts();
  vendorRfqs = await loadVendorRFQs();
  
  updateDashboardStats();
  renderRecentRFQs();
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
      updateAccountInfo(user);
      
      // Load vendor data
      await refreshDashboard();
      
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
        showNotification('Error signing out. Please try again.', 'danger');
      }
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refreshing...';
      refreshBtn.disabled = true;
      
      await refreshDashboard();
      
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Dashboard';
      refreshBtn.disabled = false;
      
      showNotification('Dashboard refreshed successfully!', 'success');
    });
  }
  
  if (document.getElementById('account-settings-btn')) {
    document.getElementById('account-settings-btn').addEventListener('click', () => {
      showNotification('Account settings feature coming soon!', 'info');
    });
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
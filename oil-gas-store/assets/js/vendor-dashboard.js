// assets/js/vendor-dashboard.js

import { firebaseConfig } from './firebase-config.js';
import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Load vendor data
async function loadVendorData(user) {
  if (!user) {
    window.location.href = 'vendor-login.html';
    return;
  }

  try {
    // Load vendor's products
    const productsQuery = query(
      collection(db, 'products'),
      where('vendorId', '==', user.uid)
    );
    const productsSnapshot = await getDocs(productsQuery);
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Update product counts
    document.getElementById('products-count').textContent = products.length;
    document.getElementById('active-count').textContent = products.filter(p => p.isActive !== false).length;
    
    // Load RFQs for vendor's products
    const productIds = products.map(p => p.id);
    if (productIds.length > 0) {
      const rfqsQuery = query(
        collection(db, 'rfqs'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const rfqsSnapshot = await getDocs(rfqsQuery);
      
      const vendorRfqs = rfqsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(rfq => {
          if (!rfq.items) return false;
          return rfq.items.some(item => productIds.includes(item.id));
        });
      
      // Update RFQ counts
      document.getElementById('rfqs-count').textContent = vendorRfqs.length;
      document.getElementById('pending-count').textContent = vendorRfqs.filter(rfq => rfq.status === 'pending').length;
      
      // Display recent RFQs
      displayRecentRFQs(vendorRfqs.slice(0, 5), products);
    }
    
    // Update account info
    document.getElementById('account-email').textContent = user.email;
    if (user.metadata.creationTime) {
      const joinDate = new Date(user.metadata.creationTime);
      document.getElementById('join-date').textContent = joinDate.toLocaleDateString();
    }
    
  } catch (error) {
    console.error('Error loading vendor data:', error);
  }
}

// Display recent RFQs
function displayRecentRFQs(rfqs, products) {
  const container = document.getElementById('recent-rfqs');
  if (!container) return;
  
  if (rfqs.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">
          <i class="bi bi-envelope display-5 mb-3"></i><br>
          No RFQs yet
        </td>
      </tr>
    `;
    return;
  }
  
  container.innerHTML = rfqs.map(rfq => {
    // Get first product from this vendor
    const vendorItem = rfq.items?.find(item => 
      products.some(p => p.id === item.id)
    ) || {};
    
    const product = products.find(p => p.id === vendorItem.id) || {};
    const date = rfq.createdAt?.toDate ? 
      rfq.createdAt.toDate().toLocaleDateString() : 'N/A';
    
    return `
      <tr onclick="window.location.href='vendor-rfq-detail.html?id=${rfq.id}'" style="cursor:pointer">
        <td>${rfq.company || 'N/A'}</td>
        <td>${product.name || vendorItem.name || 'Multiple Products'}</td>
        <td>${date}</td>
        <td><span class="badge bg-warning">${rfq.status || 'pending'}</span></td>
      </tr>
    `;
  }).join('');
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadVendorData(user);
    } else {
      window.location.href = 'vendor-login.html';
    }
  });
});
// assets/js/auth-nav.js

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
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Update navigation based on user role
function updateNavigation(user, userRole) {
  const authContainer = document.getElementById('auth-nav-container');
  const authButton = document.getElementById('auth-link') || document.getElementById('auth-button');
  
  if (!authContainer) return;
  
  if (user) {
    // User is logged in
    if (userRole === 'admin') {
      // Admin user
      authContainer.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
            <i class="bi bi-person-check"></i> Admin
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><a class="dropdown-item" href="admin.html"><i class="bi bi-speedometer2"></i> Admin Panel</a></li>
            <li><a class="dropdown-item" href="rfqs.html"><i class="bi bi-envelope"></i> All RFQs</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="#" id="logout-btn"><i class="bi bi-box-arrow-right"></i> Logout</a></li>
          </ul>
        </div>
      `;
    } else if (userRole === 'vendor') {
      // Vendor user
      authContainer.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
            <i class="bi bi-person-badge"></i> Vendor
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><a class="dropdown-item" href="vendor-dashboard.html"><i class="bi bi-speedometer2"></i> Dashboard</a></li>
            <li><a class="dropdown-item" href="vendor-rfqs.html"><i class="bi bi-envelope"></i> My RFQs</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="#" id="logout-btn"><i class="bi bi-box-arrow-right"></i> Logout</a></li>
          </ul>
        </div>
      `;
    }
    
    // Add logout event listener
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await signOut(auth);
          window.location.reload();
        } catch (error) {
          console.error('Error signing out:', error);
        }
      });
    }
  } else {
    // User is not logged in
    authContainer.innerHTML = `
      <a href="admin.html" class="btn btn-outline-light btn-sm ms-lg-3 d-flex align-items-center gap-1">
        <i class="bi bi-person-fill-lock"></i>
        <span>Vendor/Admin Login</span>
      </a>
    `;
  }
}

// Initialize navigation
async function initNavigation() {
  const authContainer = document.getElementById('auth-nav-container');
  if (!authContainer) return;
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in - determine role
      let userRole = 'vendor'; // default
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'admin') {
            userRole = 'admin';
          }
        }
      } catch (error) {
        console.error('Error getting user role:', error);
      }
      
      updateNavigation(user, userRole);
      
      // Show RFQs link in navbar for vendors/admins
      const rfqsNavLink = document.getElementById('nav-rfqs-link');
      if (rfqsNavLink) {
        rfqsNavLink.classList.remove('d-none');
      }
    } else {
      // User is signed out
      updateNavigation(null, 'guest');
      
      // Hide RFQs link
      const rfqsNavLink = document.getElementById('nav-rfqs-link');
      if (rfqsNavLink) {
        rfqsNavLink.classList.add('d-none');
      }
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  
  // Update copyright year
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});
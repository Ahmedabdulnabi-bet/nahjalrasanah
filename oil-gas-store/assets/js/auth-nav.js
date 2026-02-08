// assets/js/auth-nav.js - النسخة المعدلة
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { 
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
  console.log('Auth Navigation Initializing...');
  
  // Initialize Firebase
  let auth, db;
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('✅ Auth Navigation Firebase initialized');
  } catch (error) {
    console.error('❌ Firebase init error:', error);
    return;
  }
  
  // Get user role
  async function getUserRole(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.exists() ? userDoc.data().role : null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }
  
  // Update navigation based on auth state
  onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById('auth-nav-container');
    const authButton = document.getElementById('auth-button');
    const authNavText = document.getElementById('auth-nav-text');
    const authButtonText = document.getElementById('auth-button-text');
    
    if (!authContainer && !authButton) return;
    
    if (user) {
      // User is logged in
      const userRole = await getUserRole(user.uid);
      
      let dashboardLink, buttonText, buttonIcon;
      
      if (userRole === 'admin') {
        dashboardLink = 'admin.html';
        buttonText = 'Admin Panel';
        buttonIcon = 'bi-speedometer2';
      } else if (userRole === 'vendor') {
        dashboardLink = 'vendor-dashboard.html';
        buttonText = 'Vendor Dashboard';
        buttonIcon = 'bi-person-badge';
      } else {
        dashboardLink = 'admin.html';
        buttonText = 'Dashboard';
        buttonIcon = 'bi-person';
      }
      
      // Update auth container
      if (authContainer) {
        authContainer.innerHTML = `
          <div class="dropdown">
            <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
              <i class="bi ${buttonIcon}"></i> ${user.email.split('@')[0]}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" href="${dashboardLink}"><i class="bi ${buttonIcon}"></i> Dashboard</a></li>
              <li><a class="dropdown-item" href="rfqs.html"><i class="bi bi-envelope"></i> RFQs</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item" href="#" id="nav-logout-btn"><i class="bi bi-box-arrow-right"></i> Logout</a></li>
            </ul>
          </div>
        `;
        
        // Add logout event listener
        const logoutBtn = document.getElementById('nav-logout-btn');
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
      }
      
      // Update auth button
      if (authButton) {
        authButton.href = dashboardLink;
        authButton.innerHTML = `
          <i class="bi ${buttonIcon}"></i>
          <span>${buttonText}</span>
        `;
      }
      
      // Update auth text
      if (authNavText) authNavText.textContent = buttonText;
      if (authButtonText) authButtonText.textContent = buttonText;
      
      // Show RFQs link for vendors/admins
      const rfqsNavLink = document.getElementById('nav-rfqs-link');
      if (rfqsNavLink && (userRole === 'admin' || userRole === 'vendor')) {
        rfqsNavLink.classList.remove('d-none');
      }
      
    } else {
      // User is not logged in
      if (authContainer) {
        authContainer.innerHTML = `
          <a href="admin.html" class="btn btn-outline-light btn-sm ms-lg-3 d-flex align-items-center gap-1">
            <i class="bi bi-person-fill-lock"></i>
            <span>Vendor/Admin Login</span>
          </a>
        `;
      }
      
      if (authButton) {
        authButton.href = 'admin.html';
        authButton.innerHTML = `
          <i class="bi bi-person-fill-lock"></i>
          <span>Login</span>
        `;
      }
      
      if (authNavText) authNavText.textContent = 'Admin Login';
      if (authButtonText) authButtonText.textContent = 'Login';
      
      // Hide RFQs link
      const rfqsNavLink = document.getElementById('nav-rfqs-link');
      if (rfqsNavLink) {
        rfqsNavLink.classList.add('d-none');
      }
    }
  });
  
  // Update copyright year
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
  
  console.log('✅ Auth Navigation Initialized');
});
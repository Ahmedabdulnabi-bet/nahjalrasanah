// assets/js/vendor-login.js

import { firebaseConfig } from './firebase-config.js';
import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Handle login form submission
document.getElementById('vendor-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('login-error');
  
  // Clear previous error
  errorElement.classList.add('d-none');
  errorElement.textContent = '';
  
  try {
    // Sign in with email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Redirect to vendor dashboard
    window.location.href = 'vendor-dashboard.html';
    
  } catch (error) {
    console.error('Login error:', error);
    
    // Show error message
    errorElement.textContent = getErrorMessage(error.code);
    errorElement.classList.remove('d-none');
  }
});

// Get user-friendly error message
function getErrorMessage(errorCode) {
  switch(errorCode) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Login failed. Please check your credentials.';
  }
}

// Update copyright year
document.addEventListener('DOMContentLoaded', () => {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});
// assets/js/vendor-login.js - نسخة مبسطة

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAtcnouNdsILUvA9EMvrHMhoaWXkMqTMx0",
    authDomain: "nahj-oilgas-store.firebaseapp.com",
    projectId: "nahj-oilgas-store",
    storageBucket: "nahj-oilgas-store.appspot.com",
    messagingSenderId: "967640800678",
    appId: "1:967640800678:web:4b018066c733c4e4500367",
    measurementId: "G-9XZPG5TJ6W"
};

// Initialize Firebase
let auth;

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    auth = firebase.auth();
    console.log('Login Firebase initialized');
} catch (error) {
    console.error('Firebase init error:', error);
}

// Handle login form submission
document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page loaded');
    
    // Set copyright year
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    const loginForm = document.getElementById('vendor-login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('login-error');
        
        // Clear previous error
        if (errorElement) {
            errorElement.classList.add('d-none');
            errorElement.textContent = '';
        }
        
        // Show loading
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Signing in...';
        
        try {
            // Sign in with email and password
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('Login successful:', user.email);
            
            // Redirect to vendor dashboard
            window.location.href = 'vendor-dashboard.html';
            
        } catch (error) {
            console.error('Login error:', error);
            
            // Show error message
            if (errorElement) {
                errorElement.textContent = getErrorMessage(error.code);
                errorElement.classList.remove('d-none');
            }
            
        } finally {
            // Reset button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
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
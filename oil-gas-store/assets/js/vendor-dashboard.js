// assets/js/vendor-dashboard.js - نسخة مبسطة

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
let auth, db;

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    
    console.log('Dashboard Firebase initialized');
} catch (error) {
    console.error('Firebase init error:', error);
}

// Load vendor data
async function loadVendorData(user) {
    if (!user) {
        window.location.href = 'vendor-login.html';
        return;
    }

    try {
        console.log('Loading data for user:', user.email);
        
        // Load vendor's products
        const productsSnapshot = await db.collection('products')
            .where('vendorId', '==', user.uid)
            .get();
        
        const products = [];
        productsSnapshot.forEach(doc => {
            products.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Products loaded:', products.length);
        
        // Update product counts
        document.getElementById('products-count').textContent = products.length;
        document.getElementById('active-count').textContent = products.filter(p => p.isActive !== false).length;
        
        // Load RFQs
        const rfqsSnapshot = await db.collection('rfqs')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const allRfqs = [];
        rfqsSnapshot.forEach(doc => {
            allRfqs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Filter RFQs for vendor's products
        const productIds = products.map(p => p.id);
        const vendorRfqs = allRfqs.filter(rfq => {
            if (!rfq.items || !Array.isArray(rfq.items)) return false;
            return rfq.items.some(item => productIds.includes(item.id));
        });
        
        // Update RFQ counts
        document.getElementById('rfqs-count').textContent = vendorRfqs.length;
        document.getElementById('pending-count').textContent = vendorRfqs.filter(rfq => rfq.status === 'pending').length;
        
        // Display recent RFQs
        displayRecentRFQs(vendorRfqs.slice(0, 5), products);
        
        // Update account info
        document.getElementById('account-email').textContent = user.email;
        if (user.metadata && user.metadata.creationTime) {
            const joinDate = new Date(user.metadata.creationTime);
            document.getElementById('join-date').textContent = joinDate.toLocaleDateString();
        }
        
    } catch (error) {
        console.error('Error loading vendor data:', error);
        showErrorMessage('Failed to load data. Please refresh.');
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
    
    let html = '';
    rfqs.forEach(rfq => {
        // Get first product from this vendor
        const vendorItem = rfq.items?.find(item => 
            products.some(p => p.id === item.id)
        ) || {};
        
        const product = products.find(p => p.id === vendorItem.id) || {};
        const date = rfq.createdAt?.toDate ? 
            rfq.createdAt.toDate().toLocaleDateString() : 'N/A';
        
        html += `
            <tr onclick="window.location.href='vendor-rfq-detail.html?id=${rfq.id}'" style="cursor:pointer">
                <td>${rfq.company || 'N/A'}</td>
                <td>${product.name || vendorItem.name || 'Multiple Products'}</td>
                <td>${date}</td>
                <td><span class="badge bg-warning">${rfq.status || 'pending'}</span></td>
            </tr>
        `;
    });
    
    container.innerHTML = html;
}

// Show error message
function showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard page loaded');
    
    // Set copyright year
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // Check authentication
    auth.onAuthStateChanged(function(user) {
        if (user) {
            console.log('Dashboard user:', user.email);
            loadVendorData(user);
        } else {
            console.log('No user, redirecting to login');
            window.location.href = 'vendor-login.html';
        }
    });
    
    // Make cards clickable
    document.querySelectorAll('.dashboard-card').forEach(card => {
        card.addEventListener('click', function() {
            const target = this.getAttribute('onclick-target');
            if (target) {
                window.location.href = target;
            }
        });
    });
});
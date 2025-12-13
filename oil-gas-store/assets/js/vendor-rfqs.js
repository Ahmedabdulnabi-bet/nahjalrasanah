// assets/js/vendor-rfqs.js - نسخة مبسطة

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
let currentUser = null;
let vendorProducts = [];
let vendorRfqs = [];

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    
    console.log('RFQs Firebase initialized');
} catch (error) {
    console.error('Firebase init error:', error);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('RFQs page loaded');
    
    // Set copyright year
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // Check authentication
    auth.onAuthStateChanged(function(user) {
        if (user) {
            console.log('RFQs user:', user.email);
            currentUser = user;
            loadVendorData();
            setupEventListeners();
        } else {
            console.log('No user, redirecting');
            window.location.href = 'admin.html';
        }
    });
});

function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadVendorData);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });
    }
    
    // Delete RFQ button
    const deleteBtn = document.getElementById('delete-rfq-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteSelectedRfq);
    }
}

async function loadVendorData() {
    if (!currentUser) return;
    
    console.log('Loading vendor RFQs data...');
    
    try {
        showLoading(true);
        
        // Load vendor's products
        const productsSnapshot = await db.collection('products')
            .where('vendorId', '==', currentUser.uid)
            .get();
        
        vendorProducts = [];
        productsSnapshot.forEach(doc => {
            vendorProducts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Vendor products:', vendorProducts.length);
        
        // Load all RFQs
        const rfqsSnapshot = await db.collection('rfqs')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        const allRfqs = [];
        rfqsSnapshot.forEach(doc => {
            allRfqs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Filter RFQs that contain vendor's products
        vendorRfqs = allRfqs.filter(rfq => {
            if (!rfq.items || !Array.isArray(rfq.items)) return false;
            
            // Check if any item belongs to this vendor
            return rfq.items.some(item => 
                vendorProducts.some(product => product.id === item.id)
            );
        });
        
        console.log('Vendor RFQs:', vendorRfqs.length);
        
        renderRfqsTable();
        updateStats();
        
    } catch (error) {
        console.error('Error loading vendor data:', error);
        showMessage('Error loading data: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

function renderRfqsTable() {
    const rfqsTable = document.getElementById('rfqs-table');
    const noRfqsDiv = document.getElementById('no-rfqs');
    
    if (!rfqsTable) return;
    
    if (vendorRfqs.length === 0) {
        rfqsTable.innerHTML = '';
        if (noRfqsDiv) noRfqsDiv.classList.remove('d-none');
        return;
    }
    
    if (noRfqsDiv) noRfqsDiv.classList.add('d-none');
    
    let html = '';
    vendorRfqs.forEach(rfq => {
        // Get vendor's products from this RFQ
        const vendorItems = rfq.items.filter(item => 
            vendorProducts.some(product => product.id === item.id)
        );
        
        const totalQty = vendorItems.reduce((sum, item) => sum + (item.qty || 1), 0);
        const date = rfq.createdAt?.toDate ? 
            rfq.createdAt.toDate().toLocaleDateString() : 'N/A';
        
        html += `
            <tr>
                <td>
                    <strong>${rfq.company || 'N/A'}</strong><br>
                    <small class="text-muted">${rfq.project || ''}</small>
                </td>
                <td>
                    ${rfq.contact || 'N/A'}<br>
                    <small class="text-muted">${rfq.email || ''}</small>
                </td>
                <td>
                    ${vendorItems.length} product(s)<br>
                    <small class="text-muted">${totalQty} units</small>
                </td>
                <td>${date}</td>
                <td>
                    <span class="badge ${getStatusBadgeClass(rfq.status)}">
                        ${rfq.status || 'pending'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-btn" data-id="${rfq.id}">
                        <i class="bi bi-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    });
    
    rfqsTable.innerHTML = html;
    
    // Add event listeners to view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const rfqId = this.getAttribute('data-id');
            viewRfqDetails(rfqId);
        });
    });
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'pending': return 'bg-warning';
        case 'reviewed': return 'bg-info';
        case 'responded': return 'bg-success';
        case 'cancelled': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

function updateStats() {
    const total = vendorRfqs.length;
    const pending = vendorRfqs.filter(r => r.status === 'pending').length;
    const responded = vendorRfqs.filter(r => r.status === 'responded').length;
    
    // Count this month's RFQs
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = vendorRfqs.filter(rfq => {
        if (!rfq.createdAt?.toDate) return false;
        const rfqDate = rfq.createdAt.toDate();
        return rfqDate >= firstDayOfMonth;
    }).length;
    
    // Update DOM
    const totalEl = document.getElementById('total-rfqs');
    const pendingEl = document.getElementById('pending-rfqs');
    const monthEl = document.getElementById('month-rfqs');
    const respondedEl = document.getElementById('responded-rfqs');
    
    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (monthEl) monthEl.textContent = monthCount;
    if (respondedEl) respondedEl.textContent = responded;
}

function viewRfqDetails(rfqId) {
    const rfq = vendorRfqs.find(r => r.id === rfqId);
    if (!rfq) return;
    
    // Get vendor's products from this RFQ
    const vendorItems = rfq.items.filter(item => 
        vendorProducts.some(product => product.id === item.id)
    );
    
    // Format date
    const date = rfq.createdAt?.toDate ? 
        rfq.createdAt.toDate().toLocaleString() : 'N/A';
    
    // Build details HTML
    let detailsHtml = `
        <h6>Company Information</h6>
        <p><strong>Company:</strong> ${rfq.company || 'N/A'}</p>
        <p><strong>Contact:</strong> ${rfq.contact || 'N/A'}</p>
        <p><strong>Email:</strong> ${rfq.email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${rfq.phone || 'N/A'}</p>
        
        <h6 class="mt-4">Project Details</h6>
        <p><strong>Project:</strong> ${rfq.project || 'Not specified'}</p>
        <p><strong>Delivery:</strong> ${rfq.delivery || 'Not specified'}</p>
        <p><strong>Submitted:</strong> ${date}</p>
        <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(rfq.status)}">${rfq.status || 'pending'}</span></p>
        
        <h6 class="mt-4">Requested Products (Your Products)</h6>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Part No</th>
                    <th>Qty</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    vendorItems.forEach(item => {
        const product = vendorProducts.find(p => p.id === item.id) || {};
        detailsHtml += `
            <tr>
                <td>${product.name || item.name || 'Unknown'}</td>
                <td>${product.partNumber || item.partNumber || 'N/A'}</td>
                <td>${item.qty || 1}</td>
            </tr>
        `;
    });
    
    detailsHtml += `
            </tbody>
        </table>
    `;
    
    if (rfq.notes) {
        detailsHtml += `
            <h6 class="mt-4">Additional Notes</h6>
            <div class="bg-light p-3 rounded">
                ${rfq.notes}
            </div>
        `;
    }
    
    // Set details content
    const detailsEl = document.getElementById('rfq-details');
    if (detailsEl) {
        detailsEl.innerHTML = detailsHtml;
    }
    
    // Store RFQ ID for delete
    window.selectedRfqId = rfqId;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('rfqModal'));
    modal.show();
}

async function deleteSelectedRfq() {
    if (!window.selectedRfqId || !confirm('Are you sure you want to delete this RFQ?')) return;
    
    try {
        // Delete from Firestore
        await db.collection('rfqs').doc(window.selectedRfqId).delete();
        
        // Remove from local array
        vendorRfqs = vendorRfqs.filter(r => r.id !== window.selectedRfqId);
        
        // Update UI
        renderRfqsTable();
        updateStats();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('rfqModal'));
        if (modal) modal.hide();
        
        showMessage('RFQ deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting RFQ:', error);
        showMessage('Error deleting RFQ: ' + error.message, 'danger');
    }
}

function showLoading(show) {
    const saveBtn = document.getElementById('save-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    
    if (saveBtn) saveBtn.disabled = show;
    if (refreshBtn) refreshBtn.disabled = show;
}

function showMessage(text, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
    `;
    alertDiv.innerHTML = `
        ${type === 'success' ? '✅' : '❌'} ${text}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            const bsAlert = new bootstrap.Alert(alertDiv);
            bsAlert.close();
        }
    }, 3000);
}
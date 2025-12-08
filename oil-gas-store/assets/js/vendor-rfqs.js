// assets/js/vendor-rfqs.js

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { 
    getFirestore, collection, getDocs, query, where, 
    orderBy, deleteDoc, doc, updateDoc, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const rfqsTable = document.getElementById('rfqs-table');
const noRfqsDiv = document.getElementById('no-rfqs');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const deleteRfqBtn = document.getElementById('delete-rfq-btn');
const rfqModal = document.getElementById('rfqModal');

// State
let currentUser = null;
let vendorProducts = [];
let vendorRfqs = [];
let selectedRfqId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set copyright year
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadVendorData();
        } else {
            window.location.href = 'admin.html';
        }
    });
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', loadVendorData);
    
    // Logout button
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        });
    });
    
    // Delete RFQ button in modal
    deleteRfqBtn.addEventListener('click', deleteSelectedRfq);
}

async function loadVendorData() {
    if (!currentUser) return;
    
    try {
        // Load vendor's products first
        const productsQuery = query(
            collection(db, 'products'),
            where('vendorId', '==', currentUser.uid)
        );
        const productsSnapshot = await getDocs(productsQuery);
        vendorProducts = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Load all RFQs
        const rfqsQuery = query(
            collection(db, 'rfqs'),
            orderBy('createdAt', 'desc')
        );
        const rfqsSnapshot = await getDocs(rfqsQuery);
        
        // Filter RFQs that contain vendor's products
        vendorRfqs = rfqsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(rfq => {
                if (!rfq.items || !Array.isArray(rfq.items)) return false;
                
                // Check if any item belongs to this vendor
                return rfq.items.some(item => 
                    vendorProducts.some(product => product.id === item.id)
                );
            });
        
        renderRfqsTable();
        updateStats();
        
    } catch (error) {
        console.error('Error loading vendor data:', error);
        alert('Error loading data');
    }
}

function renderRfqsTable() {
    if (vendorRfqs.length === 0) {
        rfqsTable.innerHTML = '';
        noRfqsDiv.classList.remove('d-none');
        return;
    }
    
    noRfqsDiv.classList.add('d-none');
    
    rfqsTable.innerHTML = vendorRfqs.map(rfq => {
        // Get vendor's products from this RFQ
        const vendorItems = rfq.items.filter(item => 
            vendorProducts.some(product => product.id === item.id)
        );
        
        const totalQty = vendorItems.reduce((sum, item) => sum + (item.qty || 1), 0);
        const date = rfq.createdAt?.toDate ? 
            rfq.createdAt.toDate().toLocaleDateString() : 'N/A';
        
        return `
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
    }).join('');
    
    // Add event listeners to view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rfqId = e.target.closest('.view-btn').dataset.id;
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
    document.getElementById('total-rfqs').textContent = total;
    document.getElementById('pending-rfqs').textContent = pending;
    document.getElementById('month-rfqs').textContent = monthCount;
    document.getElementById('responded-rfqs').textContent = responded;
}

function viewRfqDetails(rfqId) {
    const rfq = vendorRfqs.find(r => r.id === rfqId);
    if (!rfq) return;
    
    selectedRfqId = rfqId;
    
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
    document.getElementById('rfq-details').innerHTML = detailsHtml;
    
    // Show modal
    const modal = new bootstrap.Modal(rfqModal);
    modal.show();
}

async function deleteSelectedRfq() {
    if (!selectedRfqId || !confirm('Are you sure you want to delete this RFQ?')) return;
    
    try {
        // Delete from Firestore
        await deleteDoc(doc(db, 'rfqs', selectedRfqId));
        
        // Remove from local array
        vendorRfqs = vendorRfqs.filter(r => r.id !== selectedRfqId);
        
        // Update UI
        renderRfqsTable();
        updateStats();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(rfqModal);
        modal.hide();
        
        alert('RFQ deleted successfully');
        
    } catch (error) {
        console.error('Error deleting RFQ:', error);
        alert('Error deleting RFQ');
    }
}
// assets/js/rfqs.js

// Firebase configuration: تأكد من أن هذا الملف متاح
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
  deleteDoc, // (جديد) لاستخدامه في حذف RFQ
  query, // (جديد) لإنشاء استعلامات
  orderBy // (جديد) للفرز
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialise Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rfqsCol = collection(db, 'rfqs');
const productsCol = collection(db, 'products');

// Keep track of logged-in user and role
let currentUser = null;
let userRole = 'guest'; // 'admin', 'vendor', or 'guest'
let allProducts = []; // To map RFQ item IDs to product details

// DOM elements
const authMessage = document.getElementById('rfq-auth-message');
const rfqsSection = document.getElementById('rfqs-section');
const logoutBtn = document.getElementById('rfqs-logout-btn');
const currentUserEmailEl = document.getElementById('rfqs-current-user-email');
const rfqsList = document.getElementById('rfqs-list');
const rfqsStatus = document.getElementById('rfqs-status');

// Helper to format timestamp
function formatTimestamp(timestamp) {
    // التأكد من أن حقل 'createdAt' هو كائن Timestamp قبل تحويله
    if (!timestamp || typeof timestamp.toDate !== 'function') return 'N/A';
    return timestamp.toDate().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Function to fetch all products for reference
async function fetchProducts() {
    const snap = await getDocs(productsCol);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// (جديد) دالة لحذف RFQ
async function deleteRfq(id) {
    if (userRole !== 'admin') {
        alert('Only administrators are allowed to delete RFQs.');
        return;
    }
    const ok = confirm(`Are you sure you want to delete RFQ ID: ${id}? This action cannot be undone.`);
    if (!ok) return;

    rfqsStatus.textContent = 'Deleting RFQ...';
    try {
        await deleteDoc(doc(db, 'rfqs', id));
        rfqsStatus.textContent = `RFQ ${id} deleted successfully. Reloading list...`;
        await loadRfqs(); // إعادة تحميل القائمة
    } catch (err) {
        console.error('Error deleting RFQ:', err);
        rfqsStatus.textContent = `Error deleting RFQ ${id}.`;
        alert('Failed to delete RFQ. See console for details.');
    }
}


// Function to load and display RFQs
async function loadRfqs() {
    // تحقق أمان إضافي (يجب أن يتم التعامل معه بواسطة onAuthStateChanged)
    if (userRole === 'guest') {
        rfqsStatus.textContent = '';
        rfqsList.innerHTML = '<div class="alert alert-danger">Access Denied. Please log in to view RFQs.</div>';
        return;
    }

    rfqsStatus.textContent = 'Loading RFQs...';
    rfqsList.innerHTML = '';
    
    try {
        // Fetch all RFQs, ordered by creation date (newest first)
        const q = query(rfqsCol, orderBy('createdAt', 'desc')); // (محدث) استخدم query و orderBy
        const rfqsSnapshot = await getDocs(q);
        
        allProducts = await fetchProducts(); // جلب جميع المنتجات لأغراض الفلترة والعرض
        
        let rfqs = rfqsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Filter logic: Admins see all. Vendors see RFQs for products they own.
        if (userRole === 'vendor') {
            const vendorProducts = allProducts.filter(p => p.vendorId === currentUser.uid).map(p => p.id);
            
            rfqs = rfqs.filter(rfq => {
                // Check if any item in the RFQ belongs to this vendor
                return (rfq.items || []).some(item => vendorProducts.includes(item.id));
            });
        }
        // لا حاجة لـ else if (userRole === 'guest') لأننا تحققنا في البداية

        if (!rfqs.length) {
            const msg = userRole === 'vendor' 
                ? 'No RFQs found related to your products.'
                : 'No RFQs have been received yet.';
            rfqsStatus.textContent = msg;
            rfqsList.innerHTML = `<div class="alert alert-info">${msg}</div>`;
            return;
        }

        // Render RFQs
        rfqs.forEach((rfq, index) => {
            const headerId = `heading-${rfq.id}`;
            const collapseId = `collapse-${rfq.id}`;
            const isLatest = index === 0;

            // Prepare item list HTML
            const itemsHtml = (rfq.items || []).map(item => {
                // نعتمد على البيانات المخزنة في RFQ Item (item.name, item.partNumber)
                const product = allProducts.find(p => p.id === item.id) || { name: item.name, partNumber: item.partNumber };
                return `
                    <tr>
                        <td>${item.qty}</td>
                        <td>${product.partNumber || item.partNumber || 'N/A'}</td>
                        <td>${product.name || item.name || 'Unknown Item'}</td>
                    </tr>
                `;
            }).join('');
            
            // (جديد) زر الحذف يظهر فقط للمسؤول
            const deleteButtonHtml = userRole === 'admin' 
                ? `<button class="btn btn-sm btn-danger mt-3 delete-rfq-btn" data-rfq-id="${rfq.id}">Delete This RFQ</button>`
                : '';


            const rfqCard = document.createElement('div');
            rfqCard.className = 'accordion-item';
            rfqCard.innerHTML = `
                <h2 class="accordion-header" id="${headerId}">
                    <button class="accordion-button ${isLatest ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${isLatest ? 'true' : 'false'}" aria-controls="${collapseId}">
                        <span class="fw-semibold me-3">${rfq.company || 'N/A'}</span>
                        <span class="badge bg-secondary me-2">${(rfq.items || []).length} item(s)</span>
                        <span class="small text-muted ms-auto">${formatTimestamp(rfq.createdAt)}</span>
                    </button>
                </h2>
                <div id="${collapseId}" class="accordion-collapse collapse ${isLatest ? 'show' : ''}" aria-labelledby="${headerId}" data-bs-parent="#rfqs-list">
                    <div class="accordion-body small">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <p class="mb-1"><span class="fw-semibold">Contact:</span> ${rfq.contact || 'N/A'}</p>
                                <p class="mb-1"><span class="fw-semibold">Email:</span> <a href="mailto:${rfq.email}">${rfq.email || 'N/A'}</a></p>
                                <p class="mb-1"><span class="fw-semibold">Phone:</span> ${rfq.phone || 'N/A'}</p>
                            </div>
                            <div class="col-md-6">
                                <p class="mb-1"><span class="fw-semibold">Project:</span> ${rfq.project || 'N/A'}</p>
                                <p class="mb-1"><span class="fw-semibold">Delivery:</span> ${rfq.delivery || 'N/A'}</p>
                                <p class="mb-1"><span class="fw-semibold">ID:</span> <span class="text-muted">${rfq.id}</span></p>
                            </div>
                        </div>

                        <h6 class="fw-semibold mt-3">Requested Items</h6>
                        <div class="table-responsive mb-3">
                            <table class="table table-sm table-bordered align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th style="width:15%;">Qty</th>
                                        <th style="width:25%;">Part No</th>
                                        <th style="width:60%;">Item Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>
                        </div>
                        
                        <h6 class="fw-semibold mt-3">Additional Notes</h6>
                        <p class="border p-2 rounded bg-light">${rfq.notes || 'No notes provided.'}</p>
                        
                        ${deleteButtonHtml} 
                    </div>
                </div>
            `;
            rfqsList.appendChild(rfqCard);
        });
        
        // (جديد) إضافة مستمع الحدث لأزرار الحذف
        document.querySelectorAll('.delete-rfq-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-rfq-id');
                deleteRfq(id);
            });
        });

        rfqsStatus.textContent = `${rfqs.length} RFQ(s) loaded. (Role: ${userRole.toUpperCase()})`;

    } catch (err) {
        console.error("Error loading RFQs:", err);
        rfqsStatus.textContent = 'Error loading RFQs.';
    }
}

// Handle logout
logoutBtn && logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // 1. User signed in - determine role by checking 'users' collection
        currentUserEmailEl && (currentUserEmailEl.textContent = user.email || '');
        currentUserEmailEl && currentUserEmailEl.classList.remove('d-none');
        logoutBtn && logoutBtn.classList.remove('d-none');
        
        userRole = 'vendor'; // Default role is vendor
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data && data.role === 'admin') {
                    userRole = 'admin';
                }
            }
        } catch (err) {
            console.error("Error fetching user role:", err);
            // في حالة الخطأ، نستمر كبائع ('vendor') لتقليل التعرض للبيانات، وهذا يمنع ظهور "Access Denied" خطأ
        }

        // 2. Show content and load RFQs
        authMessage && authMessage.classList.add('d-none'); // إخفاء "Access Denied"
        rfqsSection && rfqsSection.classList.remove('d-none'); // إظهار قسم RFQs
        
        // Update title to reflect the role
        const titleEl = document.querySelector('#rfqs-section h1');
        if (titleEl) titleEl.textContent = `Received RFQs (${userRole.toUpperCase()} View)`;

        loadRfqs();

    } else {
        // User signed out
        userRole = 'guest';
        currentUserEmailEl && currentUserEmailEl.classList.add('d-none');
        logoutBtn && logoutBtn.classList.add('d-none');
        
        // Show auth message and hide RFQs section
        authMessage && authMessage.classList.remove('d-none'); // إظهار "Access Denied"
        rfqsSection && rfqsSection.classList.add('d-none'); // إخفاء قسم RFQs
        rfqsList && (rfqsList.innerHTML = '');
        rfqsStatus && (rfqsStatus.textContent = '');
    }
});

function initCommon() {
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
  initCommon();
});
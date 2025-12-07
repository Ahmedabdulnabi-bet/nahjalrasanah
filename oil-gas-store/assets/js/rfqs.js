// assets/js/rfqs.js

import { firebaseConfig } from './firebase-config.js';

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';

import { // استيراد وظائف المصادقة
  getAuth,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

import { // استيراد وظائف Firestore الضرورية
  getFirestore,
  collection,
  getDocs,
  deleteDoc, // جديد: لحذف المستندات
  doc, // جديد: لتحديد مرجع المستند
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const rfqsCol = collection(db, 'rfqs');

// DOM elements
const rfqAuthMessage = document.getElementById('rfq-auth-message');
const rfqsSection = document.getElementById('rfqs-section');
const rfqsList = document.getElementById('rfqs-list');
const rfqsStatus = document.getElementById('rfqs-status');

// حالة المستخدم
let currentUser = null;

// ---------- Authentication UI ----------
function initAuthUI() {
  const authButton = document.getElementById('auth-button');
  const authButtonText = document.getElementById('auth-button-text');
  if (!authButton || !authButtonText) return;

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      // المستخدم مسجل الدخول
      authButton.href = '#';
      authButtonText.textContent = 'Admin Logout';
      authButton.classList.remove('btn-outline-light');
      authButton.classList.add('btn-outline-danger');
      authButton.onclick = async (e) => {
        e.preventDefault();
        try {
          await signOut(auth);
        } catch (error) {
          console.error('Logout error:', error);
          alert('Failed to log out.');
        }
      };
      
      // إظهار قسم RFQs وتحميل الطلبات
      rfqAuthMessage && rfqAuthMessage.classList.add('d-none');
      rfqsSection && rfqsSection.classList.remove('d-none');
      loadRfqs().catch(console.error);
    } else {
      // المستخدم غير مسجل الدخول
      authButton.href = 'admin.html';
      authButtonText.textContent = 'Admin Login';
      authButton.classList.remove('btn-outline-danger');
      authButton.classList.add('btn-outline-light');
      authButton.onclick = null;
      
      // إخفاء قسم RFQs وعرض رسالة تسجيل الدخول
      rfqsSection && rfqsSection.classList.add('d-none');
      rfqAuthMessage && rfqAuthMessage.classList.remove('d-none');
    }
  });
}

// ---------- RFQ deletion logic ----------

/**
 * دالة لحذف مستند طلب عرض السعر (RFQ) من Firestore.
 * @param {string} id - معرّف الطلب (Doc ID).
 */
async function deleteRfq(id) {
  if (!currentUser) {
    alert('You must be logged in to perform this action.');
    return;
  }
  const ok = confirm(`Are you sure you want to delete RFQ ID: ${id}? This action cannot be undone.`);
  if (!ok) return;

  rfqsStatus.textContent = 'Deleting RFQ...';
  try {
    // تحديد مرجع المستند المراد حذفه
    await deleteDoc(doc(db, 'rfqs', id));
    rfqsStatus.textContent = `RFQ ${id} deleted successfully. Reloading list...`;
    
    // إعادة تحميل قائمة الطلبات بعد الحذف
    await loadRfqs();
  } catch (err) {
    console.error('Error deleting RFQ:', err);
    rfqsStatus.textContent = `Error deleting RFQ ${id}.`;
    alert('Failed to delete RFQ. See console for details.');
  }
}

// ---------- RFQs loading and rendering ----------
async function loadRfqs() {
  if (!rfqsList) return;
  
  rfqsList.innerHTML = '';
  rfqsStatus.textContent = 'Loading RFQs...';

  try {
    // جلب الطلبات، مرتبة حسب الأحدث (createdAt descending)
    const q = query(rfqsCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    const rfqs = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt ? d.data().createdAt.toDate() : new Date(),
    }));

    rfqsStatus.textContent = `Found ${rfqs.length} RFQ(s).`;
    
    if (rfqs.length === 0) {
      rfqsList.innerHTML = '<div class="alert alert-info">No RFQs have been received yet.</div>';
      return;
    }

    renderRfqs(rfqs);
  } catch (error) {
    console.error('Error loading RFQs:', error);
    rfqsStatus.textContent = 'Error loading RFQs. Check your connection and permissions.';
  }
}

function renderRfqs(list) {
  rfqsList.innerHTML = '';
  
  list.forEach((rfq, index) => {
    const collapseId = `collapseRfq${index}`;
    const dateStr = rfq.createdAt.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const accordionItem = document.createElement('div');
    accordionItem.className = 'accordion-item';
    
    // تصميم رأس الطلب
    accordionItem.innerHTML = `
      <h2 class="accordion-header" id="headingRfq${index}">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
          <span class="fw-bold me-3">RFQ #${rfq.id.substring(0, 8)}...</span>
          <span>${rfq.company || 'N/A'}</span>
          <span class="ms-auto small text-muted">${dateStr}</span>
        </button>
      </h2>
      <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="headingRfq${index}" data-bs-parent="#rfqs-list">
        <div class="accordion-body small">
          <p class="mb-2">
            <strong>Contact:</strong> ${rfq.contact || 'N/A'} · 
            <strong>Email:</strong> <a href="mailto:${rfq.email}">${rfq.email || 'N/A'}</a> · 
            <strong>Phone:</strong> ${rfq.phone || 'N/A'}
          </p>
          <p class="mb-2">
            <strong>Project:</strong> ${rfq.project || '-'}
          </p>
          
          <h6 class="fw-semibold mb-2 mt-3">Requested Items:</h6>
          <div class="table-responsive mb-3">
            <table class="table table-sm table-bordered">
              <thead>
                <tr>
                  <th style="width: 45%;">Product Name</th>
                  <th style="width: 25%;">Part No.</th>
                  <th style="width: 15%;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${(rfq.items || []).map(item => `
                  <tr>
                    <td>${item.name || 'N/A'}</td>
                    <td>${item.partNumber || 'N/A'}</td>
                    <td>${item.qty || 1}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <h6 class="fw-semibold mb-2">Notes:</h6>
          <p class="border p-2 bg-light">${rfq.notes || 'No notes provided.'}</p>

          <button class="btn btn-sm btn-danger mt-3" data-delete-rfq-id="${rfq.id}">
            Delete This RFQ
          </button>
          
        </div>
      </div>
    `;
    
    rfqsList.appendChild(accordionItem);
  });
  
  // إضافة مستمع الحدث للنقر على زر الحذف
  document.querySelectorAll('[data-delete-rfq-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-delete-rfq-id');
      deleteRfq(id);
    });
  });
}

// ---------- init dispatcher ----------
function initCommon() {
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  initAuthUI();
}

document.addEventListener('DOMContentLoaded', initCommon);
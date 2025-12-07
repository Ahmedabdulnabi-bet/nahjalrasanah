// assets/js/rfqs.js

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
  deleteDoc, 
  doc, 
  query,
  orderBy,
  where, // جديد: للاستعلام الشرطي
  getDoc // جديد: لجلب ملف تعريف المستخدم
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const rfqsCol = collection(db, 'rfqs');
const productsCol = collection(db, 'products'); // مرجع لمجموعة المنتجات

// DOM elements
const rfqAuthMessage = document.getElementById('rfq-auth-message');
const rfqsSection = document.getElementById('rfqs-section');
const rfqsList = document.getElementById('rfqs-list');
const rfqsStatus = document.getElementById('rfqs-status');

// حالة المستخدم
let currentUser = null;
let userRole = 'guest'; // 'guest', 'vendor', or 'admin'
let vendorProductIds = []; // مصفوفة بمعرفات المنتجات التي يملكها البائع

/**
 * دالة لجلب دور المستخدم ومعرفات منتجاته.
 * @param {object} user - كائن مستخدم مصادقة Firebase.
 */
async function fetchUserRoleAndProducts(user) {
  userRole = 'guest';
  vendorProductIds = [];

  try {
    // *** يجب تكييف هذا القسم (1) حسب هيكل مجموعة 'users' لديك ***
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      userRole = userData.role || 'vendor'; // الافتراضي بائع إذا لم يتم تحديد الدور
    } else {
      // إذا لم يتم العثور على ملف تعريف، الافتراضي هو بائع أو يمكن حظر الوصول
      userRole = 'vendor'; 
    }
    // *** نهاية قسم التكييف (1) ***

    if (userRole === 'admin') {
      return; // المسؤول لا يحتاج لتصفية المنتجات
    }
    
    // إذا كان 'vendor'، قم بجلب المنتجات التي يملكها
    // *** يجب تكييف هذا القسم (2) حسب الحقل الذي يربط المنتج بالبائع في مجموعة 'products' ***
    const q = query(productsCol, where('vendorUid', '==', user.uid));
    const snap = await getDocs(q);
    vendorProductIds = snap.docs.map(d => d.id);
    // *** نهاية قسم التكييف (2) ***
    
  } catch (error) {
    console.error("Error fetching user role or products:", error);
    // في حالة الخطأ، من الأفضل تعيين دور مقيد أو الخروج
    userRole = 'guest'; 
    await signOut(auth);
  }
}


// ---------- Authentication UI (تحديث) ----------
function initAuthUI() {
  const authButton = document.getElementById('auth-button');
  const authButtonText = document.getElementById('auth-button-text');
  if (!authButton || !authButtonText) return;

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
      // 1. جلب الدور والمنتجات
      await fetchUserRoleAndProducts(user); 
      
      // 2. تحديث UI زر الدخول/الخروج
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
      
      // 3. إظهار قسم RFQs وتحميل الطلبات
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
      userRole = 'guest'; // إعادة تعيين الدور عند تسجيل الخروج
    }
  });
}

// ---------- RFQ deletion logic ----------
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
    
    await loadRfqs();
  } catch (err) {
    console.error('Error deleting RFQ:', err);
    rfqsStatus.textContent = `Error deleting RFQ ${id}.`;
    alert('Failed to delete RFQ. See console for details.');
  }
}

// ---------- RFQs loading and rendering (تحديث التصفية) ----------
async function loadRfqs() {
  if (!rfqsList) return;
  
  if (userRole === 'guest') {
    rfqsStatus.textContent = 'Access Denied.';
    rfqsList.innerHTML = '<div class="alert alert-danger">Access Denied. Please log in to view RFQs.</div>';
    return;
  }
  
  rfqsList.innerHTML = '';
  rfqsStatus.textContent = 'Loading RFQs...';

  try {
    // جلب جميع الطلبات
    const q = query(rfqsCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    let rfqs = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt ? d.data().createdAt.toDate() : new Date(),
    }));

    // تطبيق منطق التصفية حسب الدور
    if (userRole === 'vendor') {
      // تصفية الطلبات: يجب أن يحتوي الطلب على منتج واحد على الأقل يملكه البائع
      if (vendorProductIds.length === 0) {
          rfqs = []; // لا يملك منتجات، لا يرى أي طلبات
      } else {
          rfqs = rfqs.filter(rfq => {
              // تحقق مما إذا كان أي عنصر في الطلب يتطابق مع قائمة منتجات البائع
              return (rfq.items || []).some(item => vendorProductIds.includes(item.id));
          });
      }
    }
    // ملاحظة: إذا كان userRole === 'admin'، لن يتم تطبيق التصفية، وستظهر جميع الطلبات.

    rfqsStatus.textContent = `Found ${rfqs.length} RFQ(s) for your account.`;
    
    if (rfqs.length === 0) {
      const emptyMessage = userRole === 'admin' 
        ? 'No RFQs have been received yet.' 
        : 'No RFQs related to your products have been received yet.';
      rfqsList.innerHTML = `<div class="alert alert-info">${emptyMessage}</div>`;
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
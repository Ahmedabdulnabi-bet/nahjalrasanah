// assets/js/rfqs.js

/*
  This script powers the RFQs dashboard for vendors and administrators.
  It authenticates the user, determines their role from the Firestore
  `users` collection, then fetches and displays RFQ submissions from
  the `rfqs` collection. Administrators see all RFQs ordered by
  creation date, while vendors only see RFQs containing their UID
  within the `vendors` array field. Each RFQ appears as an
  accordion entry with its metadata and the list of requested items.
*/

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
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM references
const authMsg = document.getElementById('rfq-auth-message');
const rfqsSection = document.getElementById('rfqs-section');
const rfqsList = document.getElementById('rfqs-list');
const rfqsStatus = document.getElementById('rfqs-status');
const currentUserEmailElem = document.getElementById('rfqs-current-user-email');
const logoutBtn = document.getElementById('rfqs-logout-btn');
const yearSpan = document.getElementById('year');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear().toString();
}

// Sign-out handler
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      // Redirect to home page after sign out to avoid stale state
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Error signing out:', err);
    }
  });
}

// Watch for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not authenticated: show message and hide RFQ list
    authMsg.classList.remove('d-none');
    rfqsSection.classList.add('d-none');
    currentUserEmailElem.classList.add('d-none');
    logoutBtn.classList.add('d-none');
    return;
  }

  // Authenticated: display user email and sign‑out button
  if (user.email) {
    currentUserEmailElem.textContent = user.email;
  } else {
    currentUserEmailElem.textContent = '';
  }
  currentUserEmailElem.classList.remove('d-none');
  logoutBtn.classList.remove('d-none');
  authMsg.classList.add('d-none');
  rfqsSection.classList.remove('d-none');

  // Determine if user is an administrator via the `users` collection
  let isAdmin = false;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      // Check a simple `role` string. Adjust as needed for your schema.
      if (data.role && data.role.toLowerCase() === 'admin') {
        isAdmin = true;
      }
    }
  } catch (err) {
    console.error('Failed to determine user role:', err);
  }

  // Load and render RFQs based on the user role
  await loadRfqs(user.uid, isAdmin);
});

/**
 * Load RFQ documents from Firestore and render them into the accordion list.
 * @param {string} uid - Current user UID
 * @param {boolean} isAdmin - Whether the user has admin privileges
 */
async function loadRfqs(uid, isAdmin) {
  rfqsList.innerHTML = '';
  rfqsStatus.textContent = 'Loading...';
  try {
    const rfqsCol = collection(db, 'rfqs');
    let q;
    if (isAdmin) {
      // Admins see all RFQs ordered by creation date
      q = query(rfqsCol, orderBy('createdAt', 'desc'));
    } else {
      // Vendors only see RFQs containing their UID in the `vendors` array
      q = query(rfqsCol, where('vendors', 'array-contains', uid), orderBy('createdAt', 'desc'));
    }
    const querySnap = await getDocs(q);
    if (querySnap.empty) {
      rfqsStatus.textContent = 'No RFQs found.';
      return;
    }
    rfqsStatus.textContent = '';
    let count = 0;
    querySnap.forEach((docSnap) => {
      count += 1;
      const data = docSnap.data();
      // Extract timestamp; Firestore timestamp objects expose a toDate() method
      let createdAt = '';
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        const dt = data.createdAt.toDate();
        createdAt = dt.toLocaleString();
      }
      // Derive a human‑friendly title: use company and contact when present
      const titleParts = [];
      if (data.company) titleParts.push(data.company);
      if (data.contact) titleParts.push(data.contact);
      const title = titleParts.length ? titleParts.join(' – ') : `RFQ #${count}`;
      const headerText = createdAt ? `${title} (${createdAt})` : title;
      // Create accordion item container
      const accItem = document.createElement('div');
      accItem.className = 'accordion-item mb-2';
      // Header
      const header = document.createElement('h2');
      header.className = 'accordion-header';
      const btn = document.createElement('button');
      btn.className = 'accordion-button collapsed';
      btn.type = 'button';
      const targetId = `rfq-${docSnap.id}`;
      btn.setAttribute('data-bs-toggle', 'collapse');
      btn.setAttribute('data-bs-target', `#${targetId}`);
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', targetId);
      btn.textContent = headerText;
      header.appendChild(btn);
      accItem.appendChild(header);
      // Collapse body
      const collapse = document.createElement('div');
      collapse.id = targetId;
      collapse.className = 'accordion-collapse collapse';
      collapse.setAttribute('data-bs-parent', '#rfqs-list');
      const body = document.createElement('div');
      body.className = 'accordion-body';
      // Compose contact/project details
      const details = [];
      if (data.company) details.push(`<strong>Company:</strong> ${escapeHtml(data.company)}`);
      if (data.contact) details.push(`<strong>Contact:</strong> ${escapeHtml(data.contact)}`);
      if (data.email) {
        const safeEmail = escapeAttr(data.email);
        details.push(`<strong>Email:</strong> <a href="mailto:${safeEmail}" class="link-primary">${escapeHtml(data.email)}</a>`);
      }
      if (data.phone) details.push(`<strong>Phone:</strong> ${escapeHtml(data.phone)}`);
      if (data.project) details.push(`<strong>Project/Field:</strong> ${escapeHtml(data.project)}`);
      if (data.delivery) details.push(`<strong>Delivery:</strong> ${escapeHtml(data.delivery)}`);
      if (data.notes) details.push(`<strong>Notes:</strong> ${escapeHtml(data.notes)}`);
      if (details.length) {
        body.innerHTML = `<p class="mb-2">${details.join('<br>')}</p>`;
      }
      // Items table
      if (Array.isArray(data.items) && data.items.length) {
        const table = document.createElement('table');
        table.className = 'table table-sm table-striped';
        table.innerHTML = `
          <thead><tr><th>#</th><th>Part Number</th><th>Name</th><th>Qty</th></tr></thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        data.items.forEach((it, index) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(it.partNumber || '')}</td>
            <td>${escapeHtml(it.name || '')}</td>
            <td>${escapeHtml(it.qty != null ? String(it.qty) : '')}</td>
          `;
          tbody.appendChild(row);
        });
        body.appendChild(table);
      }
      collapse.appendChild(body);
      accItem.appendChild(collapse);
      rfqsList.appendChild(accItem);
    });
  } catch (err) {
    console.error('Error loading RFQs:', err);
    rfqsStatus.textContent = 'Error loading RFQs.';
  }
}

/**
 * Escape characters for safe HTML output.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (ch) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[ch] || ch;
  });
}

/**
 * Escape quotes for attribute contexts.
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;');
}
// assets/js/rfqs.js
import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { getFirestore, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rfqsListEl = document.getElementById('rfqs-list');
const statusEl = document.getElementById('rfqs-status');
const authMessageEl = document.getElementById('rfq-auth-message');
const rfqsSection = document.getElementById('rfqs-section');

if (!rfqsListEl) {
  console.warn('rfqs-list element not found.');
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // show login message
    authMessageEl && (authMessageEl.classList.remove('d-none'));
    rfqsSection && (rfqsSection.classList.add('d-none'));
    return;
  }

  // hide login message and show section
  authMessageEl && (authMessageEl.classList.add('d-none'));
  rfqsSection && (rfqsSection.classList.remove('d-none'));

  try {
    statusEl && (statusEl.textContent = 'Loading RFQs...');
    const rfqsCol = collection(db, 'rfqs');
    const q = query(rfqsCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.size) {
      statusEl && (statusEl.textContent = 'No RFQs found.');
      return;
    }

    statusEl && (statusEl.textContent = `${snap.size} RFQ(s)`);

    rfqsListEl.innerHTML = '';
    snap.forEach(docSnap => {
      const id = docSnap.id;
      const data = docSnap.data();

      const created = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleString() : '-';
      const headerId = `rfq-${id}`;

      const itemHtml = `
        <div class="accordion-item">
          <h2 class="accordion-header" id="heading-${headerId}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${headerId}" aria-expanded="false" aria-controls="collapse-${headerId}">
              ${id} · ${data.company || '-'} · ${created}
            </button>
          </h2>
          <div id="collapse-${headerId}" class="accordion-collapse collapse" aria-labelledby="heading-${headerId}" data-bs-parent="#rfqs-list">
            <div class="accordion-body small">
              <div><strong>Contact:</strong> ${data.contact || data.email || '-'}</div>
              <div><strong>Phone:</strong> ${data.phone || '-'}</div>
              <div class="mt-2"><strong>Items:</strong></div>
              <ul>
                ${ (Array.isArray(data.items) ? data.items.map(it => `<li>${it.partNumber || ''} — ${it.name || ''} (x${it.qty})</li>`).join('') : '<li>-</li>') }
              </ul>
              <div class="mt-2"><strong>Notes:</strong><div>${data.notes || '-'}</div></div>
            </div>
          </div>
        </div>
      `;
      rfqsListEl.insertAdjacentHTML('beforeend', itemHtml);
    });

  } catch (err) {
    console.error('Error loading RFQs', err);
    statusEl && (statusEl.textContent = 'Error loading RFQs. See console.');
  }
});

const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v1';

async function loadProducts() {
  const res = await fetch('assets/data/products.json');
  if (!res.ok) throw new Error('Failed to load products.json');
  return res.json();
}

function getRfqCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RFQ);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRfqCart(cart) {
  try {
    window.localStorage.setItem(STORAGE_KEY_RFQ, JSON.stringify(cart));
  } catch {}
}

function addToRfq(itemId, qty = 1) {
  const cart = getRfqCart();
  const idx = cart.findIndex((c) => c.id === itemId);
  if (idx >= 0) cart[idx].qty += qty;
  else cart.push({ id: itemId, qty });
  saveRfqCart(cart);
}

function updateRfqItem(id, qty) {
  const cart = getRfqCart();
  const idx = cart.findIndex((c) => c.id === id);
  if (idx >= 0) {
    cart[idx].qty = qty;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    saveRfqCart(cart);
  }
}

function removeRfqItem(id) {
  const cart = getRfqCart().filter((c) => c.id !== id);
  saveRfqCart(cart);
}

function clearRfqCart() {
  saveRfqCart([]);
}

async function initHomePage() {
  const grid = document.getElementById('catalog-grid');
  if (!grid) return;

  const categoryFilter = document.getElementById('category-filter');
  const segmentFilter = document.getElementById('segment-filter');
  const sortFilter = document.getElementById('sort-filter');
  const emptyMsg = document.getElementById('catalog-empty');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');

  const products = await loadProducts();

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const segments = [...new Set(products.map((p) => p.segment).filter(Boolean))].sort();

  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  segments.forEach((seg) => {
    const opt = document.createElement('option');
    opt.value = seg;
    opt.textContent = seg;
    segmentFilter.appendChild(opt);
  });

  function normalize(text) {
    return (text || '').toString().toLowerCase();
  }

  function applyFilters() {
    const q = normalize(searchInput.value);
    const cat = categoryFilter.value;
    const seg = segmentFilter.value;
    const sort = sortFilter.value;

    let filtered = products.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (seg && p.segment !== seg) return false;
      if (q) {
        const hay = [
          p.name,
          p.partNumber,
          p.category,
          p.segment,
          p.shortDescription,
          ...(p.tags || [])
        ].map(normalize).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'name-desc') return a.name < b.name ? 1 : -1;
      return a.name > b.name ? 1 : -1;
    });

    renderCatalog(filtered);
  }

  function renderCatalog(list) {
    grid.innerHTML = '';
    if (!list.length) {
      emptyMsg.classList.remove('d-none');
      return;
    }
    emptyMsg.classList.add('d-none');

    list.forEach((p) => {
      const col = document.createElement('div');
      col.className = 'col-sm-6 col-lg-4';
      col.innerHTML = `
        <div class="card h-100 shadow-sm product-card">
          <div class="card-body d-flex flex-column">
            <span class="badge text-bg-secondary mb-2">${p.category || ''}</span>
            <h3 class="h6 fw-semibold mb-1">${p.name}</h3>
            <p class="small text-muted mb-1">${p.segment || ''}</p>
            <p class="small text-muted mb-2">Part No: ${p.partNumber || ''}</p>
            <p class="small mb-3 flex-grow-1">${p.shortDescription || ''}</p>
            <div class="d-flex justify-content-between align-items-center mt-auto">
              <a href="product.html?id=${encodeURIComponent(p.id)}" class="btn btn-sm btn-outline-primary">Details</a>
              <button class="btn btn-sm btn-primary" data-add-rfq="${p.id}">Add to RFQ</button>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(col);
    });
  }

  categoryFilter.addEventListener('change', applyFilters);
  segmentFilter.addEventListener('change', applyFilters);
  sortFilter.addEventListener('change', applyFilters);
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    applyFilters();
    const catalogSection = document.getElementById('catalog');
    if (catalogSection) catalogSection.scrollIntoView({ behavior: 'smooth' });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-add-rfq]');
    if (!btn) return;
    const id = btn.getAttribute('data-add-rfq');
    addToRfq(id, 1);
    btn.textContent = 'Added';
    setTimeout(() => { btn.textContent = 'Add to RFQ'; }, 1200);
  });

  renderCatalog(products);
}

async function initProductPage() {
  const detailsContainer = document.getElementById('product-details');
  if (!detailsContainer) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const notFound = document.getElementById('product-not-found');

  if (!id) {
    notFound.classList.remove('d-none');
    return;
  }

  const products = await loadProducts();
  const product = products.find((p) => p.id === id);

  if (!product) {
    notFound.classList.remove('d-none');
    return;
  }

  detailsContainer.classList.remove('d-none');

  const nameEl = document.getElementById('product-name');
  const segEl = document.getElementById('product-segment');
  const catBadge = document.getElementById('product-category-badge');
  const partEl = document.getElementById('product-partnumber');
  const shortEl = document.getElementById('product-short');
  const longEl = document.getElementById('product-long');
  const specsBody = document.getElementById('product-specs-body');
  const breadcrumbName = document.getElementById('breadcrumb-product-name');
  const mainImg = document.getElementById('product-image-main');
  const gallery = document.getElementById('product-gallery');
  const mediaList = document.getElementById('product-media-list');
  const btnAdd = document.getElementById('btn-add-to-rfq');

  nameEl.textContent = product.name;
  breadcrumbName.textContent = product.name;
  segEl.textContent = product.segment || '';
  catBadge.textContent = product.category || '';
  partEl.textContent = product.partNumber || '';
  shortEl.textContent = product.shortDescription || '';
  longEl.textContent = product.longDescription || '';

  if (product.image) mainImg.src = product.image;

  gallery.innerHTML = '';
  const galleryImages = product.gallery && product.gallery.length ? product.gallery : [product.image];
  galleryImages.forEach((src, index) => {
    if (!src) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline-secondary btn-sm';
    btn.innerHTML = `<img src="${src}" alt="Thumb" style="width:48px;height:48px;object-fit:contain;">`;
    btn.addEventListener('click', () => { mainImg.src = src; });
    gallery.appendChild(btn);
    if (index === 0 && src) mainImg.src = src;
  });

  mediaList.innerHTML = '';
  if (product.datasheet) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>Datasheet:</strong> <a href="${product.datasheet}" target="_blank" rel="noopener">Open PDF</a>`;
    mediaList.appendChild(li);
  }
  if (product.video) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>Video:</strong> <a href="${product.video}" target="_blank" rel="noopener">Open video file</a>`;
    mediaList.appendChild(li);
  }
  if (!product.datasheet && !product.video) {
    const li = document.createElement('li');
    li.textContent = 'No media or documents linked yet.';
    mediaList.appendChild(li);
  }

  specsBody.innerHTML = '';
  if (product.specs) {
    Object.entries(product.specs).forEach(([key, value]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<th style="width:40%;">${key}</th><td>${value}</td>`;
      specsBody.appendChild(tr);
    });
  }

  btnAdd.addEventListener('click', () => {
    addToRfq(product.id, 1);
    btnAdd.textContent = 'Added';
    setTimeout(() => { btnAdd.textContent = 'Add to RFQ Basket'; }, 1200);
  });
}

async function initRfqPage() {
  const tableBody = document.getElementById('rfq-table-body');
  if (!tableBody) return;

  const emptyRow = document.getElementById('rfq-empty');
  const btnClear = document.getElementById('btn-clear-rfq');
  const form = document.getElementById('rfq-form');

  const products = await loadProducts();

  function renderRfq() {
    const cart = getRfqCart();
    tableBody.innerHTML = '';

    if (!cart.length) {
      emptyRow.classList.remove('d-none');
      return;
    }
    emptyRow.classList.add('d-none');

    cart.forEach((item) => {
      const p = products.find((prod) => prod.id === item.id);
      if (!p) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="fw-semibold small">${p.name}</div>
          <div class="small text-muted">${p.segment || ''}</div>
        </td>
        <td class="small">${p.partNumber || ''}</td>
        <td>
          <input type="number" class="form-control form-control-sm" min="1" value="${item.qty}" data-rfq-qty="${p.id}">
        </td>
        <td class="small">${p.category || ''}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-rfq-remove="${p.id}">&times;</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  document.addEventListener('input', (e) => {
    const input = e.target.closest('input[data-rfq-qty]');
    if (!input) return;
    const id = input.getAttribute('data-rfq-qty');
    const qty = parseInt(input.value, 10) || 0;
    updateRfqItem(id, qty);
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-rfq-remove]');
    if (!btn) return;
    const id = btn.getAttribute('data-rfq-remove');
    removeRfqItem(id);
    renderRfq();
  });

  btnClear.addEventListener('click', () => {
    clearRfqCart();
    renderRfq();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cart = getRfqCart();
    if (!cart.length) {
      alert('Your RFQ basket is empty.');
      return;
    }

    const formData = new FormData(form);
    const company = formData.get('company') || '';
    const contact = formData.get('contact') || '';
    const email = formData.get('email') || '';
    const phone = formData.get('phone') || '';
    const project = formData.get('project') || '';
    const delivery = formData.get('delivery') || '';
    const notes = formData.get('notes') || '';

    const lines = [];
    lines.push('Requested items:');
    lines.push('');
    cart.forEach((item, index) => {
      const p = products.find((prod) => prod.id === item.id);
      if (!p) return;
      lines.push(`${index + 1}) ${p.partNumber || ''} – ${p.name} – Qty ${item.qty}`);
    });
    lines.push('');
    lines.push('---');
    lines.push('Company: ' + company);
    lines.push('Contact person: ' + contact);
    lines.push('Email: ' + email);
    lines.push('Phone: ' + phone);
    lines.push('Project / Field: ' + project);
    lines.push('Delivery location / INCOTERM: ' + delivery);
    lines.push('');
    lines.push('Notes / conditions:');
    lines.push(notes || '-');
    lines.push('');
    lines.push('This RFQ was prepared using the Nahj Al-Rasaneh Oil & Gas Supplies online catalog front-end.');

    const to = 'rfq@nahjalrasanah.com';
    const subject = encodeURIComponent('RFQ – ' + company);
    const body = encodeURIComponent(lines.join('\n'));

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });

  renderRfq();
}

function initCommon() {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCommon();
  const page = document.body.getAttribute('data-page');
  if (page === 'home') initHomePage().catch(console.error);
  if (page === 'product') initProductPage().catch(console.error);
  if (page === 'rfq') initRfqPage().catch(console.error);
});

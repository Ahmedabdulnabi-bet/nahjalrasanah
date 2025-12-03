// assets/js/admin.js

// Firebase configuration
import { firebaseConfig } from './firebase-config.js';

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';

// Initialise Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const productsCol = collection(db, 'products');

// Keep track of logged-in user and role
let currentUser = null;
let isAdmin = false;

// DOM elements
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorEl = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const currentUserEmailEl = document.getElementById('current-user-email');
const productForm = document.getElementById('product-form');
const productIdInput = document.getElementById('product-id');
const productNameInput = document.getElementById('product-name');
const productPartNumberInput = document.getElementById('product-part-number');
const productCategoryInput = document.getElementById('product-category');
const productSegmentInput = document.getElementById('product-segment');
const productBrandInput = document.getElementById('product-brand');
const productOriginInput = document.getElementById('product-origin');
const productShortInput = document.getElementById('product-short');
const productLongInput = document.getElementById('product-long');
const productTagsInput = document.getElementById('product-tags');
const productSpecsInput = document.getElementById('product-specs');
const productActiveInput = document.getElementById('product-active');
const productImageInput = document.getElementById('product-image');
const productDatasheetInput = document.getElementById('product-datasheet');
const productVideoInput = document.getElementById('product-video');
const productFormStatus = document.getElementById('product-form-status');
const formTitle = document.getElementById('form-title');
const resetFormBtn = document.getElementById('reset-form-btn');
const saveProductBtn = document.getElementById('save-product-btn');
const productsTableBody = document.getElementById('products-table-body');
const productsTableStatus = document.getElementById('products-table-status');
const refreshProductsBtn = document.getElementById('refresh-products-btn');

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErrorEl.classList.add('d-none');
  loginErrorEl.textContent = '';

  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  if (!email || !password) {
    loginErrorEl.textContent = 'Email and password are required.';
    loginErrorEl.classList.remove('d-none');
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (err) {
    console.error(err);
    loginErrorEl.textContent = 'Login failed. Check credentials.';
    loginErrorEl.classList.remove('d-none');
  }
});

// Handle logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

// Listen for auth state changes and load appropriate UI
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User signed in
    loginSection.classList.add('d-none');
    adminSection.classList.remove('d-none');
    logoutBtn.classList.remove('d-none');
    currentUserEmailEl.textContent = user.email || '';
    currentUserEmailEl.classList.remove('d-none');
    currentUser = user;
    // Determine user role by reading users collection
    isAdmin = false;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data && data.role === 'admin') {
          isAdmin = true;
        }
      }
    } catch (err) {
      console.error(err);
    }
    // Load products after role determination
    loadProducts();
  } else {
    // User signed out
    loginSection.classList.remove('d-none');
    adminSection.classList.add('d-none');
    logoutBtn.classList.add('d-none');
    currentUserEmailEl.classList.add('d-none');
    currentUserEmailEl.textContent = '';
    clearProductsTable();
    currentUser = null;
    isAdmin = false;
  }
});

// Utility to set form loading state
function setFormLoading(isLoading) {
  saveProductBtn.disabled = isLoading;
  resetFormBtn.disabled = isLoading;
  if (isLoading) {
    productFormStatus.classList.remove('text-danger');
    productFormStatus.classList.add('text-muted');
    productFormStatus.textContent = 'Saving, please wait...';
  }
}

// Reset product form to initial state
function resetProductForm() {
  productForm.reset();
  productIdInput.value = '';
  productActiveInput.checked = true;
  productImageInput.value = '';
  productDatasheetInput.value = '';
  productVideoInput.value = '';
  formTitle.textContent = 'Add New Product';
  productFormStatus.textContent = '';
}

resetFormBtn.addEventListener('click', () => {
  resetProductForm();
});

// Parse newline-separated specs into an object
function parseSpecs(text) {
  const specs = {};
  (text || '').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [key, ...rest] = trimmed.split(':');
    const value = rest.join(':').trim();
    if (key && value) {
      specs[key.trim()] = value;
    }
  });
  return specs;
}

// Convert specs object back into newline-separated text
function specsToText(specs) {
  if (!specs) return '';
  return Object.entries(specs)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

// Upload a file to Cloud Storage if present and return its download URL
async function uploadFileIfExists(fileInput, pathPrefix) {
  const file = fileInput.files[0];
  if (!file) return null;
  const path = `${pathPrefix}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

// Handle product form submission (create or update)
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = productNameInput.value.trim();
  if (!name) {
    productFormStatus.classList.add('text-danger');
    productFormStatus.textContent = 'Product name is required.';
    return;
  }
  setFormLoading(true);
  try {
    const partNumber = productPartNumberInput.value.trim();
    const category = productCategoryInput.value.trim();
    const segment = productSegmentInput.value.trim();
    const brand = productBrandInput.value.trim();
    const origin = productOriginInput.value.trim();
    const shortDescription = productShortInput.value.trim();
    const longDescription = productLongInput.value.trim();
    const tagsStr = productTagsInput.value.trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    const specs = parseSpecs(productSpecsInput.value);
    const isActive = productActiveInput.checked;
    const existingId = productIdInput.value || null;
    // Upload files if provided
    const imageUrl = await uploadFileIfExists(productImageInput, 'images');
    const datasheetUrl = await uploadFileIfExists(productDatasheetInput, 'datasheets');
    const videoUrl = await uploadFileIfExists(productVideoInput, 'videos');
    // Base payload for both new and existing products
    const basePayload = {
      name,
      partNumber: partNumber || null,
      category: category || null,
      segment: segment || null,
      brand: brand || null,
      origin: origin || null,
      shortDescription: shortDescription || null,
      longDescription: longDescription || null,
      tags,
      specs,
      isActive,
      updatedAt: serverTimestamp()
    };
    if (imageUrl) {
      basePayload.image = imageUrl;
      basePayload.gallery = [imageUrl];
    }
    if (datasheetUrl) basePayload.datasheet = datasheetUrl;
    if (videoUrl) basePayload.video = videoUrl;
    if (existingId) {
      // Updating an existing product (do not overwrite vendor fields)
      const refDoc = doc(db, 'products', existingId);
      await updateDoc(refDoc, basePayload);
      productFormStatus.classList.remove('text-danger');
      productFormStatus.classList.add('text-success');
      productFormStatus.textContent = 'Product updated successfully.';
    } else {
      // Creating a new product – attach vendor info
      const payloadNew = {
        ...basePayload,
        createdAt: serverTimestamp(),
        vendorId: currentUser ? currentUser.uid : null,
        vendorEmail: currentUser ? currentUser.email : null
      };
      await addDoc(productsCol, payloadNew);
      productFormStatus.classList.remove('text-danger');
      productFormStatus.classList.add('text-success');
      productFormStatus.textContent = 'Product added successfully.';
    }
    await loadProducts();
    resetProductForm();
  } catch (err) {
    console.error(err);
    productFormStatus.classList.remove('text-success');
    productFormStatus.classList.add('text-danger');
    productFormStatus.textContent = 'Error while saving product.';
  } finally {
    setFormLoading(false);
  }
});

// Load products from Firestore, applying vendor filter if user is not admin
async function loadProducts() {
  productsTableStatus.textContent = 'Loading products...';
  clearProductsTable();
  try {
    const snapshot = await getDocs(productsCol);
    let items = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    // Apply vendor filter for non-admin users
    if (!isAdmin) {
      const uid = currentUser ? currentUser.uid : null;
      items = items.filter(item => item.vendorId === uid);
    }
    if (!items.length) {
      productsTableStatus.textContent = 'No products found yet.';
      return;
    }
    // Sort by name
    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    for (const item of items) {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = item.name || '';
      tr.appendChild(tdName);
      const tdPart = document.createElement('td');
      tdPart.textContent = item.partNumber || '';
      tr.appendChild(tdPart);
      const tdCategory = document.createElement('td');
      tdCategory.textContent = item.category || '';
      tr.appendChild(tdCategory);
      const tdActive = document.createElement('td');
      tdActive.innerHTML = item.isActive ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>';
      tr.appendChild(tdActive);
      const tdActions = document.createElement('td');
      tdActions.classList.add('text-nowrap');
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-outline-primary me-1';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => fillFormForEdit(item));
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteProduct(item.id, item.name));
      tdActions.appendChild(editBtn);
      tdActions.appendChild(deleteBtn);
      tr.appendChild(tdActions);
      productsTableBody.appendChild(tr);
    }
    productsTableStatus.textContent = `${items.length} product(s) loaded.`;
  } catch (err) {
    console.error(err);
    productsTableStatus.textContent = 'Error loading products.';
  }
}

// Clear products table
function clearProductsTable() {
  productsTableBody.innerHTML = '';
}

// Fill form with existing product data for editing
function fillFormForEdit(item) {
  productIdInput.value = item.id;
  productNameInput.value = item.name || '';
  productPartNumberInput.value = item.partNumber || '';
  productCategoryInput.value = item.category || '';
  productSegmentInput.value = item.segment || '';
  productBrandInput.value = item.brand || '';
  productOriginInput.value = item.origin || '';
  productShortInput.value = item.shortDescription || '';
  productLongInput.value = item.longDescription || '';
  productTagsInput.value = (item.tags || []).join(', ');
  productSpecsInput.value = specsToText(item.specs || {});
  productActiveInput.checked = !!item.isActive;
  productImageInput.value = '';
  productDatasheetInput.value = '';
  productVideoInput.value = '';
  formTitle.textContent = `Edit Product: ${item.name || ''}`;
  productFormStatus.textContent = '';
}

// Delete a product after confirmation
async function deleteProduct(id, name) {
  const ok = confirm(`Are you sure you want to delete: "${name}" ?`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'products', id));
    await loadProducts();
  } catch (err) {
    console.error(err);
    alert('Error deleting product.');
  }
}

// Refresh products list when refresh button clicked
refreshProductsBtn.addEventListener('click', () => {
  loadProducts();
});
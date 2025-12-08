// assets/js/admin.js - نسخة محدثة مع التمييز بين المسؤول والبائع

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
let userRole = 'vendor'; // Default: vendor

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

// Function to show/hide admin features based on role
function updateUIForRole() {
  const isAdmin = userRole === 'admin';
  
  // Update UI elements visibility
  if (formTitle) {
    if (isAdmin) {
      formTitle.textContent = 'Add/Edit Product (Admin Mode)';
    } else {
      formTitle.textContent = 'Add/Edit My Product';
    }
  }
  
  // Update table headers if admin
  updateProductsTableHeaders(isAdmin);
}

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
    // User signed in - determine role
    currentUser = user;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        userRole = data.role === 'admin' ? 'admin' : 'vendor';
      }
    } catch (err) {
      console.error('Error getting user role:', err);
      userRole = 'vendor'; // Default to vendor
    }
    
    // Check user role and redirect accordingly
    if (userRole === 'admin') {
      // Admin user - show admin panel
      loginSection.classList.add('d-none');
      adminSection.classList.remove('d-none');
      logoutBtn.classList.remove('d-none');
      currentUserEmailEl.textContent = `${user.email} (Admin)`;
      currentUserEmailEl.classList.remove('d-none');
      
      // Update UI for admin role
      updateUIForRole();
      
      // Load all products for admin
      await loadProducts();
      
    } else {
      // Vendor user - redirect to vendor dashboard
      window.location.href = 'vendor-dashboard.html';
    }
    
  } else {
    // User signed out
    loginSection.classList.remove('d-none');
    adminSection.classList.add('d-none');
    logoutBtn.classList.add('d-none');
    currentUserEmailEl.classList.add('d-none');
    currentUserEmailEl.textContent = '';
    clearProductsTable();
    currentUser = null;
    userRole = 'vendor';
  }
});

// Update products table headers based on role
function updateProductsTableHeaders(isAdmin) {
  const tableHead = document.querySelector('#products-table-body').closest('table')?.querySelector('thead');
  if (tableHead) {
    const headerRow = tableHead.querySelector('tr');
    if (headerRow) {
      // Update or add vendor column for admin
      const headers = headerRow.querySelectorAll('th');
      if (isAdmin && headers.length === 5) {
        // Add vendor column
        const vendorHeader = document.createElement('th');
        vendorHeader.textContent = 'Vendor';
        headerRow.insertBefore(vendorHeader, headers[4]);
      } else if (!isAdmin && headers.length === 6) {
        // Remove vendor column
        const vendorHeader = headers[4]; // 5th column (0-indexed)
        if (vendorHeader.textContent === 'Vendor') {
          vendorHeader.remove();
        }
      }
    }
  }
}

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
  updateUIForRole();
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
      // Updating an existing product
      const refDoc = doc(db, 'products', existingId);
      const productDoc = await getDoc(refDoc);
      
      if (productDoc.exists()) {
        const productData = productDoc.data();
        
        // Check permissions - admin can edit any product, vendor can only edit their own
        if (userRole !== 'admin' && productData.vendorId !== currentUser.uid) {
          productFormStatus.classList.add('text-danger');
          productFormStatus.textContent = 'You can only edit your own products.';
          setFormLoading(false);
          return;
        }
        
        // Preserve vendor information for non-admin edits
        if (userRole !== 'admin') {
          basePayload.vendorId = productData.vendorId;
          basePayload.vendorEmail = productData.vendorEmail;
        }
      }
      
      await updateDoc(refDoc, basePayload);
      productFormStatus.classList.remove('text-danger');
      productFormStatus.classList.add('text-success');
      productFormStatus.textContent = 'Product updated successfully.';
      
    } else {
      // Creating a new product
      const payloadNew = {
        ...basePayload,
        createdAt: serverTimestamp()
      };
      
      // Add vendor info for non-admin users
      if (userRole !== 'admin') {
        payloadNew.vendorId = currentUser.uid;
        payloadNew.vendorEmail = currentUser.email;
      }
      
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
    productFormStatus.textContent = 'Error while saving product: ' + err.message;
  } finally {
    setFormLoading(false);
  }
});

// Load products from Firestore, applying vendor filter if user is not admin
async function loadProducts() {
  productsTableStatus.textContent = 'Loading products...';
  clearProductsTable();
  
  try {
    let querySnapshot;
    
    if (userRole === 'admin') {
      // Admin can see all products
      querySnapshot = await getDocs(productsCol);
    } else {
      // Vendor can only see their own products
      const q = collection(db, 'products');
      const snapshot = await getDocs(q);
      querySnapshot = snapshot;
    }
    
    let items = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      
      // Filter for vendors - only show their own products
      if (userRole !== 'admin') {
        if (data.vendorId !== currentUser?.uid) {
          return; // Skip products not belonging to this vendor
        }
      }
      
      items.push({
        id: doc.id,
        ...data
      });
    });
    
    if (!items.length) {
      productsTableStatus.textContent = 'No products found yet.';
      return;
    }
    
    // Sort by name
    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    // Clear and update table headers
    clearProductsTable();
    updateProductsTableHeaders(userRole === 'admin');
    
    for (const item of items) {
      const tr = document.createElement('tr');
      
      // Product Name
      const tdName = document.createElement('td');
      tdName.textContent = item.name || '';
      tr.appendChild(tdName);
      
      // Part Number
      const tdPart = document.createElement('td');
      tdPart.textContent = item.partNumber || '';
      tr.appendChild(tdPart);
      
      // Category
      const tdCategory = document.createElement('td');
      tdCategory.textContent = item.category || '';
      tr.appendChild(tdCategory);
      
      // Vendor (only for admin)
      if (userRole === 'admin') {
        const tdVendor = document.createElement('td');
        tdVendor.textContent = item.vendorEmail || 'N/A';
        tr.appendChild(tdVendor);
      }
      
      // Active Status
      const tdActive = document.createElement('td');
      tdActive.innerHTML = item.isActive ? 
        '<span class="badge bg-success">Yes</span>' : 
        '<span class="badge bg-secondary">No</span>';
      tr.appendChild(tdActive);
      
      // Actions
      const tdActions = document.createElement('td');
      tdActions.classList.add('text-nowrap');
      
      // Edit button - conditionally enabled
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-outline-primary me-1';
      editBtn.textContent = 'Edit';
      
      // Disable edit for vendors trying to edit other vendors' products
      const canEdit = userRole === 'admin' || item.vendorId === currentUser?.uid;
      if (!canEdit) {
        editBtn.disabled = true;
        editBtn.title = 'You can only edit your own products';
      }
      
      editBtn.addEventListener('click', () => {
        if (canEdit) {
          fillFormForEdit(item);
        }
      });
      
      // Delete button - conditionally enabled
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.textContent = 'Delete';
      
      // Disable delete for vendors trying to delete other vendors' products
      const canDelete = userRole === 'admin' || item.vendorId === currentUser?.uid;
      if (!canDelete) {
        deleteBtn.disabled = true;
        deleteBtn.title = 'You can only delete your own products';
      }
      
      deleteBtn.addEventListener('click', () => {
        if (canDelete) {
          deleteProduct(item.id, item.name);
        }
      });
      
      tdActions.appendChild(editBtn);
      tdActions.appendChild(deleteBtn);
      tr.appendChild(tdActions);
      
      productsTableBody.appendChild(tr);
    }
    
    productsTableStatus.textContent = `${items.length} product(s) loaded.`;
    
  } catch (err) {
    console.error(err);
    productsTableStatus.textContent = 'Error loading products: ' + err.message;
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
  
  formTitle.textContent = userRole === 'admin' 
    ? `Edit Product: ${item.name || ''} (Admin)` 
    : `Edit My Product: ${item.name || ''}`;
  
  productFormStatus.textContent = '';
  
  // Scroll to form
  productForm.scrollIntoView({ behavior: 'smooth' });
}

// Delete a product after confirmation
async function deleteProduct(id, name) {
  // Additional permission check for vendors
  if (userRole !== 'admin') {
    try {
      const productDoc = await getDoc(doc(db, 'products', id));
      if (productDoc.exists()) {
        const productData = productDoc.data();
        if (productData.vendorId !== currentUser?.uid) {
          alert('You can only delete your own products.');
          return;
        }
      }
    } catch (err) {
      console.error('Error checking product ownership:', err);
      return;
    }
  }
  
  const ok = confirm(`Are you sure you want to delete: "${name}"?`);
  if (!ok) return;
  
  try {
    await deleteDoc(doc(db, 'products', id));
    await loadProducts();
    
    // Reset form if deleting the product being edited
    if (productIdInput.value === id) {
      resetProductForm();
    }
    
  } catch (err) {
    console.error(err);
    alert('Error deleting product: ' + err.message);
  }
}

// Refresh products list when refresh button clicked
refreshProductsBtn.addEventListener('click', () => {
  loadProducts();
});

// Initialize UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Update copyright year if exists
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
  
  // Initial UI setup
  updateUIForRole();
});

// Export for testing if needed
export { auth, db, storage, userRole };
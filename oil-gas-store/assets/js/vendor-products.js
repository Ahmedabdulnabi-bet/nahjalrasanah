// assets/js/vendor-products.js

import { firebaseConfig } from './firebase-config.js';
import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const productsTable = document.getElementById('products-table');
const noProducts = document.getElementById('no-products');
const addProductBtn = document.getElementById('add-product-btn');
const addFirstProductBtn = document.getElementById('add-first-product');
const productModal = new bootstrap.Modal(document.getElementById('productModal'));
const productForm = document.getElementById('product-form');
const saveProductBtn = document.getElementById('save-product');

let currentUser = null;
let products = [];

// Load vendor's products
async function loadProducts() {
  if (!currentUser) return;
  
  try {
    const q = query(
      collection(db, 'products'),
      where('vendorId', '==', currentUser.uid)
    );
    const snapshot = await getDocs(q);
    
    products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    renderProducts();
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

// Render products table
function renderProducts() {
  if (!productsTable) return;
  
  if (products.length === 0) {
    productsTable.innerHTML = '';
    noProducts.classList.remove('d-none');
    return;
  }
  
  noProducts.classList.add('d-none');
  
  productsTable.innerHTML = products.map(product => `
    <tr>
      <td>
        <img src="${product.image || 'assets/images/product-placeholder.png'}" 
             alt="${product.name}" 
             style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
      </td>
      <td>${product.name}</td>
      <td>${product.partNumber || 'N/A'}</td>
      <td>${product.category || 'N/A'}</td>
      <td>
        ${product.isActive !== false 
          ? '<span class="badge bg-success">Active</span>' 
          : '<span class="badge bg-secondary">Inactive</span>'}
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-product" data-id="${product.id}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger delete-product" data-id="${product.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
  
  // Add event listeners
  document.querySelectorAll('.edit-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.closest('.edit-product').dataset.id;
      editProduct(productId);
    });
  });
  
  document.querySelectorAll('.delete-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.closest('.delete-product').dataset.id;
      deleteProduct(productId);
    });
  });
}

// Edit product
function editProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  document.getElementById('product-id').value = product.id;
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('part-number').value = product.partNumber || '';
  document.getElementById('category').value = product.category || '';
  document.getElementById('price').value = product.price || '';
  document.getElementById('description').value = product.description || '';
  document.getElementById('image-url').value = product.image || '';
  document.getElementById('is-active').checked = product.isActive !== false;
  
  productModal.show();
}

// Delete product
async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  try {
    await deleteDoc(doc(db, 'products', productId));
    await loadProducts();
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('Error deleting product');
  }
}

// Save product
saveProductBtn.addEventListener('click', async () => {
  const productId = document.getElementById('product-id').value;
  const productData = {
    name: document.getElementById('product-name').value,
    partNumber: document.getElementById('part-number').value || null,
    category: document.getElementById('category').value || null,
    price: parseFloat(document.getElementById('price').value) || null,
    description: document.getElementById('description').value || null,
    image: document.getElementById('image-url').value || null,
    isActive: document.getElementById('is-active').checked,
    updatedAt: serverTimestamp(),
    vendorId: currentUser.uid,
    vendorEmail: currentUser.email
  };
  
  try {
    if (productId) {
      // Update existing product
      await updateDoc(doc(db, 'products', productId), productData);
    } else {
      // Add new product
      productData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'products'), productData);
    }
    
    productModal.hide();
    productForm.reset();
    document.getElementById('product-id').value = '';
    
    await loadProducts();
  } catch (error) {
    console.error('Error saving product:', error);
    alert('Error saving product');
  }
});

// Add product button
addProductBtn?.addEventListener('click', () => {
  productForm.reset();
  document.getElementById('product-id').value = '';
  document.getElementById('is-active').checked = true;
  productModal.show();
});

addFirstProductBtn?.addEventListener('click', () => {
  productForm.reset();
  document.getElementById('product-id').value = '';
  document.getElementById('is-active').checked = true;
  productModal.show();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      loadProducts();
    } else {
      window.location.href = 'vendor-login.html';
    }
  });
});
// assets/js/vendor-products.js

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, 
    doc, getDocs, query, where, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { 
    getStorage, ref, uploadBytes, getDownloadURL, deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// DOM Elements
const productForm = document.getElementById('product-form');
const productIdInput = document.getElementById('product-id');
const productNameInput = document.getElementById('product-name');
const productPartInput = document.getElementById('product-part');
const productCategoryInput = document.getElementById('product-category');
const productShortInput = document.getElementById('product-short');
const productLongInput = document.getElementById('product-long');
const productTagsInput = document.getElementById('product-tags');
const productImageInput = document.getElementById('product-image');
const productVideoInput = document.getElementById('product-video');
const productDatasheetInput = document.getElementById('product-datasheet');
const productActiveInput = document.getElementById('product-active');
const productsTable = document.getElementById('products-table');
const noProductsDiv = document.getElementById('no-products');
const formTitle = document.getElementById('form-title');
const saveBtn = document.getElementById('save-btn');
const resetBtn = document.getElementById('reset-btn');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const formMessage = document.getElementById('form-message');

// State
let currentUser = null;
let products = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set copyright year
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadProducts();
        } else {
            window.location.href = 'admin.html';
        }
    });
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Form submission
    productForm.addEventListener('submit', handleSubmit);
    
    // Reset form
    resetBtn.addEventListener('click', resetForm);
    
    // Refresh products
    refreshBtn.addEventListener('click', loadProducts);
    
    // Logout
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        });
    });
}

async function loadProducts() {
    if (!currentUser) return;
    
    showLoading(true);
    
    try {
        // Query products for this vendor only
        const q = query(
            collection(db, 'products'),
            where('vendorId', '==', currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderProductsTable();
        
    } catch (error) {
        console.error('Error loading products:', error);
        showMessage('Error loading products', 'danger');
    } finally {
        showLoading(false);
    }
}

function renderProductsTable() {
    if (products.length === 0) {
        productsTable.innerHTML = '';
        noProductsDiv.classList.remove('d-none');
        return;
    }
    
    noProductsDiv.classList.add('d-none');
    
    productsTable.innerHTML = products.map(product => `
        <tr>
            <td>
                ${product.image ? 
                    `<img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover;" class="rounded">` : 
                    `<div class="bg-light rounded d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                        <i class="bi bi-image text-muted"></i>
                    </div>`
                }
            </td>
            <td>
                <strong>${product.name}</strong><br>
                <small class="text-muted">${product.category || ''}</small>
            </td>
            <td>${product.partNumber || '-'}</td>
            <td>
                ${product.isActive !== false ? 
                    '<span class="badge bg-success">Active</span>' : 
                    '<span class="badge bg-secondary">Inactive</span>'
                }
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1 edit-btn" data-id="${product.id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${product.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.closest('.edit-btn').dataset.id;
            editProduct(productId);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const productId = e.target.closest('.delete-btn').dataset.id;
            deleteProduct(productId);
        });
    });
}

async function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // Fill form with product data
    productIdInput.value = product.id;
    productNameInput.value = product.name || '';
    productPartInput.value = product.partNumber || '';
    productCategoryInput.value = product.category || '';
    productShortInput.value = product.shortDescription || '';
    productLongInput.value = product.longDescription || '';
    productTagsInput.value = product.tags ? product.tags.join(', ') : '';
    productActiveInput.checked = product.isActive !== false;
    
    // Update form title
    formTitle.textContent = 'Edit Product';
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Update Product';
    
    // Scroll to form
    productForm.scrollIntoView({ behavior: 'smooth' });
    
    showMessage('Product loaded for editing', 'info');
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        // Delete from Firestore
        await deleteDoc(doc(db, 'products', productId));
        
        // Remove from local array
        products = products.filter(p => p.id !== productId);
        
        // Update UI
        renderProductsTable();
        
        // Reset form if deleting the product being edited
        if (productIdInput.value === productId) {
            resetForm();
        }
        
        showMessage('Product deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting product:', error);
        showMessage('Error deleting product', 'danger');
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showMessage('Please log in first', 'danger');
        return;
    }
    
    // Validate required fields
    if (!productNameInput.value.trim()) {
        showMessage('Product name is required', 'danger');
        return;
    }
    
    if (!productCategoryInput.value) {
        showMessage('Category is required', 'danger');
        return;
    }
    
    // For new products, image is required
    if (!productIdInput.value && !productImageInput.files[0]) {
        showMessage('Product image is required', 'danger');
        return;
    }
    
    try {
        showLoading(true);
        
        // Prepare product data
        const productData = {
            name: productNameInput.value.trim(),
            partNumber: productPartInput.value.trim() || null,
            category: productCategoryInput.value,
            shortDescription: productShortInput.value.trim() || null,
            longDescription: productLongInput.value.trim() || null,
            tags: productTagsInput.value.trim() ? 
                  productTagsInput.value.split(',').map(tag => tag.trim()) : [],
            isActive: productActiveInput.checked,
            vendorId: currentUser.uid,
            vendorEmail: currentUser.email,
            updatedAt: serverTimestamp()
        };
        
        // Handle file uploads
        const files = await uploadFiles();
        if (files.image) productData.image = files.image;
        if (files.video) productData.video = files.video;
        if (files.datasheet) productData.datasheet = files.datasheet;
        
        // Save to Firestore
        if (productIdInput.value) {
            // Update existing product
            await updateDoc(doc(db, 'products', productIdInput.value), productData);
            showMessage('Product updated successfully', 'success');
        } else {
            // Create new product
            productData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'products'), productData);
            showMessage('Product added successfully', 'success');
            resetForm();
        }
        
        // Reload products
        await loadProducts();
        
    } catch (error) {
        console.error('Error saving product:', error);
        showMessage('Error saving product: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
}

async function uploadFiles() {
    const files = {};
    
    // Upload image if provided
    if (productImageInput.files[0]) {
        const imageFile = productImageInput.files[0];
        const imagePath = `products/${currentUser.uid}/${Date.now()}_${imageFile.name}`;
        const imageRef = ref(storage, imagePath);
        
        await uploadBytes(imageRef, imageFile);
        files.image = await getDownloadURL(imageRef);
    }
    
    // Upload video if provided
    if (productVideoInput.files[0]) {
        const videoFile = productVideoInput.files[0];
        const videoPath = `products/${currentUser.uid}/videos/${Date.now()}_${videoFile.name}`;
        const videoRef = ref(storage, videoPath);
        
        await uploadBytes(videoRef, videoFile);
        files.video = await getDownloadURL(videoRef);
    }
    
    // Upload datasheet if provided
    if (productDatasheetInput.files[0]) {
        const datasheetFile = productDatasheetInput.files[0];
        const datasheetPath = `products/${currentUser.uid}/datasheets/${Date.now()}_${datasheetFile.name}`;
        const datasheetRef = ref(storage, datasheetPath);
        
        await uploadBytes(datasheetRef, datasheetFile);
        files.datasheet = await getDownloadURL(datasheetRef);
    }
    
    return files;
}

function resetForm() {
    productForm.reset();
    productIdInput.value = '';
    formTitle.textContent = 'Add New Product';
    saveBtn.innerHTML = '<i class="bi bi-save"></i> Save Product';
    productActiveInput.checked = true;
    formMessage.innerHTML = '';
}

function showMessage(text, type = 'info') {
    formMessage.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show">
            ${text}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

function showLoading(loading) {
    if (loading) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
    } else {
        saveBtn.disabled = false;
        saveBtn.innerHTML = productIdInput.value ? 
            '<i class="bi bi-save"></i> Update Product' : 
            '<i class="bi bi-save"></i> Save Product';
    }
}
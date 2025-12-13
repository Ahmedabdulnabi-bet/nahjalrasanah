// assets/js/admin.js - نسخة مبسطة للمسؤولين

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAtcnouNdsILUvA9EMvrHMhoaWXkMqTMx0",
    authDomain: "nahj-oilgas-store.firebaseapp.com",
    projectId: "nahj-oilgas-store",
    storageBucket: "nahj-oilgas-store.appspot.com",
    messagingSenderId: "967640800678",
    appId: "1:967640800678:web:4b018066c733c4e4500367",
    measurementId: "G-9XZPG5TJ6W"
};

// Initialize Firebase
let auth, db, storage;
let currentUser = null;
let userRole = 'vendor';

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    
    console.log('Admin Firebase initialized');
} catch (error) {
    console.error('Firebase init error:', error);
}

// DOM Elements
const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const loginForm = document.getElementById('login-form');
const loginErrorEl = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const currentUserEmailEl = document.getElementById('current-user-email');
const productForm = document.getElementById('product-form');
const productIdInput = document.getElementById('product-id');
const productNameInput = document.getElementById('product-name');
const saveProductBtn = document.getElementById('save-product-btn');
const resetFormBtn = document.getElementById('reset-form-btn');
const refreshProductsBtn = document.getElementById('refresh-products-btn');
const productsTableBody = document.getElementById('products-table-body');
const productsTableStatus = document.getElementById('products-table-status');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin page loaded');
    
    // Set copyright year
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // Check authentication
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            console.log('Admin user:', user.email);
            
            try {
                // Check user role
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    userRole = data.role === 'admin' ? 'admin' : 'vendor';
                }
                
                console.log('User role:', userRole);
                
                if (userRole === 'admin') {
                    // Show admin panel
                    if (loginSection) loginSection.classList.add('d-none');
                    if (adminSection) adminSection.classList.remove('d-none');
                    if (logoutBtn) logoutBtn.classList.remove('d-none');
                    if (currentUserEmailEl) {
                        currentUserEmailEl.textContent = `${user.email} (Admin)`;
                        currentUserEmailEl.classList.remove('d-none');
                    }
                    
                    // Load products
                    await loadProducts();
                    setupEventListeners();
                    
                } else {
                    // Redirect vendor to vendor dashboard
                    window.location.href = 'vendor-dashboard.html';
                }
                
            } catch (error) {
                console.error('Error checking role:', error);
                showLoginError('Error checking user permissions');
            }
            
        } else {
            // User signed out
            if (loginSection) loginSection.classList.remove('d-none');
            if (adminSection) adminSection.classList.add('d-none');
            if (logoutBtn) logoutBtn.classList.add('d-none');
            if (currentUserEmailEl) currentUserEmailEl.classList.add('d-none');
            currentUser = null;
            userRole = 'vendor';
        }
    });
});

function setupEventListeners() {
    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.signOut();
        });
    }
    
    // Product form
    if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
    }
    
    // Reset form
    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', resetProductForm);
    }
    
    // Refresh products
    if (refreshProductsBtn) {
        refreshProductsBtn.addEventListener('click', loadProducts);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showLoginError('Email and password are required');
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        if (loginForm) loginForm.reset();
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Login failed. Check credentials.');
    }
}

function showLoginError(message) {
    if (loginErrorEl) {
        loginErrorEl.textContent = message;
        loginErrorEl.classList.remove('d-none');
    }
}

async function loadProducts() {
    if (!productsTableBody || !productsTableStatus) return;
    
    productsTableStatus.textContent = 'Loading products...';
    productsTableBody.innerHTML = '';
    
    try {
        const snapshot = await db.collection('products').get();
        
        if (snapshot.empty) {
            productsTableStatus.textContent = 'No products found.';
            return;
        }
        
        let items = [];
        snapshot.forEach(doc => {
            items.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by name
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        // Render table
        items.forEach(item => {
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
            
            // Vendor
            const tdVendor = document.createElement('td');
            tdVendor.textContent = item.vendorEmail || 'N/A';
            tr.appendChild(tdVendor);
            
            // Active Status
            const tdActive = document.createElement('td');
            tdActive.innerHTML = item.isActive ? 
                '<span class="badge bg-success">Yes</span>' : 
                '<span class="badge bg-secondary">No</span>';
            tr.appendChild(tdActive);
            
            // Actions
            const tdActions = document.createElement('td');
            tdActions.classList.add('text-nowrap');
            
            // Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-outline-primary me-1';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                fillFormForEdit(item);
            });
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-sm btn-outline-danger';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                deleteProduct(item.id, item.name);
            });
            
            tdActions.appendChild(editBtn);
            tdActions.appendChild(deleteBtn);
            tr.appendChild(tdActions);
            
            productsTableBody.appendChild(tr);
        });
        
        productsTableStatus.textContent = `${items.length} product(s) loaded.`;
        
    } catch (error) {
        console.error('Error loading products:', error);
        productsTableStatus.textContent = 'Error loading products: ' + error.message;
    }
}

function fillFormForEdit(item) {
    if (!productForm) return;
    
    // Fill form fields
    const fields = [
        { id: 'product-id', value: item.id },
        { id: 'product-name', value: item.name || '' },
        { id: 'product-part-number', value: item.partNumber || '' },
        { id: 'product-category', value: item.category || '' },
        { id: 'product-segment', value: item.segment || '' },
        { id: 'product-brand', value: item.brand || '' },
        { id: 'product-origin', value: item.origin || '' },
        { id: 'product-short', value: item.shortDescription || '' },
        { id: 'product-long', value: item.longDescription || '' },
        { id: 'product-tags', value: item.tags ? item.tags.join(', ') : '' },
        { id: 'product-specs', value: specsToText(item.specs || {}) }
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.value = field.value;
        }
    });
    
    const activeCheckbox = document.getElementById('product-active');
    if (activeCheckbox) {
        activeCheckbox.checked = !!item.isActive;
    }
    
    const formTitle = document.getElementById('form-title');
    if (formTitle) {
        formTitle.textContent = `Edit Product: ${item.name || ''}`;
    }
    
    // Scroll to form
    productForm.scrollIntoView({ behavior: 'smooth' });
}

function specsToText(specs) {
    if (!specs) return '';
    return Object.entries(specs)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
}

async function deleteProduct(id, name) {
    if (!confirm(`Are you sure you want to delete: "${name}"?`)) return;
    
    try {
        await db.collection('products').doc(id).delete();
        await loadProducts();
        
        // Reset form if deleting the product being edited
        if (productIdInput && productIdInput.value === id) {
            resetProductForm();
        }
        
    } catch (error) {
        console.error(error);
        alert('Error deleting product: ' + error.message);
    }
}

function resetProductForm() {
    if (productForm) {
        productForm.reset();
    }
    if (productIdInput) {
        productIdInput.value = '';
    }
    const formTitle = document.getElementById('form-title');
    if (formTitle) {
        formTitle.textContent = 'Add New Product';
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('product-name').value.trim();
    if (!name) {
        alert('Product name is required.');
        return;
    }
    
    try {
        // Get form data
        const productData = {
            name: name,
            partNumber: document.getElementById('product-part-number').value.trim() || null,
            category: document.getElementById('product-category').value.trim() || null,
            segment: document.getElementById('product-segment').value.trim() || null,
            brand: document.getElementById('product-brand').value.trim() || null,
            origin: document.getElementById('product-origin').value.trim() || null,
            shortDescription: document.getElementById('product-short').value.trim() || null,
            longDescription: document.getElementById('product-long').value.trim() || null,
            tags: document.getElementById('product-tags').value.trim() ? 
                  document.getElementById('product-tags').value.split(',').map(t => t.trim()) : [],
            specs: parseSpecs(document.getElementById('product-specs').value),
            isActive: document.getElementById('product-active').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Handle file uploads (simplified for admin)
        // Note: For production, you should implement file uploads
        
        const existingId = productIdInput ? productIdInput.value : null;
        
        if (existingId) {
            // Update existing
            await db.collection('products').doc(existingId).update(productData);
            alert('Product updated successfully.');
        } else {
            // Create new
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('products').add(productData);
            alert('Product added successfully.');
            resetProductForm();
        }
        
        await loadProducts();
        
    } catch (error) {
        console.error('Error saving product:', error);
        alert('Error saving product: ' + error.message);
    }
}

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
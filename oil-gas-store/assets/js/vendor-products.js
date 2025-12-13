// assets/js/vendor-products-fixed.js
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

// Main application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Vendor Products Page');
    
    // Set copyright year
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // Initialize Firebase if not already initialized
    let app, auth, db, storage;
    
    try {
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
            console.log('Firebase app initialized');
        } else {
            app = firebase.app();
            console.log('Using existing Firebase app');
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage();
        
        console.log('Firebase services initialized successfully');
        
        // Start the application
        startVendorApp(auth, db, storage);
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showErrorMessage('Failed to initialize Firebase services. Please refresh the page.');
    }
});

function startVendorApp(auth, db, storage) {
    console.log('Starting vendor application...');
    
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
    
    // Check authentication state
    auth.onAuthStateChanged(function(user) {
        console.log('Auth state changed:', user ? user.email : 'No user');
        
        if (user) {
            currentUser = user;
            console.log('User authenticated:', user.email, user.uid);
            
            // Load user's products
            loadProducts();
            
            // Setup event listeners
            setupEventListeners();
            
        } else {
            console.log('No user found, redirecting to login...');
            // Redirect to login page after a short delay
            setTimeout(function() {
                window.location.href = 'vendor-login.html';
            }, 1000);
        }
    });
    
    function setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Form submission
        if (productForm) {
            productForm.addEventListener('submit', handleSubmit);
        }
        
        // Reset form
        if (resetBtn) {
            resetBtn.addEventListener('click', resetForm);
        }
        
        // Refresh products
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                console.log('Refresh button clicked');
                loadProducts();
            });
        }
        
        // Logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                console.log('Logout button clicked');
                auth.signOut().then(function() {
                    console.log('User signed out');
                    window.location.href = 'index.html';
                }).catch(function(error) {
                    console.error('Sign out error:', error);
                });
            });
        }
    }
    
    async function loadProducts() {
        console.log('Loading products...');
        
        if (!currentUser) {
            console.error('Cannot load products: No current user');
            return;
        }
        
        showLoading(true);
        
        try {
            // Query products for this vendor only
            const querySnapshot = await db.collection('products')
                .where('vendorId', '==', currentUser.uid)
                .get();
            
            products = [];
            querySnapshot.forEach(function(doc) {
                products.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`Loaded ${products.length} products for vendor ${currentUser.email}`);
            
            renderProductsTable();
            
        } catch (error) {
            console.error('Error loading products:', error);
            showMessage('Error loading products: ' + error.message, 'danger');
        } finally {
            showLoading(false);
        }
    }
    
    function renderProductsTable() {
        if (!productsTable) {
            console.error('Products table element not found');
            return;
        }
        
        if (products.length === 0) {
            productsTable.innerHTML = '';
            if (noProductsDiv) {
                noProductsDiv.classList.remove('d-none');
            }
            return;
        }
        
        if (noProductsDiv) {
            noProductsDiv.classList.add('d-none');
        }
        
        // Build table rows
        let tableHTML = '';
        
        products.forEach(function(product) {
            tableHTML += `
                <tr>
                    <td>
                        ${product.image ? 
                            `<img src="${product.image}" alt="${product.name}" 
                                  style="width: 50px; height: 50px; object-fit: cover;" 
                                  class="rounded">` : 
                            `<div class="bg-light rounded d-flex align-items-center justify-content-center" 
                                  style="width: 50px; height: 50px;">
                                <i class="bi bi-image text-muted"></i>
                            </div>`
                        }
                    </td>
                    <td>
                        <strong>${product.name || 'No Name'}</strong><br>
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
                        <button class="btn btn-sm btn-outline-primary me-1 edit-btn" 
                                data-id="${product.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" 
                                data-id="${product.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        productsTable.innerHTML = tableHTML;
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                const productId = this.getAttribute('data-id');
                editProduct(productId);
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                const productId = this.getAttribute('data-id');
                deleteProduct(productId);
            });
        });
    }
    
    function editProduct(productId) {
        console.log('Editing product:', productId);
        
        const product = products.find(function(p) {
            return p.id === productId;
        });
        
        if (!product) {
            console.error('Product not found:', productId);
            return;
        }
        
        // Fill form with product data
        if (productIdInput) productIdInput.value = product.id;
        if (productNameInput) productNameInput.value = product.name || '';
        if (productPartInput) productPartInput.value = product.partNumber || '';
        if (productCategoryInput) productCategoryInput.value = product.category || '';
        if (productShortInput) productShortInput.value = product.shortDescription || '';
        if (productLongInput) productLongInput.value = product.longDescription || '';
        if (productTagsInput) productTagsInput.value = product.tags ? product.tags.join(', ') : '';
        if (productActiveInput) productActiveInput.checked = product.isActive !== false;
        
        // Update form title
        if (formTitle) {
            formTitle.textContent = 'Edit Product';
        }
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="bi bi-save"></i> Update Product';
        }
        
        // Scroll to form
        if (productForm) {
            productForm.scrollIntoView({ behavior: 'smooth' });
        }
        
        showMessage('Product loaded for editing', 'info');
    }
    
    async function deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }
        
        console.log('Deleting product:', productId);
        
        try {
            // Delete from Firestore
            await db.collection('products').doc(productId).delete();
            
            // Remove from local array
            products = products.filter(function(p) {
                return p.id !== productId;
            });
            
            // Update UI
            renderProductsTable();
            
            // Reset form if deleting the product being edited
            if (productIdInput && productIdInput.value === productId) {
                resetForm();
            }
            
            showMessage('Product deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting product:', error);
            showMessage('Error deleting product: ' + error.message, 'danger');
        }
    }
    
    async function handleSubmit(e) {
        e.preventDefault();
        console.log('Product form submitted');
        
        if (!currentUser) {
            showMessage('Please log in first', 'danger');
            return;
        }
        
        // Validate required fields
        if (!productNameInput || !productNameInput.value.trim()) {
            showMessage('Product name is required', 'danger');
            return;
        }
        
        if (!productCategoryInput || !productCategoryInput.value) {
            showMessage('Category is required', 'danger');
            return;
        }
        
        // For new products, image is required
        const isNewProduct = !productIdInput || !productIdInput.value;
        if (isNewProduct && (!productImageInput || !productImageInput.files[0])) {
            showMessage('Product image is required for new products', 'danger');
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
                      productTagsInput.value.split(',').map(function(tag) {
                          return tag.trim();
                      }) : [],
                isActive: productActiveInput.checked,
                vendorId: currentUser.uid,
                vendorEmail: currentUser.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            console.log('Product data prepared:', productData);
            
            // Handle file uploads
            if (productImageInput && productImageInput.files[0]) {
                try {
                    const imageUrl = await uploadFile(productImageInput, 'images');
                    if (imageUrl) {
                        productData.image = imageUrl;
                        console.log('Image uploaded:', imageUrl);
                    }
                } catch (uploadError) {
                    console.error('Image upload failed:', uploadError);
                    showMessage('Image upload failed. Please try again.', 'warning');
                }
            }
            
            if (productVideoInput && productVideoInput.files[0]) {
                try {
                    const videoUrl = await uploadFile(productVideoInput, 'videos');
                    if (videoUrl) {
                        productData.video = videoUrl;
                        console.log('Video uploaded:', videoUrl);
                    }
                } catch (uploadError) {
                    console.error('Video upload failed:', uploadError);
                    // Continue without video - it's optional
                }
            }
            
            if (productDatasheetInput && productDatasheetInput.files[0]) {
                try {
                    const datasheetUrl = await uploadFile(productDatasheetInput, 'datasheets');
                    if (datasheetUrl) {
                        productData.datasheet = datasheetUrl;
                        console.log('Datasheet uploaded:', datasheetUrl);
                    }
                } catch (uploadError) {
                    console.error('Datasheet upload failed:', uploadError);
                    // Continue without datasheet - it's optional
                }
            }
            
            // Save to Firestore
            if (productIdInput && productIdInput.value) {
                // Update existing product
                console.log('Updating existing product:', productIdInput.value);
                await db.collection('products').doc(productIdInput.value).update(productData);
                showMessage('Product updated successfully', 'success');
            } else {
                // Create new product
                productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                console.log('Creating new product');
                await db.collection('products').add(productData);
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
    
    async function uploadFile(fileInput, folder) {
        const file = fileInput.files[0];
        if (!file) {
            return null;
        }
        
        console.log('Uploading file:', file.name, 'to folder:', folder);
        
        try {
            // Create a clean filename
            const fileName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
            const timestamp = Date.now();
            const path = `products/${currentUser.uid}/${folder}/${timestamp}_${fileName}`;
            
            console.log('Storage path:', path);
            
            // Create storage reference
            const storageRef = storage.ref(path);
            
            // Upload file
            const snapshot = await storageRef.put(file);
            console.log('File uploaded successfully');
            
            // Get download URL
            const downloadURL = await snapshot.ref.getDownloadURL();
            console.log('Download URL:', downloadURL);
            
            return downloadURL;
            
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }
    
    function resetForm() {
        console.log('Resetting form');
        
        if (productForm) {
            productForm.reset();
        }
        if (productIdInput) {
            productIdInput.value = '';
        }
        if (formTitle) {
            formTitle.textContent = 'Add New Product';
        }
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="bi bi-save"></i> Save Product';
        }
        if (productActiveInput) {
            productActiveInput.checked = true;
        }
        if (formMessage) {
            formMessage.innerHTML = '';
        }
    }
    
    function showMessage(text, type) {
        console.log('Showing message:', type, text);
        
        if (!formMessage) {
            return;
        }
        
        const alertClass = type === 'danger' ? 'alert-danger' : 
                          type === 'success' ? 'alert-success' : 
                          type === 'warning' ? 'alert-warning' : 'alert-info';
        
        formMessage.innerHTML = `
            <div class="alert ${alertClass} alert-dismissible fade show">
                ${text}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Auto remove after 5 seconds
        setTimeout(function() {
            if (formMessage.firstChild) {
                const bsAlert = new bootstrap.Alert(formMessage.firstChild);
                bsAlert.close();
            }
        }, 5000);
    }
    
    function showLoading(loading) {
        console.log('Loading state:', loading);
        
        if (!saveBtn) {
            return;
        }
        
        if (loading) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        } else {
            saveBtn.disabled = false;
            const isEditing = productIdInput && productIdInput.value;
            saveBtn.innerHTML = isEditing ? 
                '<i class="bi bi-save"></i> Update Product' : 
                '<i class="bi bi-save"></i> Save Product';
        }
    }
    
    function showErrorMessage(message) {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger mt-5">
                    <h4>Application Error</h4>
                    <p>${message}</p>
                    <div class="mt-3">
                        <button onclick="location.reload()" class="btn btn-primary">Refresh Page</button>
                        <a href="index.html" class="btn btn-outline-secondary ms-2">Go to Home</a>
                    </div>
                </div>
            `;
        }
    }
    
    console.log('Vendor application setup complete');
}
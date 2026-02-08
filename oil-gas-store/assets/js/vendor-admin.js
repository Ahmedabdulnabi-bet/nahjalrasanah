// assets/js/vendor-admin.js
import { firebaseConfig, COLLECTIONS, USER_ROLES, RFQ_STATUS } from './firebase-config.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where,
  orderBy,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Global state
let currentUser = null;
let userRole = null;
let products = [];
let rfqs = [];

// ========== AUTHENTICATION ==========
async function checkUserRole(userId) {
  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    if (userDoc.exists()) {
      return userDoc.data().role;
    }
    return null;
  } catch (error) {
    console.error('Error checking user role:', error);
    return null;
  }
}

async function handleLogin(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check user role
    const role = await checkUserRole(user.uid);
    
    if (!role) {
      throw new Error('User role not found. Contact administrator.');
    }
    
    return { user, role };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// ========== PRODUCT MANAGEMENT ==========
async function loadProducts() {
  try {
    let productsQuery;
    
    if (userRole === USER_ROLES.ADMIN) {
      // Admin sees all products
      productsQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        orderBy('createdAt', 'desc')
      );
    } else if (userRole === USER_ROLES.VENDOR) {
      // Vendor sees only their products
      productsQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where('vendorId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
    } else {
      throw new Error('Unauthorized access');
    }
    
    const querySnapshot = await getDocs(productsQuery);
    products = [];
    
    querySnapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Loaded ${products.length} products for ${userRole}`);
    return products;
    
  } catch (error) {
    console.error('Error loading products:', error);
    throw error;
  }
}

async function saveProduct(productData, productId = null, files = {}) {
  try {
    // Upload files if provided
    if (files.image) {
      productData.image = await uploadFile(files.image, 'images');
    }
    if (files.video) {
      productData.video = await uploadFile(files.video, 'videos');
    }
    if (files.datasheet) {
      productData.datasheet = await uploadFile(files.datasheet, 'datasheets');
    }
    
    // Add metadata
    productData.updatedAt = serverTimestamp();
    
    if (!productId) {
      // New product
      productData.createdAt = serverTimestamp();
      productData.vendorId = currentUser.uid;
      productData.vendorEmail = currentUser.email;
      
      // Add vendor info (basic only)
      productData.vendorInfo = {
        vendorId: currentUser.uid,
        vendorName: await getVendorName(currentUser.uid),
        vendorType: 'supplier'
      };
      
      // All contacts through Nahj Al-Rasanah
      productData.contactInfo = {
        primaryContact: 'sales@nahjalrasanah.com',
        phone: '+964 784 349 9555',
        responseTime: '24-48 hours'
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), productData);
      return { id: docRef.id, ...productData };
    } else {
      // Update existing product
      await updateDoc(doc(db, COLLECTIONS.PRODUCTS, productId), productData);
      return { id: productId, ...productData };
    }
    
  } catch (error) {
    console.error('Error saving product:', error);
    throw error;
  }
}

async function deleteProduct(productId) {
  try {
    // Check if user has permission to delete
    const productDoc = await getDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
    if (!productDoc.exists()) {
      throw new Error('Product not found');
    }
    
    const product = productDoc.data();
    
    // Admin can delete any product, vendor can delete only their products
    if (userRole === USER_ROLES.VENDOR && product.vendorId !== currentUser.uid) {
      throw new Error('You can only delete your own products');
    }
    
    await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
    return true;
    
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// ========== RFQ MANAGEMENT ==========
async function loadRFQs() {
  try {
    let rfqsQuery;
    
    if (userRole === USER_ROLES.ADMIN) {
      // Admin sees all RFQs
      rfqsQuery = query(
        collection(db, COLLECTIONS.RFQS),
        orderBy('createdAt', 'desc')
      );
    } else if (userRole === USER_ROLES.VENDOR) {
      // Vendor sees RFQs for their products only
      // First, get vendor's product IDs
      const productsQuery = query(
        collection(db, COLLECTIONS.PRODUCTS),
        where('vendorId', '==', currentUser.uid)
      );
      
      const productsSnapshot = await getDocs(productsQuery);
      const productIds = productsSnapshot.docs.map(doc => doc.id);
      
      if (productIds.length === 0) {
        rfqs = [];
        return rfqs;
      }
      
      // Get RFQs that contain vendor's products
      // Note: This is simplified. For better performance, consider a different data structure
      rfqsQuery = query(
        collection(db, COLLECTIONS.RFQS),
        orderBy('createdAt', 'desc')
      );
      
    } else {
      throw new Error('Unauthorized access');
    }
    
    const querySnapshot = await getDocs(rfqsQuery);
    rfqs = [];
    
    querySnapshot.forEach((doc) => {
      const rfq = {
        id: doc.id,
        ...doc.data()
      };
      
      // For vendors, filter RFQs to show only those containing their products
      if (userRole === USER_ROLES.VENDOR) {
        const productIds = products.map(p => p.id);
        const hasVendorProducts = rfq.items?.some(item => 
          productIds.includes(item.productId)
        );
        
        if (hasVendorProducts) {
          rfqs.push(rfq);
        }
      } else {
        rfqs.push(rfq);
      }
    });
    
    console.log(`Loaded ${rfqs.length} RFQs for ${userRole}`);
    return rfqs;
    
  } catch (error) {
    console.error('Error loading RFQs:', error);
    throw error;
  }
}

async function updateRFQStatus(rfqId, status, notes = '') {
  try {
    const updateData = {
      status: status,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };
    
    if (notes) {
      updateData.notes = notes;
    }
    
    await updateDoc(doc(db, COLLECTIONS.RFQS, rfqId), updateData);
    return true;
    
  } catch (error) {
    console.error('Error updating RFQ:', error);
    throw error;
  }
}

// ========== USER MANAGEMENT (Admin only) ==========
async function createUserAccount(email, password, userData) {
  if (userRole !== USER_ROLES.ADMIN) {
    throw new Error('Only administrators can create user accounts');
  }
  
  try {
    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user document
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      email: email,
      role: userData.role || USER_ROLES.VENDOR,
      createdAt: serverTimestamp(),
      ...userData
    });
    
    // If vendor, create vendor document
    if (userData.role === USER_ROLES.VENDOR) {
      await setDoc(doc(db, COLLECTIONS.VENDORS, user.uid), {
        email: email,
        companyName: userData.companyName || '',
        contactPerson: userData.contactPerson || '',
        phone: userData.phone || '',
        address: userData.address || '',
        status: 'active',
        createdAt: serverTimestamp()
      });
    }
    
    return user.uid;
    
  } catch (error) {
    console.error('Error creating user account:', error);
    throw error;
  }
}

async function getVendorName(vendorId) {
  try {
    const vendorDoc = await getDoc(doc(db, COLLECTIONS.VENDORS, vendorId));
    if (vendorDoc.exists()) {
      return vendorDoc.data().companyName || 'Vendor';
    }
    return 'Vendor';
  } catch (error) {
    console.error('Error getting vendor name:', error);
    return 'Vendor';
  }
}

// ========== FILE UPLOAD ==========
async function uploadFile(file, folder) {
  try {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const storagePath = `products/${currentUser.uid}/${folder}/${fileName}`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
    
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

// ========== UTILITIES ==========
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showMessage(elementId, message, type = 'info') {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const alertClass = {
    success: 'alert-success',
    danger: 'alert-danger',
    warning: 'alert-warning',
    info: 'alert-info'
  }[type] || 'alert-info';
  
  element.innerHTML = `
    <div class="alert ${alertClass} alert-dismissible fade show">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    const alert = element.querySelector('.alert');
    if (alert) {
      alert.remove();
    }
  }, 5000);
}

// ========== EXPORTS ==========
export {
  // Authentication
  auth,
  handleLogin,
  signOut,
  onAuthStateChanged,
  
  // User
  currentUser,
  userRole,
  checkUserRole,
  
  // Products
  loadProducts,
  saveProduct,
  deleteProduct,
  products,
  
  // RFQs
  loadRFQs,
  updateRFQStatus,
  rfqs,
  
  // Users (Admin only)
  createUserAccount,
  
  // Utilities
  formatDate,
  showMessage,
  
  // Constants
  USER_ROLES,
  RFQ_STATUS
};
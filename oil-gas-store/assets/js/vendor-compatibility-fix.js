// assets/js/vendor-compatibility-fix.js
import { initializeFirebase, COLLECTIONS, USER_ROLES, RFQ_STATUS } from './firebase-unified.js';

class VendorManager {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.products = [];
    this.rfqs = [];
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize Firebase
      const { auth, db, storage } = await initializeFirebase();
      this.auth = auth;
      this.db = db;
      this.storage = storage;
      
      // Set up auth state listener
      this.setupAuthListener();
      
      this.initialized = true;
      console.log('VendorManager initialized');
      
    } catch (error) {
      console.error('VendorManager initialization failed:', error);
      throw error;
    }
  }
  
  setupAuthListener() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUser = user;
        this.userRole = await this.getUserRole(user.uid);
        console.log(`User authenticated: ${user.email} (${this.userRole})`);
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('vendor:authenticated', {
          detail: { user, role: this.userRole }
        }));
      } else {
        this.currentUser = null;
        this.userRole = null;
        document.dispatchEvent(new CustomEvent('vendor:unauthenticated'));
        
        // Redirect to login if on vendor page
        if (window.location.pathname.includes('vendor-')) {
          setTimeout(() => {
            window.location.href = 'vendor-login.html';
          }, 1000);
        }
      }
    });
  }
  
  async getUserRole(userId) {
    try {
      const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, userId));
      return userDoc.exists() ? userDoc.data().role : null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }
  
  // === PRODUCT METHODS ===
  async getProducts() {
    if (!this.currentUser || !this.userRole) {
      throw new Error('User not authenticated');
    }
    
    const { collection, query, where, getDocs, orderBy } = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
    
    let productsQuery;
    if (this.userRole === USER_ROLES.ADMIN) {
      productsQuery = query(collection(this.db, COLLECTIONS.PRODUCTS), orderBy('createdAt', 'desc'));
    } else {
      productsQuery = query(
        collection(this.db, COLLECTIONS.PRODUCTS),
        where('vendorId', '==', this.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
    }
    
    const snapshot = await getDocs(productsQuery);
    this.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return this.products;
  }
  
  async saveProduct(productData, productId = null, files = {}) {
    // Similar to your existing saveProduct but using v10 SDK
    // ... implementation
  }
  
  // === RFQ METHODS ===
  async getRFQs() {
    if (!this.currentUser || !this.userRole) {
      throw new Error('User not authenticated');
    }
    
    const { collection, query, getDocs, orderBy } = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
    
    const rfqsQuery = query(collection(this.db, COLLECTIONS.RFQS), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(rfqsQuery);
    const allRfqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter for vendor
    if (this.userRole === USER_ROLES.VENDOR) {
      const productIds = this.products.map(p => p.id);
      this.rfqs = allRfqs.filter(rfq => 
        rfq.items?.some(item => productIds.includes(item.id))
      );
    } else {
      this.rfqs = allRfqs;
    }
    
    return this.rfqs;
  }
  
  // === AUTH METHODS ===
  async login(email, password) {
    const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js");
    return signInWithEmailAndPassword(this.auth, email, password);
  }
  
  async logout() {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js");
    await signOut(this.auth);
  }
}

// Create singleton instance
const vendorManager = new VendorManager();

// Initialize automatically
vendorManager.initialize().catch(console.error);

export default vendorManager;
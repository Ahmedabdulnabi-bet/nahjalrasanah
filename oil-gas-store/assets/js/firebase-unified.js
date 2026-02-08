// assets/js/firebase-unified.js

// Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAtcnouNdsILUvA9EMvrHMhoaWXkMqTMx0",
  authDomain: "nahj-oilgas-store.firebaseapp.com",
  projectId: "nahj-oilgas-store",
  storageBucket: "nahj-oilgas-store.appspot.com",
  messagingSenderId: "967640800678",
  appId: "1:967640800678:web:4b018066c733c4e4500367",
  measurementId: "G-9XZPG5TJ6W"
};

// Firebase SDK imports - Version 10.13.1 (Latest)
export const firebaseSDK = {
  app: "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js",
  auth: "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js",
  firestore: "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js",
  storage: "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js",
  analytics: "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js"
};

// Collections
export const COLLECTIONS = {
  PRODUCTS: 'products',
  USERS: 'users',
  VENDORS: 'vendors',
  RFQS: 'rfqs',
  ANALYTICS_PAGEVIEWS: 'analytics_pageviews',
  ANALYTICS_EVENTS: 'analytics_events'
};

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  CUSTOMER: 'customer'
};

// RFQ status
export const RFQ_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  RESPONDED: 'responded',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

// Initialize Firebase App (singleton)
let appInstance = null;
let authInstance = null;
let dbInstance = null;
let storageInstance = null;

export async function initializeFirebase() {
  if (appInstance) return { app: appInstance, auth: authInstance, db: dbInstance, storage: storageInstance };
  
  try {
    // Dynamically import Firebase modules
    const { initializeApp } = await import(firebaseSDK.app);
    const { getAuth } = await import(firebaseSDK.auth);
    const { getFirestore } = await import(firebaseSDK.firestore);
    const { getStorage } = await import(firebaseSDK.storage);
    
    // Initialize Firebase
    appInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    storageInstance = getStorage(appInstance);
    
    console.log('✅ Firebase initialized successfully');
    
    return {
      app: appInstance,
      auth: authInstance,
      db: dbInstance,
      storage: storageInstance
    };
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

// Helper functions
export function formatFirestoreDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatCurrency(amount, currency = 'IQD') {
  if (currency === 'IQD') {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}
// assets/js/firebase-config.js
export const firebaseConfig = {
  apiKey: "AIzaSyAtcnouNdsILUvA9EMvrHMhoaWXkMqTMx0",
  authDomain: "nahj-oilgas-store.firebaseapp.com",
  projectId: "nahj-oilgas-store",
  storageBucket: "nahj-oilgas-store.appspot.com",
  messagingSenderId: "967640800678",
  appId: "1:967640800678:web:4b018066c733c4e4500367",
  measurementId: "G-9XZPG5TJ6W"
};

// Collections
export const COLLECTIONS = {
  PRODUCTS: 'products',
  USERS: 'users',
  VENDORS: 'vendors',
  RFQS: 'rfqs',
  ARTICLES: 'articles'
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
  QUOTED: 'quoted',
  CLOSED: 'closed'
};
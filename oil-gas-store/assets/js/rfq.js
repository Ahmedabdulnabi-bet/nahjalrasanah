// assets/js/rfq-fixed.js
import { firebaseConfig, COLLECTIONS } from './firebase-config.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Storage key
const STORAGE_KEY_RFQ = 'nahj_rfq_cart_v2';
let products = [];

// ========== RFQ CART FUNCTIONS ==========
function getRfqCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RFQ);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function
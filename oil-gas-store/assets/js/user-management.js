// ملف جديد لإنشاء وإدارة المستخدمين

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { 
  getFirestore, 
  setDoc, 
  doc, 
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// دالة لإنشاء مسؤول جديد
export async function createAdminUser(email, password, adminData = {}) {
  try {
    // 1. إنشاء مستخدم في Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. إضافة بيانات المسؤول في Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: email,
      role: 'admin',
      ...adminData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ المسؤول تم إنشاؤه بنجاح:', user.uid);
    return { success: true, userId: user.uid };
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء المسؤول:', error.message);
    return { success: false, error: error.message };
  }
}

// دالة لإنشاء بائع جديد
export async function createVendorUser(email, password, vendorData = {}) {
  try {
    // 1. إنشاء مستخدم في Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. إضافة بيانات البائع في Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: email,
      role: 'vendor',
      ...vendorData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ البائع تم إنشاؤه بنجاح:', user.uid);
    return { success: true, userId: user.uid };
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء البائع:', error.message);
    return { success: false, error: error.message };
  }
}

// دالة لتحويل مستخدم عادي إلى مسؤول
export async function upgradeToAdmin(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    
    await setDoc(userRef, {
      role: 'admin',
      updatedAt: serverTimestamp()
    }, { merge: true }); // merge: true للحفاظ على البيانات الأخرى
    
    console.log('✅ تم ترقية المستخدم إلى مسؤول:', userId);
    return { success: true };
    
  } catch (error) {
    console.error('❌ خطأ في الترقية:', error.message);
    return { success: false, error: error.message };
  }
}

// دالة للتحقق من دور المستخدم
export async function checkUserRole(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return { 
        success: true, 
        role: userData.role || 'vendor',
        email: userData.email 
      };
    } else {
      return { success: false, error: 'المستخدم غير موجود' };
    }
    
  } catch (error) {
    console.error('❌ خطأ في التحقق:', error.message);
    return { success: false, error: error.message };
  }
}
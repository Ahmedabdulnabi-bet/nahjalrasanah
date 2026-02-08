import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { 
    getFirestore, 
    setDoc, 
    doc, 
    getDocs,
    collection,
    serverTimestamp,
    deleteDoc 
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// عناصر DOM
const roleCards = document.querySelectorAll('.role-card');
const userRoleInput = document.getElementById('user-role');
const vendorFields = document.getElementById('vendor-fields');
const adminFields = document.getElementById('admin-fields');
const registrationForm = document.getElementById('registration-form');
const messageDiv = document.getElementById('message');
const usersList = document.getElementById('users-list');
const createBtn = document.getElementById('create-btn');

// التحقق من تسجيل الدخول كمسؤول
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role !== 'admin') {
                    // إذا لم يكن مسؤولاً، توجيهه للوحة التحكم
                    window.location.href = 'vendor-dashboard.html';
                } else {
                    // إذا كان مسؤولاً، تحميل قائمة المستخدمين
                    loadUsers();
                }
            }
        } catch (error) {
            console.error('خطأ في التحقق:', error);
        }
    } else {
        // إذا لم يكن مسجلاً، توجيهه لصفحة الدخول
        window.location.href = 'admin.html';
    }
});

// اختيار نوع الحساب
roleCards.forEach(card => {
    card.addEventListener('click', () => {
        // إزالة التحديد من جميع البطاقات
        roleCards.forEach(c => c.classList.remove('selected', 'border-primary'));
        
        // إضافة التحديد للبطاقة المختارة
        card.classList.add('selected', 'border-primary');
        
        // تحديث قيمة الدور
        const role = card.dataset.role;
        userRoleInput.value = role;
        
        // إظهار/إخفاء الحقول المناسبة
        if (role === 'vendor') {
            vendorFields.classList.remove('d-none');
            adminFields.classList.add('d-none');
        } else {
            vendorFields.classList.add('d-none');
            adminFields.classList.remove('d-none');
        }
    });
});

// إنشاء حساب جديد
registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = userRoleInput.value;
    
    // التحقق من المدخلات
    if (!email || !password) {
        showMessage('يرجى ملء جميع الحقول المطلوبة', 'danger');
        return;
    }
    
    if (password.length < 6) {
        showMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'danger');
        return;
    }
    
    try {
        // تعطيل الزر أثناء الإنشاء
        createBtn.disabled = true;
        createBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> جاري الإنشاء...';
        
        // 1. إنشاء المستخدم في Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. تحضير البيانات للـ Firestore
        const userData = {
            email: email,
            role: role,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // إضافة بيانات إضافية حسب الدور
        if (role === 'vendor') {
            userData.companyName = document.getElementById('company-name').value.trim() || null;
            userData.phone = document.getElementById('phone-number').value.trim() || null;
            userData.address = document.getElementById('company-address').value.trim() || null;
        } else if (role === 'admin') {
            userData.fullName = document.getElementById('admin-name').value.trim() || null;
        }
        
        // 3. حفظ البيانات في Firestore
        await setDoc(doc(db, 'users', user.uid), userData);
        
        // 4. تسجيل خروج المستخدم الجديد (لينتظر تسجيل دخوله الخاص)
        await auth.signOut();
        
        // 5. تسجيل دخول المسؤول مرة أخرى
        const adminUser = auth.currentUser;
        if (adminUser) {
            await signInWithEmailAndPassword(auth, adminUser.email, password);
        }
        
        // 6. عرض رسالة النجاح
        showMessage(`✅ تم إنشاء حساب ${role === 'admin' ? 'مسؤول' : 'بائع'} بنجاح!`, 'success');
        
        // 7. تحديث القائمة وفرم النموذج
        registrationForm.reset();
        loadUsers();
        
    } catch (error) {
        console.error('خطأ في إنشاء الحساب:', error);
        
        let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'بريد إلكتروني غير صالح';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'كلمة المرور ضعيفة جداً';
        }
        
        showMessage(`❌ ${errorMessage}`, 'danger');
        
    } finally {
        // إعادة تفعيل الزر
        createBtn.disabled = false;
        createBtn.innerHTML = '<i class="bi bi-person-plus"></i> إنشاء الحساب';
    }
});

// تحميل قائمة المستخدمين
async function loadUsers() {
    try {
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);
        
        usersList.innerHTML = '';
        
        if (snapshot.empty) {
            usersList.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-3">
                        لا يوجد مستخدمون بعد
                    </td>
                </tr>
            `;
            return;
        }
        
        snapshot.forEach((docSnap) => {
            const user = { id: docSnap.id, ...docSnap.data() };
            const date = user.createdAt?.toDate ? 
                user.createdAt.toDate().toLocaleDateString('ar-SA') : 
                'غير معروف';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.email || 'N/A'}</td>
                <td>
                    <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-success'}">
                        ${user.role === 'admin' ? 'مسؤول' : 'بائع'}
                    </span>
                </td>
                <td>${date}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger delete-user-btn" data-id="${user.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            
            usersList.appendChild(row);
        });
        
        // إضافة مستمعين لأزرار الحذف
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = e.target.closest('.delete-user-btn').dataset.id;
                await deleteUser(userId);
            });
        });
        
    } catch (error) {
        console.error('خطأ في تحميل المستخدمين:', error);
        showMessage('❌ خطأ في تحميل قائمة المستخدمين', 'danger');
    }
}

// حذف مستخدم
async function deleteUser(userId) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    
    try {
        // ملاحظة: يجب أيضاً حذف المستخدم من Authentication
        // ولكن هذه الوظيفة تتطلب صلاحيات خاصة
        
        // حذف من Firestore فقط
        await deleteDoc(doc(db, 'users', userId));
        
        showMessage('✅ تم حذف المستخدم بنجاح', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('خطأ في حذف المستخدم:', error);
        showMessage('❌ خطأ في حذف المستخدم', 'danger');
    }
}

// عرض الرسائل
function showMessage(text, type = 'info') {
    messageDiv.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show">
            ${text}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}

// التحميل الأولي
document.addEventListener('DOMContentLoaded', () => {
    // اختيار البائع كإفتراضي
    const vendorCard = document.querySelector('[data-role="vendor"]');
    if (vendorCard) {
        vendorCard.click();
    }
});
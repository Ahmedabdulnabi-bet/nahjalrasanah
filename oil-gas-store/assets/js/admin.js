// في بداية admin.js - بعد onAuthStateChanged
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Check if user is admin
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    let isAdmin = false;
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      isAdmin = userData.role === 'admin';
    }
    
    if (isAdmin) {
      // Show admin panel
      loginSection.classList.add('d-none');
      adminSection.classList.remove('d-none');
      // ... rest of admin code
    } else {
      // Redirect vendors to their dashboard
      window.location.href = 'vendor-dashboard.html';
    }
  } else {
    // User not logged in
    loginSection.classList.remove('d-none');
    adminSection.classList.add('d-none');
  }
});
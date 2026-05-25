// Dynamic Navbar Management with Firebase Auth
// This script handles navbar authentication state across all pages

(function () {
  // Dynamically determine API base URL (same as config.js)
  const API = (function () {
    const host = window.location.hostname;
    if (host === "localhost" || host.startsWith("127.")) {
      return `${location.protocol}//${host}:5001/api`;
    }
    return "/api";
  })();
  console.log('📍 navbar.js using API base:', API);
  
  // Wait for Firebase Auth to be available
  function initNavbar() {
    // If Firebase hasn't initialized yet, still apply localAdmin UI immediately
    if (!window.firebaseAuth) {
      try {
        updateNavbarUI(null);
        console.log('✅ Applied navbar UI before Firebase ready');
      } catch (e) {
        console.warn('navbar: updateNavbarUI before firebase ready failed', e);
      }
      setTimeout(initNavbar, 100);
      return;
    }

    const auth = window.firebaseAuth;

    // Apply UI immediately with current Firebase user
    try {
      updateNavbarUI(auth.currentUser || null);
      console.log('✅ Applied initial navbar UI');
    } catch (e) {
      console.warn('navbar: initial updateNavbarUI failed', e);
    }

    // Listen to auth state changes
    auth.onAuthStateChanged((user) => {
      updateNavbarUI(user);
      console.log('✅ Updated navbar UI on auth state change');
    });
  }

  function updateNavbarUI(user) {
    const loginBtn = document.getElementById("loginBtn");
    const logoutContainer = document.getElementById("logoutContainer");
    const logoutBtn = document.getElementById("logoutBtn");
    const userNameDisplay = document.getElementById("userNameDisplay");

    // Check if this is an admin user (check localStorage first, this is set by login.html)
    const isLocalAdmin = localStorage.getItem('localAdmin') === '1';
    const isAdmin = isLocalAdmin;
    const adminAnchor = document.querySelector('a[href="admin.html"]');
    const adminLi = adminAnchor ? adminAnchor.closest('li') : null;
    
    console.log(`🔍 Admin detection: isLocalAdmin=${isLocalAdmin}, adminLink=${!!adminAnchor}, adminLi=${!!adminLi}`);

    // Admin mode: show Admin Panel, hide Cart/Orders/Profile
    if (isAdmin) {
      console.log('👑 Admin mode detected');
      if (adminLi) {
        adminLi.classList.remove('d-none');
        console.log('✅ Admin link shown');
      } else {
        console.warn('⚠️ Admin link <li> not found');
      }

      // Hide non-admin nav items (Cart, Orders, Profile)
      const cartLink = document.querySelector('a[href="cart.html"]');
      const ordersLink = document.querySelector('a[href="orders.html"]');
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (cartLink) cartLink.closest('li').classList.add('d-none');
      if (ordersLink) ordersLink.closest('li').classList.add('d-none');
      if (profileLink) profileLink.closest('li').classList.add('d-none');

      if (loginBtn) loginBtn.classList.add('d-none');
      if (logoutContainer) logoutContainer.classList.remove('d-none');
      if (userNameDisplay) {
        const span = userNameDisplay.querySelector('span');
        if (span) {
          span.textContent = `Hi, Admin`;
          console.log('✅ Set userNameDisplay to "Hi, Admin"');
        }
        userNameDisplay.classList.remove('d-none');
      }

      // Setup admin logout handler
      if (logoutBtn && !logoutBtn.dataset.adminLogoutHandler) {
        logoutBtn.dataset.adminLogoutHandler = '1';
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('🚪 Admin logout clicked');
          localStorage.removeItem('localAdmin');
          localStorage.removeItem('localAdminEmail');
          window.location.href = 'index.html';
        });
      }
    } else {
      // Non-admin mode: hide Admin Panel, show Cart/Orders/Profile
      console.log('👤 Non-admin mode detected');
      if (adminLi) {
        adminLi.classList.add('d-none');
      }

      // Show regular user nav items (Cart, Orders, Profile)
      const cartLink = document.querySelector('a[href="cart.html"]');
      const ordersLink = document.querySelector('a[href="orders.html"]');
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (cartLink) cartLink.closest('li').classList.remove('d-none');
      if (ordersLink) ordersLink.closest('li').classList.remove('d-none');
      if (profileLink) profileLink.closest('li').classList.remove('d-none');
    }

    if (user && !isAdmin) {
      // Firebase user is logged in and NOT an admin
      console.log('🔥 Firebase user:', user.email);
      if (loginBtn) {
        loginBtn.classList.add("d-none");
      }
      if (logoutContainer) {
        logoutContainer.classList.remove("d-none");
      }
      if (userNameDisplay) {
        const displayName = user.displayName || user.email.split("@")[0];
        const span = userNameDisplay.querySelector("span");
        if (span) {
          span.textContent = `Hi, ${displayName}`;
        }
        userNameDisplay.classList.remove("d-none");
      }

      // Setup Firebase logout button
      if (logoutBtn && !logoutBtn.dataset.firebaseLogoutHandler) {
        logoutBtn.dataset.firebaseLogoutHandler = '1';
        logoutBtn.onclick = async (e) => {
          e.preventDefault();
          console.log('🚪 Firebase logout clicked');
          try {
            const auth = window.firebaseAuth;
            
            // Logout from backend
            try {
              await fetch(`${API}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
              });
              console.log('✅ Backend session cleared');
            } catch (backendErr) {
              console.warn('Backend logout failed:', backendErr);
            }
            
            // Sign out from Firebase
            await auth.signOut();
            console.log('✅ Firebase sign-out successful');
            
            window.location.href = "index.html";
          } catch (error) {
            console.error("Logout error:", error);
            alert("Failed to logout. Please try again.");
          }
        };
      }
    } else if (!user && !isAdmin) {
      // User is logged out
      console.log('🚫 User logged out');
      if (loginBtn) {
        loginBtn.classList.remove("d-none");
      }
      if (logoutContainer) {
        logoutContainer.classList.add("d-none");
      }
      if (userNameDisplay) {
        userNameDisplay.classList.add("d-none");
        const span = userNameDisplay.querySelector("span");
        if (span) {
          span.textContent = "";
        }
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initNavbar();
      window.navbarInitialized = true;
      console.log('✅ navbar.js initialized');
    });
  } else {
    initNavbar();
    window.navbarInitialized = true;
    console.log('✅ navbar.js initialized');
  }
})();

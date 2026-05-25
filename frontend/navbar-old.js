// Dynamic Navbar Management with Firebase Auth
// This script handles navbar authentication state across all pages

(function () {
  // Dynamically determine API base URL (same as config.js)
  const API = (function () {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${location.protocol}//${host}:5001/api`;
    }
    return "/api";
  })();
  console.log('📍 navbar.js using API base:', API);
  // backend admin cached status: true/false/null (null = unknown)
  window.__backendAdmin = null;

  // Check backend session `/auth/me` to determine admin role
  async function checkBackendAdmin() {
    try {
      if (window.__backendAdmin !== null) return window.__backendAdmin;
      if (typeof fetchWithFallback !== 'function') return (window.__backendAdmin = false);
      const res = await fetchWithFallback('/auth/me', { credentials: 'include' });
      if (!res) return (window.__backendAdmin = false);
      if (!res.ok) return (window.__backendAdmin = false);
      const j = await res.json().catch(() => null);
      if (j && j.user && j.user.role === 'admin') {
        window.__backendAdmin = true;
        return true;
      }
      window.__backendAdmin = false;
      return false;
    } catch (e) {
      console.warn('checkBackendAdmin error', e);
      window.__backendAdmin = false;
      return false;
    }
  }
  
  // Wait for Firebase Auth to be available
  function initNavbar() {
    // If Firebase hasn't initialized yet, still apply localAdmin UI
    if (!window.firebaseAuth) {
      // Apply UI based on localStorage (so admin link shows immediately)
      try {
        updateNavbarUI(null);
      } catch (e) {
        console.warn('navbar: updateNavbarUI before firebase ready failed', e);
      }
      setTimeout(initNavbar, 100);
      return;
    }

    const auth = window.firebaseAuth;

    // On init: check backend admin status then update UI
    checkBackendAdmin().then(() => {
      try {
        updateNavbarUI(auth.currentUser || null);
      } catch (e) {
        console.warn('navbar: initial updateNavbarUI failed', e);
      }
    });

    // Listen to auth state changes: re-check backend admin and update UI
    auth.onAuthStateChanged(async (user) => {
      // reset backend admin cache to ensure fresh check for this session
      window.__backendAdmin = null;
      await checkBackendAdmin();
      updateNavbarUI(user);
    });
  }

  function updateNavbarUI(user) {
    const loginBtn = document.getElementById("loginBtn");
    const logoutContainer = document.getElementById("logoutContainer");
    const logoutBtn = document.getElementById("logoutBtn");
    const userNameDisplay = document.getElementById("userNameDisplay");

    const isLocalAdmin = localStorage.getItem('localAdmin') === '1';
    const isBackendAdmin = window.__backendAdmin === true;
    const isAdmin = isLocalAdmin || isBackendAdmin;
    const adminAnchor = document.querySelector('a[href="admin.html"]');
    const adminLi = adminAnchor ? adminAnchor.closest('li') : null;

    // Admin mode: show only Home, Admin Panel, and Hi Admin / Logout
    if (isAdmin) {
      if (adminLi) adminLi.classList.remove('d-none');

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
        if (span) span.textContent = `Hi, Admin`;
        userNameDisplay.classList.remove('d-none');
      }

      // If backend admin not a local admin, let normal logout behavior clear session
      if (isLocalAdmin && logoutBtn && !logoutBtn.dataset.localAdminHandler) {
        logoutBtn.dataset.localAdminHandler = '1';
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          localStorage.removeItem('localAdmin');
          localStorage.removeItem('localAdminEmail');
          window.location.href = 'index.html';
        });
      }
    } else {
      // Non-admin: hide admin link, show regular user links
      if (adminLi) adminLi.classList.add('d-none');

      // Show regular user nav items (Cart, Orders, Profile)
      const cartLink = document.querySelector('a[href="cart.html"]');
      const ordersLink = document.querySelector('a[href="orders.html"]');
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (cartLink) cartLink.closest('li').classList.remove('d-none');
      if (ordersLink) ordersLink.closest('li').classList.remove('d-none');
      if (profileLink) profileLink.closest('li').classList.remove('d-none');
    }

    if (user) {
      // Skip Firebase updates if local admin is active (admin has priority)
      if (isLocalAdmin) return;
      
      // User is logged in
      if (loginBtn) {
        loginBtn.classList.add("d-none");
      }
      if (logoutContainer) {
        logoutContainer.classList.remove("d-none");
      }
      if (userNameDisplay) {
        // Display user's name or email - find the span inside
        const displayName = user.displayName || user.email.split("@")[0];
        const span = userNameDisplay.querySelector("span");
        if (span) {
          span.textContent = `Hi, ${displayName}`;
        }
        userNameDisplay.classList.remove("d-none");
      }

      // Setup logout button
      if (logoutBtn && !logoutBtn.dataset.listenerAttached) {
        logoutBtn.dataset.listenerAttached = 'true';
        logoutBtn.onclick = async (e) => {
          e.preventDefault();
          console.log('🚪 Logging out...');
          try {
            const auth = window.firebaseAuth;
            
            // Step 1: Logout from backend
            console.log('🔄 Clearing backend session...');
            try {
              if (typeof fetchWithFallback === 'function') {
                await fetchWithFallback('/auth/logout', { method: 'POST', credentials: 'include' });
              } else {
                await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
              }
              console.log('✅ Backend session cleared');
            } catch (backendErr) {
              console.warn('Backend logout failed:', backendErr);
            }
            
            // Step 2: Sign out from Firebase
            console.log('🔥 Signing out from Firebase...');
            await auth.signOut();
            console.log('✅ Firebase sign-out successful');
            
            // Step 3: Redirect
            window.location.href = "index.html";
          } catch (error) {
            console.error("Logout error:", error);
            alert("Failed to logout. Please try again.");
          }
        };
      }
    } else {
      // User is logged out
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

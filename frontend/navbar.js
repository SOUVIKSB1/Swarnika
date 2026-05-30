// Dynamic Navbar Management with Firebase Auth
// This script handles navbar authentication state across all pages

(function () {
  // Initialize global auth state variables
  window.authStateSettled = false;
  window.authCurrentUser = null;

  // Dynamically determine API base URL (same as config.js)
  const API = (function () {
    let host = window.location.hostname;
    let protocol = location.protocol;
    if (protocol === "file:" || !host) {
      host = "localhost";
      protocol = "http:";
    }
    if (host === "localhost" || host.startsWith("127.")) {
      return `${protocol}//${host}:5001/api`;
    }
    return "/api";
  })();
  console.log('📍 navbar.js using API base:', API);

  // Fetch cart count from backend using all available credentials
  async function fetchCartCount() {
    try {
      const headers = {};
      const authToken = localStorage.getItem("authToken");
      const firebaseToken = localStorage.getItem("firebaseIdToken");
      const guestId = localStorage.getItem("guestId");

      if (authToken) headers["x-auth-token"] = authToken;
      if (firebaseToken) headers["Authorization"] = `Bearer ${firebaseToken}`;
      if (guestId) headers["x-guest-id"] = guestId;

      const checkRes = window.fetchWithFallback 
        ? await window.fetchWithFallback('/cart', { credentials: "include", headers })
        : await fetch(`${API}/cart`, { credentials: "include", headers });

      if (!checkRes.ok) return 0;
      const cartData = await checkRes.json();
      return cartData.items ? cartData.items.reduce((s, i) => s + (i.quantity || 0), 0) : 0;
    } catch (e) {
      console.warn('Navbar cart count fetch failed:', e);
      return 0;
    }
  }

  // Update navbar cart count elements globally
  window.updateGlobalCartCount = async function () {
    const count = await fetchCartCount();
    document.querySelectorAll(".cart-count").forEach((el) => {
      el.textContent = count > 0 ? `(${count})` : "";
    });
  };
  
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

    // Helper to refresh and store token (returns a Promise)
    async function refreshFirebaseToken(user) {
      if (user) {
        try {
          const token = await user.getIdToken();
          localStorage.setItem("firebaseIdToken", token);
          console.log("🔥 Firebase ID token refreshed and stored");
        } catch (err) {
          console.error("❌ Failed to get Firebase ID token:", err);
        }
      } else {
        localStorage.removeItem("firebaseIdToken");
        console.log("🧹 Firebase ID token removed");
      }
    }

    // Apply UI immediately with current Firebase user
    (async () => {
      try {
        if (auth.currentUser) {
          await refreshFirebaseToken(auth.currentUser);
          window.authStateSettled = true;
          window.authCurrentUser = auth.currentUser;
          updateNavbarUI(auth.currentUser);
          console.log('✅ Applied initial navbar UI');
          
          // Dispatch event if settled immediately
          const event = new CustomEvent("authStateSettled", { detail: { user: auth.currentUser } });
          document.dispatchEvent(event);
          await window.updateGlobalCartCount();
        }
      } catch (e) {
        console.warn('navbar: initial updateNavbarUI failed', e);
      }
    })();

    // Listen to auth state changes
    auth.onAuthStateChanged(async (user) => {
      await refreshFirebaseToken(user);
      
      let finalUser = user;
      if (!user) {
        // Try backend /auth/me fetch if token exists in localStorage or cookies
        const authToken = localStorage.getItem("authToken");
        const firebaseToken = localStorage.getItem("firebaseIdToken");
        if (authToken || firebaseToken) {
          try {
            const headers = {};
            if (authToken) headers["x-auth-token"] = authToken;
            if (firebaseToken) headers["Authorization"] = `Bearer ${firebaseToken}`;
            
            const checkRes = window.fetchWithFallback 
              ? await window.fetchWithFallback('/auth/me', { credentials: "include", headers })
              : await fetch(`${API}/auth/me`, { credentials: "include", headers });
            if (checkRes.ok) {
              const meData = await checkRes.json();
              finalUser = {
                email: meData.email,
                displayName: meData.name || meData.displayName,
                isBackendUser: true
              };
              console.log('✅ Found backend user session:', meData.email);
            }
          } catch (e) {
            console.warn('Backend session check failed:', e);
          }
        }
      }
      
      window.authStateSettled = true;
      window.authCurrentUser = finalUser;
      updateNavbarUI(finalUser);
      console.log('✅ Updated navbar UI on auth state change');
      
      if (finalUser) {
        syncLocalGuestCart(finalUser);
      }
      
      // Dispatch custom event to notify listeners
      const event = new CustomEvent("authStateSettled", { detail: { user: finalUser } });
      document.dispatchEvent(event);
      await window.updateGlobalCartCount();
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
      const ordersLinks = document.querySelectorAll('a[href^="orders.html"]');
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (cartLink) cartLink.closest('li').classList.add('d-none');
      ordersLinks.forEach(link => {
        if (link) link.closest('li').classList.add('d-none');
      });
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
      const ordersLinks = document.querySelectorAll('a[href^="orders.html"]');
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (cartLink) cartLink.closest('li').classList.remove('d-none');
      ordersLinks.forEach(link => {
        if (link) link.closest('li').classList.remove('d-none');
      });
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

      // Setup Firebase/Backend logout button
      if (logoutBtn && !logoutBtn.dataset.firebaseLogoutHandler) {
        logoutBtn.dataset.firebaseLogoutHandler = '1';
        logoutBtn.onclick = async (e) => {
          e.preventDefault();
          console.log('🚪 Logout clicked');
          try {
            const auth = window.firebaseAuth;
            
            // Logout from backend
            try {
              const fetchFn = window.fetchWithFallback || fetch;
              const logoutEndpoint = window.fetchWithFallback ? '/auth/logout' : `${API}/auth/logout`;
              await fetchFn(logoutEndpoint, {
                method: 'POST',
                credentials: 'include'
              });
              console.log('✅ Backend session cleared');
            } catch (backendErr) {
              console.warn('Backend logout failed:', backendErr);
            }
            
            // Clear local storage tokens
            localStorage.removeItem("authToken");
            localStorage.removeItem("firebaseIdToken");
            localStorage.removeItem("localAdmin");
            localStorage.removeItem("localAdminEmail");
            
            // Sign out from Firebase
            if (auth) {
              try {
                await auth.signOut();
                console.log('✅ Firebase sign-out successful');
              } catch (fsErr) {
                console.warn('Firebase sign-out failed:', fsErr);
              }
            }
            
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

  // Sync localStorage guestCart to backend when user is logged in
  async function syncLocalGuestCart(user) {
    const localGuestCart = localStorage.getItem("guestCart");
    if (!localGuestCart) return;
    
    try {
      const parsed = JSON.parse(localGuestCart);
      const items = parsed.items || [];
      if (items.length === 0) return;
      
      console.log('🔄 Syncing local guestCart to backend...', items);
      
      const authToken = localStorage.getItem("authToken");
      const firebaseToken = localStorage.getItem("firebaseIdToken");
      const headers = { "Content-Type": "application/json" };
      if (authToken) headers["x-auth-token"] = authToken;
      if (firebaseToken) headers["Authorization"] = `Bearer ${firebaseToken}`;
      
      const fetchFn = window.fetchWithFallback || fetch;
      
      for (const item of items) {
        if (!item.productId) continue;
        const res = await fetchFn(window.fetchWithFallback ? '/cart/add' : `${API}/cart/add`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ productId: item.productId, quantity: item.quantity || 1 }),
        });
        if (res.ok) {
          console.log(`✅ Synced item ${item.productId} to backend`);
        } else {
          console.warn(`⚠️ Failed to sync item ${item.productId}`);
        }
      }
      
      localStorage.removeItem("guestCart");
      console.log('✅ Local guestCart synced and cleared');
      
      // Update cart count badge
      const countSpan = document.querySelectorAll(".cart-count");
      if (countSpan.length > 0) {
        const checkRes = window.fetchWithFallback 
          ? await window.fetchWithFallback('/cart', { credentials: "include", headers })
          : await fetch(`${API}/cart`, { credentials: "include", headers });
        if (checkRes.ok) {
          const cartData = await checkRes.json();
          const count = cartData.items ? cartData.items.reduce((s, i) => s + (i.quantity || 0), 0) : 0;
          countSpan.forEach((el) => {
            el.textContent = count > 0 ? `(${count})` : "";
          });
        }
      }
      
      // Refresh current page if on cart.html to show new items
      if (window.location.pathname.includes("cart.html")) {
        console.log('🔄 Reloading cart page to reflect synced items');
        if (typeof loadCart === "function") {
          loadCart(true, true);
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      console.warn('Failed to sync local guestCart:', err);
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

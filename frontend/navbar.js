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

  // Trigger background ping to wake up the Render web service
  (async function triggerRenderPing() {
    try {
      const fetchFn = window.fetchWithFallback || fetch;
      const res = await fetchFn('/ping');
      const text = await res.text();
      console.log('🏓 Render wake-up ping response:', text);
    } catch (e) {
      console.warn('⚠️ Render wake-up ping failed:', e.message);
    }
  })();

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

  // --- Notifications Helper Functions ---
  let notifInterval = null;

  async function fetchAndRenderNotifications() {
    const badge = document.getElementById("notificationBadge");
    const container = document.getElementById("notificationsContainer");
    if (!badge || !container) return;

    try {
      const headers = {};
      const authToken = localStorage.getItem("authToken");
      const firebaseToken = localStorage.getItem("firebaseIdToken");
      if (authToken) headers["x-auth-token"] = authToken;
      if (firebaseToken) headers["Authorization"] = `Bearer ${firebaseToken}`;

      const fetchFn = window.fetchWithFallback || fetch;
      const endpoint = window.fetchWithFallback ? '/auth/notifications' : `${API}/auth/notifications`;
      const res = await fetchFn(endpoint, { credentials: "include", headers });

      if (!res.ok) throw new Error("HTTP " + res.status);
      const notifications = await res.json();

      const unreadCount = notifications.filter(n => !n.read).length;
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.classList.remove("d-none");
      } else {
        badge.classList.add("d-none");
      }

      if (notifications.length === 0) {
        container.innerHTML = `<li class="text-center py-4 text-muted small">🎉 All caught up! No notifications.</li>`;
        return;
      }

      container.innerHTML = notifications.map(n => {
        const dateStr = new Date(n.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });

        let typeIcon = '🔔';
        if (n.type === 'shipping') typeIcon = '🚚';
        else if (n.type === 'delivery') typeIcon = '✅';
        else if (n.type === 'cancelled') typeIcon = '❌';
        else if (n.type === 'admin_message') typeIcon = '✉️';

        const unreadStyle = n.read 
          ? 'background: transparent;' 
          : 'background: rgba(201, 168, 76, 0.08) !important; border-left: 3.5px solid var(--gold-light) !important;';
        
        return `
          <li class="dropdown-item p-3 border-bottom text-wrap notif-item" style="cursor: pointer; ${unreadStyle}" onclick="handleNotificationClick('${n._id || n.id}', '${n.type}', '${n.message}')">
            <div class="d-flex gap-2">
              <div class="notif-icon-circle" style="font-size: 1.1rem; line-height: 1;">${typeIcon}</div>
              <div class="flex-grow-1" style="min-width: 0;">
                <div class="fw-bold small d-flex justify-content-between align-items-center" style="color: var(--gold-light) !important;">
                  <span>${n.title}</span>
                  ${n.read ? '' : '<span class="notif-dot bg-warning rounded-circle" style="width: 6px; height: 6px; display: inline-block;"></span>'}
                </div>
                <div class="small mt-1 text-wrap" style="font-size: 0.78rem; line-height: 1.35; color: var(--text) !important;">${n.message}</div>
                <div class="text-end mt-1" style="font-size: 0.65rem; color: var(--text-soft) !important;">${dateStr}</div>
              </div>
            </div>
          </li>
        `;
      }).join('');
      
    } catch (e) {
      console.warn("Error loading notifications in navbar:", e);
      container.innerHTML = `<li class="text-center py-3 text-danger small">⚠️ Error loading notifications.</li>`;
    }
  }

  window.handleNotificationClick = async function(id, type, message) {
    try {
      const headers = { "Content-Type": "application/json" };
      const authToken = localStorage.getItem("authToken");
      const firebaseToken = localStorage.getItem("firebaseIdToken");
      if (authToken) headers["x-auth-token"] = authToken;
      if (firebaseToken) headers["Authorization"] = `Bearer ${firebaseToken}`;

      const fetchFn = window.fetchWithFallback || fetch;
      const endpoint = window.fetchWithFallback ? '/auth/notifications/read' : `${API}/auth/notifications/read`;
      await fetchFn(endpoint, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ notificationId: id })
      });

      fetchAndRenderNotifications();

      const orderMatch = message.match(/order #([a-f0-9]+)/i);
      if (orderMatch && orderMatch[1]) {
        window.location.href = `order-details.html?id=${orderMatch[1]}`;
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  async function markAllNotificationsRead() {
    try {
      const headers = { "Content-Type": "application/json" };
      const authToken = localStorage.getItem("authToken");
      const firebaseToken = localStorage.getItem("firebaseIdToken");
      if (authToken) headers["x-auth-token"] = authToken;
      if (firebaseToken) headers["Authorization"] = `Bearer ${firebaseToken}`;

      const fetchFn = window.fetchWithFallback || fetch;
      const endpoint = window.fetchWithFallback ? '/auth/notifications/read' : `${API}/auth/notifications/read`;
      const res = await fetchFn(endpoint, {
        method: "PUT",
        headers,
        credentials: "include"
      });
      if (res.ok) {
        fetchAndRenderNotifications();
      }
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  }
  
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
      const authToken = localStorage.getItem("authToken");
      const firebaseToken = localStorage.getItem("firebaseIdToken");
      if (authToken || firebaseToken || user) {
        try {
          const headers = {};
          if (authToken) headers["x-auth-token"] = authToken;
          if (firebaseToken) headers["Authorization"] = `Bearer ${firebaseToken}`;
          else if (user) {
            const token = await user.getIdToken();
            headers["Authorization"] = `Bearer ${token}`;
          }
          
          const checkRes = window.fetchWithFallback 
            ? await window.fetchWithFallback('/auth/me', { credentials: "include", headers })
            : await fetch(`${API}/auth/me`, { credentials: "include", headers });
          if (checkRes.ok) {
            const meData = await checkRes.json();
            finalUser = {
              email: meData.email,
              displayName: meData.name || meData.displayName,
              profileImage: meData.profileImage || "",
              role: meData.role,
              isBackendUser: true
            };
            console.log('✅ Found backend user session:', meData.email);
          }
        } catch (e) {
          console.warn('Backend session check failed:', e);
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

  function updateUserProfileDropdown(user, isAdmin) {
    if (!user || isAdmin) {
      const existing = document.getElementById("userProfileDropdownNavItem");
      if (existing) existing.remove();
      
      const existingLogout = document.getElementById("standaloneLogoutNavItem");
      if (existingLogout) existingLogout.remove();
      
      // Restore standard links
      const cartLink = document.querySelector('a[href="cart.html"]');
      const ordersLinks = document.querySelectorAll('a[href^="orders.html"]');
      const profileLink = document.querySelector('a[href="profile.html"]');
      if (!isAdmin) {
        if (cartLink) {
          const li = cartLink.closest('li');
          if (li) li.classList.remove('d-none');
        }
        ordersLinks.forEach(link => {
          if (link) {
            const li = link.closest('li');
            if (li) li.classList.remove('d-none');
          }
        });
        if (profileLink) {
          const li = profileLink.closest('li');
          if (li) li.classList.remove('d-none');
        }
      }
      return;
    }

    // Show standard Cart and Orders links when logged in
    const cartLink = document.querySelector('a[href="cart.html"]');
    const activeOrdersLink = document.querySelector('a[href="orders.html"]');
    if (cartLink) {
      const li = cartLink.closest('li');
      if (li) li.classList.remove('d-none');
    }
    if (activeOrdersLink) {
      const li = activeOrdersLink.closest('li');
      if (li) li.classList.remove('d-none');
    }

    // Hide top-level duplicate/redundant nav links to avoid duplication
    const profileLink = document.querySelector('a[href="profile.html"]');
    const historyLink = document.querySelector('a[href="orders.html?history=true"]');
    const logoutContainer = document.getElementById("logoutContainer");
    if (profileLink) {
      const li = profileLink.closest('li');
      if (li) li.classList.add('d-none');
    }
    if (historyLink) {
      const li = historyLink.closest('li');
      if (li) li.classList.add('d-none');
    }
    if (logoutContainer) logoutContainer.classList.add('d-none');

    const displayName = user.displayName || user.email.split("@")[0];
    const avatarUrl = user.profileImage || localStorage.getItem('profileImage') || '';

    let userDropdownLi = document.getElementById("userProfileDropdownNavItem");
    if (!userDropdownLi) {
      const navUl = document.querySelector("#navbarNav ul.navbar-nav");
      if (navUl) {
        userDropdownLi = document.createElement("li");
        userDropdownLi.className = "nav-item dropdown ms-lg-3 mt-2 mt-lg-0";
        userDropdownLi.id = "userProfileDropdownNavItem";
        navUl.appendChild(userDropdownLi);
      }
    }

    if (userDropdownLi) {
      const initialLetter = displayName ? displayName[0].toUpperCase() : 'U';
      userDropdownLi.innerHTML = `
        <a class="nav-link dropdown-toggle d-flex align-items-center p-0" href="#" id="userNavbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="transition: all 0.3s ease; border: none; background: none;">
          <div class="user-nav-avatar-wrapper">
            <div class="user-nav-avatar-container">
              ${avatarUrl ? 
                `<img src="${avatarUrl}" class="rounded-circle" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.outerHTML='<div class=\\'rounded-circle d-flex align-items-center justify-content-center text-dark fw-bold\\' style=\\'width: 100%; height: 100%; background: var(--grad-gold); font-size: 0.85rem; font-family: var(--font-serif);\\'>${initialLetter}</div>'">` :
                `<div class="rounded-circle d-flex align-items-center justify-content-center text-dark fw-bold" style="width: 100%; height: 100%; background: var(--grad-gold); font-size: 0.85rem; font-family: var(--font-serif);">${initialLetter}</div>`
              }
            </div>
          </div>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow-lg py-2 user-profile-dropdown-menu" aria-labelledby="userNavbarDropdown" style="min-width: 200px; margin-top: 10px;">
          <li class="px-3 py-2 mb-2 border-bottom" style="border-color: rgba(226, 201, 126, 0.15) !important; background: rgba(226, 201, 126, 0.03);">
            <div class="text-muted d-flex align-items-center" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">
              <span class="status-pulse-dot"></span>
              Signed in as
            </div>
            <div class="fw-bold text-white small text-truncate" style="max-width: 160px; font-family: var(--font-serif); color: var(--gold-light) !important; font-size: 0.95rem;">${displayName}</div>
          </li>
          <li>
            <a class="dropdown-item py-2 px-3 d-flex align-items-center gap-2" href="profile.html">
              <span>👤</span> My Profile
            </a>
          </li>
          <li>
            <a class="dropdown-item py-2 px-3 d-flex align-items-center gap-2" href="orders.html?history=true">
              <span>📜</span> Order History
            </a>
          </li>
        </ul>
      `;
    }

    // Append standard logout link to navbar
    let userLogoutLi = document.getElementById("standaloneLogoutNavItem");
    if (!userLogoutLi) {
      const navUl = document.querySelector("#navbarNav ul.navbar-nav");
      if (navUl) {
        userLogoutLi = document.createElement("li");
        userLogoutLi.className = "nav-item ms-lg-2 mt-2 mt-lg-0";
        userLogoutLi.id = "standaloneLogoutNavItem";
        navUl.appendChild(userLogoutLi);
      }
    }
    if (userLogoutLi) {
      userLogoutLi.innerHTML = `<a class="nav-link" href="#" id="dropdownLogoutBtn" style="font-weight: 600;">Logout</a>`;
      const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");
      if (dropdownLogoutBtn) {
        dropdownLogoutBtn.onclick = async (e) => {
          e.preventDefault();
          const legacyBtn = document.getElementById("logoutBtn");
          if (legacyBtn) {
            legacyBtn.click();
          }
        };
      }
    }
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
      updateUserProfileDropdown(null, true);
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
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          console.log('🚪 Admin logout clicked');
          try {
            // Clear backend session cookie
            const fetchFn = window.fetchWithFallback || fetch;
            const logoutEndpoint = window.fetchWithFallback ? '/auth/logout' : `${API}/auth/logout`;
            await fetchFn(logoutEndpoint, { method: 'POST', credentials: 'include' });
          } catch (e) {
            console.warn('Backend logout failed (admin):', e);
          }
          localStorage.removeItem('localAdmin');
          localStorage.removeItem('localAdminEmail');
          localStorage.removeItem('authToken');
          localStorage.removeItem('firebaseIdToken');
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
      updateUserProfileDropdown(user, false);
      if (loginBtn) {
        loginBtn.classList.add("d-none");
      }
      if (logoutContainer) {
        logoutContainer.classList.add("d-none"); // Hidden legacy logout
      }
      if (userNameDisplay) {
        userNameDisplay.classList.add("d-none"); // Hidden legacy user text
      }

      // Inject notification bell into navbar
      let notifLi = document.getElementById("notificationNavItem");
      if (!notifLi) {
        const navUl = document.querySelector("#navbarNav ul.navbar-nav");
        if (navUl) {
          notifLi = document.createElement("li");
          notifLi.className = "nav-item dropdown ms-lg-2";
          notifLi.id = "notificationNavItem";
          notifLi.innerHTML = `
            <a class="nav-link dropdown-toggle position-relative d-flex align-items-center" href="#" id="notificationDropdownBtn" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="padding-right: 0.5rem !important;">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-bell-fill text-secondary" viewBox="0 0 16 16">
                <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2m.995-14.901a1 1 0 1 0-1.99 0A5 5 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901"/>
              </svg>
              <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" id="notificationBadge" style="font-size: 0.65rem; padding: 0.2em 0.45em; transform: translate(-20%, 20%) !important;">
                0
              </span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end shadow-lg py-2 border-light notification-dropdown-menu" aria-labelledby="notificationDropdownBtn" style="width: 320px; max-height: 400px; overflow-y: auto; right: 0; left: auto; border-radius: var(--radius-md);">
              <li class="dropdown-header border-bottom pb-2 d-flex justify-content-between align-items-center">
                <span class="fw-bold text-primary">Notifications</span>
                <button class="btn btn-link btn-xs text-primary p-0 text-decoration-none fw-semibold" id="markAllReadBtn" style="font-size: 0.75rem;">Mark all as read</button>
              </li>
              <div id="notificationsContainer" class="py-1">
                <li class="text-center py-3 text-muted small">Loading notifications...</li>
              </div>
            </ul>
          `;
          const userDisplayLi = document.getElementById("userNameDisplay");
          if (userDisplayLi) {
            navUl.insertBefore(notifLi, userDisplayLi);
          } else {
            navUl.appendChild(notifLi);
          }

          const markReadBtn = document.getElementById("markAllReadBtn");
          if (markReadBtn) {
            markReadBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              markAllNotificationsRead();
            });
          }
        }
      }

      fetchAndRenderNotifications();
      if (!notifInterval) {
        notifInterval = setInterval(fetchAndRenderNotifications, 30000);
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
      updateUserProfileDropdown(null, false);
      
      // Hide all standard user menu items when logged out (show only Home and Login)
      const cartLink = document.querySelector('a[href="cart.html"]');
      const profileLink = document.querySelector('a[href="profile.html"]');
      const ordersLinks = document.querySelectorAll('a[href^="orders.html"]');
      const adminLink = document.querySelector('a[href="admin.html"]');
      
      if (cartLink) {
        const li = cartLink.closest('li');
        if (li) li.classList.add('d-none');
      }
      if (profileLink) {
        const li = profileLink.closest('li');
        if (li) li.classList.add('d-none');
      }
      ordersLinks.forEach(link => {
        if (link) {
          const li = link.closest('li');
          if (li) li.classList.add('d-none');
        }
      });
      if (adminLink) {
        const li = adminLink.closest('li');
        if (li) li.classList.add('d-none');
      }

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
      
      // Cleanup notifications
      if (notifInterval) {
        clearInterval(notifInterval);
        notifInterval = null;
      }
      const notifLi = document.getElementById("notificationNavItem");
      if (notifLi) notifLi.remove();
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

  // Listen for custom profile update events to dynamically refresh greeting
  document.addEventListener("profileUpdated", (e) => {
    const newName = e.detail && e.detail.name;
    const newAvatar = e.detail && e.detail.profileImage;
    if (newAvatar) localStorage.setItem('profileImage', newAvatar);
    else localStorage.removeItem('profileImage');
    
    // Dynamically refresh the professional profile dropdown
    updateUserProfileDropdown({ displayName: newName, profileImage: newAvatar }, false);
  });

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

// Shared frontend logic: auth state, cart indicator, and helpers
// Backend API base — dynamic: use localhost during local dev, otherwise expect backend
// to be served from the same origin under /api (update if you host backend elsewhere)
const API = (function () {
  let host = window.location.hostname;
  let protocol = location.protocol;
  if (protocol === "file:" || !host) {
    host = "localhost";
    protocol = "http:";
  }
  if (host === "localhost" || host.startsWith("127."))
    return `${protocol}//${host}:5001/api`;
  return "/api";
})();

// Wrapper that prefers window.fetchWithFallback if available, else falls back to standard fetch.
async function apiFetch(path, opts = {}) {
  if (window.fetchWithFallback && typeof window.fetchWithFallback === "function") {
    try {
      return await window.fetchWithFallback(path, opts);
    } catch (e) {
      console.warn("fetchWithFallback failed, falling back to fetch:", e);
    }
  }
  const url = path.startsWith("http") ? path : `${API}${path}`;
  return fetch(url, opts);
}
async function getMe() {
  try {
    const res = await apiFetch(`/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function normalizeImageUrl(src) {
  if (!src) return "image.png";
  try {
    let path = src;
    const m = src.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)$/i);
    if (m && m[3]) {
      path = m[3];
    }
    
    // Dynamic uploads route to backend
    if (path.startsWith('/uploads/') || path.startsWith('uploads/')) {
      let relativePath = path;
      if (!relativePath.startsWith('/')) {
        relativePath = '/' + relativePath;
      }
      let host = window.location.hostname;
      let protocol = window.location.protocol;
      if (protocol === "file:" || !host) {
        host = "localhost";
        protocol = "http:";
      }
      if (host !== "localhost" && !host.startsWith("127.")) {
        return relativePath; // relative for production rewrites
      }
      const port = window.detectedPort || 5001;
      return `${protocol}//${host}:${port}${relativePath}`;
    }
    
    // Static frontend assets served locally
    if (path.startsWith('/images/') || path.startsWith('images/')) {
      let rel = path.startsWith('/') ? path.substring(1) : path;
      return rel; // Return relative path so it resolves relative to the current HTML file
    }
    
    return src;
  } catch (e) {
    return src;
  }
}

async function getCartCount() {
  try {
    // Get auth token from localStorage if cookies don't work
    const token = localStorage.getItem('authToken');
    const headers = token ? { 'x-auth-token': token } : {};
    
    const res = await apiFetch(`/cart`, { 
      credentials: "include",
      headers: headers
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
  } catch (e) {
    console.error('getCartCount error:', e);
    return 0;
  }
}

// Utility function left blank (removed legacy handlers)

// Simple toast helper using Bootstrap Toast
function showToast(message, variant = "primary") {
  try {
    const body = document.getElementById("appToastBody");
    const toastEl = document.getElementById("appToast");
    if (!toastEl || !body) return;
    toastEl.className = `toast align-items-center text-bg-${variant} border-0`;
    body.textContent = message;
    const bsToast = new bootstrap.Toast(toastEl);
    bsToast.show();
  } catch (e) {
    console.warn("Toast show failed", e);
  }
}

// ---------------------- Firebase-powered product & cart helpers ----------------------
function getUid() {
  // Prefer authenticated user's uid, otherwise use a stable guest id stored in localStorage
  try {
    const auth = window.firebaseAuth;
    if (auth && auth.currentUser && auth.currentUser.uid)
      return auth.currentUser.uid;
  } catch (e) {
    /* ignore */
  }
  let gid = localStorage.getItem("guestId");
  if (!gid) {
    gid = `guest_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`;
    localStorage.setItem("guestId", gid);
  }
  return gid;
}

function renderProductCard(p) {
  const wrapper = document.createElement("div");
  wrapper.className = "product-card-wrapper";
  wrapper.innerHTML = `
    <div class="card h-100 product-card-clickable" data-id="${p.id}" style="cursor: pointer;">
      <img src="${
        normalizeImageUrl(p.image) || "image.png"
      }" class="card-img-top" alt="${p.name || "Product"}" loading="lazy">
      <div class="card-body d-flex flex-column">
        <h5 class="card-title">${p.name || "Unnamed"}</h5>
        <p class="card-text price">${p.price ? "₹" + p.price : ""}</p>
        <div class="mt-auto d-flex gap-2 justify-content-center">
          <button class="btn btn-sm btn-outline-primary qv-btn" data-id="${
            p.id
          }">Quick View</button>
          <button class="btn btn-sm btn-success add-cart-btn" data-id="${
            p.id
          }">Add to Cart</button>
        </div>
      </div>
    </div>`;
  return wrapper;
}

let cachedProducts = null;
let currentMetalFilter = null;

async function loadProducts(filterMetal = null) {
  const container = document.getElementById("productsRow");
  if (!container) return;

  // Track the active metal filter
  currentMetalFilter = filterMetal;

  // Show loading indicator only on first fetch
  if (!cachedProducts) {
    container.innerHTML = '<div class="text-center py-5"><div class="loader" aria-hidden="true"></div><div class="mt-2 text-muted">Loading products…</div></div>';
    try {
      let products = [];
      try {
        const res = await apiFetch(`/products`);
        if (res && res.ok) {
          const data = await res.json();
          // ensure each product has an id field (Mongo returns _id)
          products = Array.isArray(data)
            ? data.map((p) => ({ id: p._id || p.id, ...p }))
            : [];
        }
      } catch (e) {
        console.warn("Backend products fetch failed", e);
      }
      cachedProducts = products || [];
    } catch (err) {
      console.error("loadProducts fetch error", err);
      container.innerHTML = '<div class="text-center text-danger">Failed to load products.</div>';
      return;
    }
  }

  renderFilteredProducts();
}

// Global clear helper exposed to HTML onClick
window.clearMetalFilter = function() {
  loadProducts(null);
};

function renderFilteredProducts() {
  const container = document.getElementById("productsRow");
  if (!container || !cachedProducts) return;

  const searchInput = document.getElementById("search");
  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";

  // Update DOM active filter indicators
  const filterIndicator = document.getElementById("activeFilterIndicator");
  const filterName = document.getElementById("activeFilterName");
  if (filterIndicator && filterName) {
    if (currentMetalFilter) {
      filterName.textContent = currentMetalFilter.charAt(0).toUpperCase() + currentMetalFilter.slice(1);
      filterIndicator.style.display = "inline-block";
      const catalogSub = document.querySelector("#catalog .catalog-header h2");
      if (catalogSub) catalogSub.textContent = `${currentMetalFilter.charAt(0).toUpperCase() + currentMetalFilter.slice(1)} Jewellery`;
    } else {
      filterIndicator.style.display = "none";
      const catalogSub = document.querySelector("#catalog .catalog-header h2");
      if (catalogSub) catalogSub.textContent = "All Jewellery";
    }
  }

  let products = [...cachedProducts];

  // 1. Filter by metal type if specified
  if (currentMetalFilter) {
    const filterLower = currentMetalFilter.toLowerCase().trim();
    products = products.filter((p) => {
      const productMetal = (p.metal || '').toLowerCase().trim();
      return productMetal === filterLower;
    });
  }

  // 2. Filter by search query if specified
  if (searchQuery) {
    products = products.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const metal = (p.metal || '').toLowerCase();
      return name.includes(searchQuery) || desc.includes(searchQuery) || cat.includes(searchQuery) || metal.includes(searchQuery);
    });
  }

  container.innerHTML = ""; // clear container

  if (products.length === 0) {
    const message = currentMetalFilter 
      ? `No ${currentMetalFilter} products match your search.` 
      : 'No products match your search.';
    container.innerHTML = `<div class="text-center text-muted py-5">${message}</div>`;
    return;
  }

  products.forEach((p, i) => {
    const el = renderProductCard(p);
    el.classList.add('product-fade-in');
    el.style.animationDelay = `${i * 0.05}s`;
    container.appendChild(el);
  });

  // Attach click handlers for add-to-cart and quick view
  container.querySelectorAll(".add-cart-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = btn.getAttribute("data-id");
      btn.disabled = true;
      try {
        const res = await addToCartById(id, 1);
        const count = Array.isArray(res.items)
          ? res.items.reduce((s, i) => s + (i.quantity || 0), 0)
          : 0;
        document
          .querySelectorAll(".cart-count")
          .forEach((el) => (el.textContent = count > 0 ? `(${count})` : ""));
        showToast("Added to cart", "success");
        btn.classList.remove("btn-success");
        btn.classList.add("btn-outline-success");
        btn.textContent = "Added";
      } catch (err) {
        console.error("Add to cart failed", err);
        showToast("Could not add to cart", "danger");
      } finally {
        btn.disabled = false;
        setTimeout(() => {
          btn.classList.remove("btn-outline-success");
          btn.classList.add("btn-success");
          btn.textContent = "Add to Cart";
        }, 1200);
      }
    });
  });

  // Quick view triggers on card click
  container.querySelectorAll(".product-card-clickable").forEach((card) => {
    card.addEventListener("click", async (e) => {
      // Avoid opening Quick View if user clicks the Add to Cart button
      if (e.target.closest(".add-cart-btn")) return;
      
      const id = card.getAttribute("data-id");
      try {
        const prod = cachedProducts.find(p => p.id === id);
        if (!prod) return alert("Product not found");
        const qvTitle = document.getElementById("qvTitle");
        const qvImg = document.getElementById("qvImg");
        const qvPrice = document.getElementById("qvPrice");
        const qvDesc = document.getElementById("qvDesc");
        const qvMeta = document.getElementById("qvMeta");
        if (qvTitle) qvTitle.textContent = prod.name || "Product";
        if (qvImg) qvImg.src = normalizeImageUrl(prod.image) || "image.png";
        if (qvPrice) qvPrice.textContent = prod.price ? "₹" + prod.price : "";
        if (qvDesc) qvDesc.textContent = prod.description || "";
        if (qvMeta) qvMeta.textContent = prod.category || "";
        
        const modalEl = document.getElementById("quickViewModal");
        if (modalEl) {
          const modal = new bootstrap.Modal(modalEl);
          modal.show();
          const qvAdd = document.getElementById("qvAddBtn");
          if (qvAdd) qvAdd.setAttribute("data-id", id);
          const qvView = document.getElementById("qvViewBtn");
          if (qvView) {
            qvView.setAttribute("href", `product.html?id=${encodeURIComponent(id)}`);
            qvView.setAttribute("role", "link");
          }
        }
      } catch (err) {
        console.error("Quick view failed", err);
      }
    });
  });
}

// Update cart count UI - now using backend API only for consistency
async function updateCartCountUI() {
  try {
    // NOTE: Removed Firestore-first logic to ensure consistency with cart.html
    const count = await getCartCount(); // getCartCount() hits the backend
    document
      .querySelectorAll(".cart-count")
      .forEach((el) => (el.textContent = count > 0 ? `(${count})` : ""));
  } catch (e) {
    console.warn("Failed to update cart count from backend", e);
  }
}

// Universal add-to-cart - now using backend API only for consistency
async function addToCartById(productId, quantity = 1) {
  console.log('🛒 Adding to cart via Backend API:', productId, 'qty:', quantity);
  // NOTE: Removed Firestore-first logic to ensure consistency with cart.html

  // Use backend API
  try {
    // --- FIX: send ALL available auth credentials so backend always sees the same set
    const authToken = localStorage.getItem('authToken');
    const firebaseToken = localStorage.getItem('firebaseIdToken');
    // Use getUid() to ensure a guestId is created if one doesn't exist
    const guestId = localStorage.getItem('guestId') || getUid();
    const headers = { "Content-Type": "application/json" };
    if (authToken) {
      headers['x-auth-token'] = authToken;
      console.log('📝 Sending JWT token');
    }
    if (firebaseToken) {
      headers['Authorization'] = `Bearer ${firebaseToken}`;
      console.log('📝 Sending Firebase token');
    }
    if (guestId) {
      headers['x-guest-id'] = guestId;
      console.log('📝 Sending guestId');
    }
    
    const body = { productId, quantity };
    if (guestId) body.guestId = guestId;
    
    const res = await apiFetch(`/cart/add`, {
      method: "POST",
      credentials: "include",
      headers: headers,
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('Backend cart add failed:', res.status, errData);
      throw new Error(errData.error || "Backend cart add failed");
    }
    
    const data = await res.json();
    console.log('✅ Cart add successful (Backend API)');
    
    const items =
      data.items && Array.isArray(data.items)
        ? data.items.map((it) => ({
            productId: it.product._id || it.product,
            quantity: it.quantity,
          }))
        : data.cart && data.cart.items
        ? data.cart.items.map((it) => ({
            productId: it.product._id || it.product,
            quantity: it.quantity,
          }))
        : [];
    return { items };

  } catch (e) {
    console.warn("Backend cart add failed, falling back to localStorage guest cart", e);
    // Guest fallback: localStorage cart (last resort)
    console.log('💾 Using guest cart (localStorage)');
    let guest = JSON.parse(localStorage.getItem("guestCart") || "{}");
    guest.items = guest.items || [];
    const idx = guest.items.findIndex((i) => i.productId === productId);
    if (idx > -1)
      guest.items[idx].quantity = (guest.items[idx].quantity || 0) + quantity;
    else guest.items.push({ productId, quantity });
    localStorage.setItem("guestCart", JSON.stringify(guest));
    return { items: guest.items };
  }
}

// Auto-load products on DOM ready if products container exists
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("productsRow")) {
    loadProducts();
    const searchInput = document.getElementById("search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderFilteredProducts();
      });
    }
  }

  // Quick View Add to Cart button wiring (globally once on DOM ready)
  const qvAddBtn = document.getElementById("qvAddBtn");
  if (qvAddBtn) {
    qvAddBtn.addEventListener("click", async () => {
      const pid = qvAddBtn.getAttribute("data-id");
      if (!pid) return showToast("No product selected", "warning");
      qvAddBtn.disabled = true;
      try {
        const res = await addToCartById(pid, 1);
        const count = Array.isArray(res.items)
          ? res.items.reduce((s, i) => s + (i.quantity || 0), 0)
          : 0;
        document
          .querySelectorAll(".cart-count")
          .forEach((el) => (el.textContent = count > 0 ? `(${count})` : ""));
        showToast("Added to cart", "success");
        
        // Close the modal upon successful addition
        const modalEl = document.getElementById("quickViewModal");
        if (modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) {
            modal.hide();
          } else {
            // Fallback: hide using bootstrap class or query
            const bsModal = new bootstrap.Modal(modalEl);
            bsModal.hide();
          }
        }
      } catch (err) {
        console.error("QV add failed", err);
        showToast("Could not add to cart", "danger");
      } finally {
        qvAddBtn.disabled = false;
      }
    });
  }

  // Fix static images served on default ports or paths
  document.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && (src.includes("127.0.0.1:5001") || src.includes("localhost:5001") || src.startsWith("/images/") || src.startsWith("images/") || src.startsWith("/uploads/") || src.startsWith("uploads/"))) {
      img.src = normalizeImageUrl(src);
    }
  });
});

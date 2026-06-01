// API Helper with automatic port fallback
// Handles backend port switching between 5001, 5002, 50011, etc.

const API_PORTS = [5001, 5002, 50011, 50012];
let detectedPort = localStorage.getItem('detectedPort') || sessionStorage.getItem('detectedPort') || null;

/**
 * Perform a fetch with automatic port fallback
 * @param {string} endpoint - The API endpoint (e.g., '/auth/login')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithFallback(endpoint, options = {}) {
  let host = window.location.hostname;
  let protocol = location.protocol;

  // Handle local file access (file://)
  if (protocol === "file:" || !host) {
    host = "localhost";
    protocol = "http:";
  }

  // If not local host (localhost or 127.*), skip probing ports and use configured API
  if (host !== "localhost" && !host.startsWith("127.")) {
    const apiBase = window.API || "/api";
    const url = apiBase.endsWith('/') ? apiBase.slice(0, -1) + endpoint : apiBase + endpoint;
    return fetch(url, options);
  }
  
  // Try detected port first
  if (detectedPort) {
    const url = `${protocol}//${host}:${detectedPort}/api${endpoint}`;
    try {
      console.log(`🔗 Trying cached port ${detectedPort}: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok || res.status === 401 || res.status === 404 || res.status === 400) {
        window.detectedPort = detectedPort;
        return res;
      }
    } catch (e) {
      console.warn(`⚠️  Cached port ${detectedPort} failed, invalidating cache...`);
      detectedPort = null;
      window.detectedPort = null;
      localStorage.removeItem('detectedPort');
      sessionStorage.removeItem('detectedPort');
    }
  }
  
  // Parallel Probing: Try all ports concurrently to find the active one instantly
  console.log(`🔍 Probing ports ${API_PORTS.join(', ')} in parallel...`);
  const probePort = (port) => new Promise(async (resolve, reject) => {
    const url = `${protocol}//${host}:${port}/api/products`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    try {
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || res.status === 401 || res.status === 404 || res.status === 400 || res.status === 403) {
        resolve(port);
      } else {
        reject(new Error(`Status ${res.status}`));
      }
    } catch (err) {
      clearTimeout(timeoutId);
      reject(err);
    }
  });

  try {
    const winningPort = await Promise.any(API_PORTS.map(probePort));
    console.log(`✅ Backend detected on port ${winningPort}`);
    detectedPort = winningPort;
    window.detectedPort = winningPort;
    localStorage.setItem('detectedPort', winningPort);
    sessionStorage.setItem('detectedPort', winningPort);
    
    const url = `${protocol}//${host}:${detectedPort}/api${endpoint}`;
    return fetch(url, options);
  } catch (e) {
    console.warn('⚠️ All ports failed parallel probe, using fallback default API');
  }
  
  // Fallback to default API
  const url = (window.API && !window.API.startsWith('/') ? window.API : `${protocol}//${host}:5001/api`) + endpoint;
  return fetch(url, options);
}

// Expose globally
window.fetchWithFallback = fetchWithFallback;

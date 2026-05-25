// API Helper with automatic port fallback
// Handles backend port switching between 5001, 5002, 50011, etc.

const API_PORTS = [5001, 5002, 50011, 50012];
let detectedPort = null;

/**
 * Perform a fetch with automatic port fallback
 * @param {string} endpoint - The API endpoint (e.g., '/auth/login')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithFallback(endpoint, options = {}) {
  const host = window.location.hostname;

  // If not local host (localhost or 127.*), skip probing ports and use configured API
  if (host !== "localhost" && !host.startsWith("127.")) {
    const url = (window.API || `${location.protocol}//${location.hostname}:5001/api`) + endpoint;
    return fetch(url, options);
  }
  
  // Try detected port first
  if (detectedPort) {
    const url = `${location.protocol}//${host}:${detectedPort}/api${endpoint}`;
    try {
      console.log(`🔗 Trying detected port ${detectedPort}: ${url}`);
      const res = await fetch(url, { ...options, timeout: 3000 });
      if (res.ok || res.status === 401 || res.status === 404 || res.status === 400) {
        console.log(`✅ Using port ${detectedPort}`);
        return res;
      }
    } catch (e) {
      console.warn(`⚠️  Port ${detectedPort} failed, trying others...`);
      detectedPort = null;
    }
  }
  
  // Try each port
  for (const port of API_PORTS) {
    const url = `${location.protocol}//${host}:${port}/api${endpoint}`;
    try {
      console.log(`🔗 Trying port ${port}: ${url}`);
      const res = await fetch(url, options);
      
      // Consider 404, 401, 400 as valid responses (endpoint exists but auth/validation failed)
      if (res.ok || res.status === 401 || res.status === 404 || res.status === 400) {
        detectedPort = port;
        console.log(`✅ Backend detected on port ${port}`);
        return res;
      }
    } catch (e) {
      console.warn(`⚠️  Port ${port} not responding`);
      continue;
    }
  }
  
  // Fallback to default API
  console.warn('⚠️  All ports failed, using default API');
  const url = (window.API || `${location.protocol}//${location.hostname}:5001/api`) + endpoint;
  return fetch(url, options);
}

// Expose globally
window.fetchWithFallback = fetchWithFallback;

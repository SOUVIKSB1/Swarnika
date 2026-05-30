// Simple frontend config for API base
// Exports `API` string chosen based on current hostname.

// Helper function to detect which port the backend is running on
async function detectBackendPort() {
  if (typeof window === "undefined") return 5001; // default for SSR
  
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    return null; // Not local, skip detection
  }
  
  // Try ports in order
  const ports = [5001, 50011];
  for (const port of ports) {
    try {
      const res = await fetch(`http://localhost:${port}/api/products`, {
        method: 'HEAD',
        credentials: 'include'
      });
      if (res.ok || res.status === 401 || res.status === 403) {
        console.log(`✅ Backend detected on port ${port}`);
        return port;
      }
    } catch (e) {
      // Port not responding, try next
      continue;
    }
  }
  
  console.warn('⚠️  Could not detect backend port, using default 5001');
  return 5001;
}

export const API = (function () {
  let host = window.location.hostname;
  let protocol = location.protocol;

  if (protocol === "file:" || !host) {
    host = "localhost";
    protocol = "http:";
  }

  // Local development: use current hostname and backend port 5001
  if (host === "localhost" || host.startsWith("127.")) {
    const localAPI = `${protocol}//${host}:5001/api`;
    console.log("🏠 Development mode - Local API:", localAPI);
    return localAPI;
  }

  // Hosted environments: backend is expected under same origin at /api
  if (host.includes("web.app") || host.includes("firebaseapp.com")) {
    const productionAPI = "/api";
    console.log("🌐 Firebase Hosting mode - Using:", productionAPI);
    return productionAPI;
  }

  // Default: same-origin API
  return "/api";
})();

// Expose globally for scripts that need it
if (typeof window !== "undefined") {
  window.API = API;
}

const API_BASE_URL = "https://swarnika.onrender.com";
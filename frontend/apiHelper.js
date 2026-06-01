// API Helper with direct URL mapping
// Maps endpoints to the dynamically resolved window.API base

/**
 * Perform a fetch to the detected API base
 * @param {string} endpoint - The API endpoint (e.g., '/auth/login')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithFallback(endpoint, options = {}) {
  const apiBase = window.API || "/api";
  const url = apiBase.endsWith('/') ? apiBase.slice(0, -1) + endpoint : apiBase + endpoint;
  return fetch(url, options);
}

// Expose globally
window.fetchWithFallback = fetchWithFallback;

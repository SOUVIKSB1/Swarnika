// Firebase Auth Helper for Backend API Calls
// This file provides a helper to make authenticated API calls with Firebase ID tokens

(function() {
  console.log('🔧 authHelper.js loading...');
  
  // Wait for Firebase Auth to be available
  function waitForFirebase(callback, maxAttempts = 50) {
    let attempts = 0;
    const checkFirebase = setInterval(() => {
      attempts++;
      if (window.firebaseAuth) {
        clearInterval(checkFirebase);
        console.log('✅ Firebase Auth available, initializing authHelper');
        callback();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkFirebase);
        console.warn('⚠️ Firebase Auth not available after', maxAttempts, 'attempts');
      }
    }, 100);
  }
  
  // Get the current Firebase ID token
  async function getIdToken() {
    if (!window.firebaseAuth) {
      console.warn('⚠️ Firebase Auth not initialized');
      return null;
    }
    
    const user = window.firebaseAuth.currentUser;
    if (!user) {
      console.warn('⚠️ No user logged in');
      return null;
    }
    
    try {
      const token = await user.getIdToken();
      console.log('✅ Firebase ID token obtained');
      return token;
    } catch (error) {
      console.error('❌ Failed to get ID token:', error);
      return null;
    }
  }

  // Make an authenticated fetch request with Firebase ID token
  async function authFetch(url, options = {}) {
    console.log('🔐 authFetch called for:', url);
    const token = await getIdToken();
    
    // Merge headers
    const headers = {
      ...options.headers,
    };
    
    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('✅ Authorization header added');
    } else {
      console.warn('⚠️ No Firebase token available for request');
    }
    
    // Make the request
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Still send cookies if any
    });
  }

  // Initialize and expose globally
  function init() {
    if (typeof window !== 'undefined') {
      window.authFetch = authFetch;
      window.getFirebaseIdToken = getIdToken;
      console.log('✅ authFetch available globally');
    }
  }
  
  // Wait for Firebase then initialize
  waitForFirebase(init);
})();

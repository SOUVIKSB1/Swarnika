// Firebase initializer for Swarnika project
// This file is a module and exposes the initialized app/analytics both via
// exports and as properties on window so non-module scripts can access them.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDy-pe6Qas9LtLsRedK2-vAzV03ch7eJ4Q",
  authDomain: "swarnika-c2451.firebaseapp.com",
  projectId: "swarnika-c2451",
  storageBucket: "swarnika-c2451.firebasestorage.app",
  messagingSenderId: "465561689153",
  appId: "1:465561689153:web:cb42f23447a90ab7af3ac0",
  measurementId: "G-L52LK0V2GZ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics may throw in some environments (e.g., when not on https or in certain dev servers)
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  // Not critical — app can still use other Firebase services
  console.warn("Firebase analytics not initialized:", err);
}

// Initialize Auth and Firestore
let auth = null;
let db = null;
try {
  auth = getAuth(app);
} catch (err) {
  console.warn("Firebase Auth not initialized:", err);
}

try {
  db = getFirestore(app);
} catch (err) {
  console.warn("Firestore not initialized:", err);
}

// Expose for non-module scripts that rely on window-scoped globals
if (typeof window !== "undefined") {
  window.firebaseApp = app;
  window.firebaseAnalytics = analytics;
  window.firebaseAuth = auth;
  window.firebaseDB = db;
}

// Named exports for module consumers
export { app, analytics, auth, db };

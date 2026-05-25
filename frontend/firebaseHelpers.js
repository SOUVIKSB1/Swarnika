// Firestore helper utilities for Swarnika
// This module provides small helpers for product listing and cart operations.
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

async function fetchProducts() {
  if (!db) return [];
  try {
    const col = collection(db, "products");
    const snap = await getDocs(col);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("fetchProducts error", err);
    return [];
  }
}

async function getProduct(productId) {
  if (!db || !productId) return null;
  try {
    const ref = doc(db, "products", productId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error("getProduct error", err);
    return null;
  }
}

// addToCart: store a simple per-user cart document under 'carts/{uid}'
// items: [{ productId, quantity }]
async function addToCart(uid, productId, quantity = 1) {
  if (!db || !uid || !productId) throw new Error("uid and productId required");
  try {
    const cartRef = doc(db, "carts", uid);
    const cartSnap = await getDoc(cartRef);
    if (!cartSnap.exists()) {
      const items = [{ productId, quantity }];
      await setDoc(cartRef, { items, updatedAt: serverTimestamp() });
      return { items };
    }

    const data = cartSnap.data() || {};
    const items = Array.isArray(data.items) ? data.items.slice() : [];
    const idx = items.findIndex((i) => i.productId === productId);
    if (idx > -1) {
      items[idx].quantity = (items[idx].quantity || 0) + quantity;
    } else {
      items.push({ productId, quantity });
    }
    await setDoc(
      cartRef,
      { items, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { items };
  } catch (err) {
    console.error("addToCart error", err);
    throw err;
  }
}
async function getCart(uid) {
  if (!db || !uid) return { items: [] };
  try {
    const cartRef = doc(db, "carts", uid);
    const snap = await getDoc(cartRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : { items: [] };
  } catch (err) {
    console.error("getCart error", err);
    return { items: [] };
  }
}
// Expose helpers to non-module scripts and export for modules
if (typeof window !== "undefined") {
  window.firebaseHelpers = { fetchProducts, getProduct, addToCart, getCart };
}

export { fetchProducts, getProduct, addToCart, getCart };

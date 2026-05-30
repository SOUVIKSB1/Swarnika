/*
  Migration script: copy products from MongoDB (products collection) into
  Firestore 'products' collection.

  Usage:
    1. Create a Firebase service account JSON and set GOOGLE_APPLICATION_CREDENTIALS to its path.
       See: https://firebase.google.com/docs/admin/setup#initialize
    2. Ensure your .env has a valid MONGODB_URI and run:
         node migrateToFirestore.js

  Notes:
    - Documents will be written with the MongoDB _id as the Firestore document ID.
    - Images will be normalized to relative paths (strip http://localhost:5001 prefix) so
      they work when serving from Firebase Hosting.
*/

const admin = require("firebase-admin");
const dotenv = require("dotenv");
const connectDB = require("./db");
const Product = require("./models/Product");
const path = require("path");

dotenv.config();

async function main() {
  // Initialize Firebase Admin using service account cert directly (like server.js)
  try {
    const serviceAccount = require("./swarnika-c2451-firebase-adminsdk-fbsvc-93890fc9b6.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("🔥 Firebase Admin SDK initialized successfully");
  } catch (e) {
    console.error("Failed to initialize Firebase Admin:", e);
    process.exit(1);
  }

  const db = admin.firestore();

  // Clear existing products in Firestore first to avoid duplicates or old items remaining
  try {
    console.log("🧹 Clearing existing products collection in Firestore...");
    const productsCol = db.collection("products");
    const snapshot = await productsCol.get();
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Cleared ${snapshot.size} products from Firestore`);
    } else {
      console.log("ℹ️ Firestore products collection was already empty");
    }
  } catch (clearErr) {
    console.error("⚠️ Failed to clear Firestore products collection:", clearErr.message || clearErr);
  }


  await connectDB();

  const products = await Product.find({}).lean().exec();
  console.log(`Found ${products.length} products in MongoDB`);

  let count = 0;
  for (const p of products) {
    const id = p._id ? p._id.toString() : undefined;
    const docRef = id
      ? db.collection("products").doc(id)
      : db.collection("products").doc();

    // Normalize image paths (strip localhost backend prefixes)
    let image = p.image || "";
    if (typeof image === "string") {
      image = image.replace(/https?:\/\/localhost:5001/gi, "");
      image = image.replace(/https?:\/\/127\.0\.0\.1:5001/gi, "");
    }

    const payload = {
      name: p.name || "",
      price: p.price || 0,
      description: p.description || "",
      image: image || "",
      category: p.category || "",
      metal: p.metal || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await docRef.set(payload, { merge: true });
      count++;
      console.log(`Wrote product ${id || "<new>"} -> ${payload.name}`);
    } catch (wErr) {
      console.error(`Failed to write product ${id}:`, wErr.message || wErr);
    }
  }

  console.log(`Done. Wrote ${count} products to Firestore.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

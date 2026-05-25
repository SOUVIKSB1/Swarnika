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
  if (
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.FIREBASE_SERVICE_ACCOUNT
  ) {
    console.error(
      "ERROR: Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON path."
    );
    process.exit(1);
  }

  // Initialize Firebase Admin using application default credentials
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    console.error("Failed to initialize Firebase Admin:", e);
    process.exit(1);
  }

  const db = admin.firestore();

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

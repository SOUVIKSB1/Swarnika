const functions = require("firebase-functions");
const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const admin = require("firebase-admin");

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// MongoDB Connection
const connectDB = async () => {
  try {
    // Try environment variables first, then Firebase config (deprecated)
    const mongoUri = process.env.MONGO_URI || 
                     process.env.mongodb_uri ||
                     functions.config().mongo?.uri;
    if (!mongoUri) {
      console.error("❌ MONGO_URI is not set in environment or Firebase config");
      console.error("   Please set MONGO_URI environment variable for Cloud Functions");
      return;
    }
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();

// Create Express app
const app = express();
app.set("trust proxy", 1);

// Middleware
app.use(cookieParser());
app.use(express.json());

// CORS configuration
const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "https://swarnika-c2451.web.app",
  "https://swarnika-c2451.firebaseapp.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  exposedHeaders: ["set-cookie"]
}));

// Health check
app.get("/", (req, res) => {
  res.json({ 
    message: "Swarnika API - Firebase Cloud Functions",
    status: "running",
    timestamp: new Date().toISOString()
  });
});

// Import models (relative to backend directory structure)
const User = require("../backend/models/User");
const Product = require("../backend/models/Product");
const Cart = require("../backend/models/Cart");

// Import routes
const authRoutes = require("../backend/routes/auth");
const productRoutes = require("../backend/routes/products");
const cartRoutes = require("../backend/routes/cart");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./db");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const admin = require("firebase-admin");

dotenv.config();
connectDB();

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require("./swarnika-c2451-firebase-adminsdk-fbsvc-93890fc9b6.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("🔥 Firebase Admin SDK initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
}

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 4000;

// ✅ Middleware
app.use(cookieParser());
app.use(express.json());
// ✅ CORS configuration (before routes)
// Allowlist comes from environment variable ALLOWED_ORIGINS (comma-separated) for easy deployment
const defaultAllowed = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:5502",
  "http://localhost:5173", // if using Vite or React dev
  "https://swarnika-c2451.web.app", // Firebase Hosting production
  "https://swarnika-c2451.firebaseapp.com", // Firebase alternative domain
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultAllowed, ...envOrigins]));

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (curl, mobile apps, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.error("CORS blocked for origin:", origin);
      return callback(new Error("CORS blocked for origin: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  })
);

app.options("*", cors());

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ Backend is running correctly and ready for API calls!");
});

// ✅ Diagnostic endpoint (for debugging auth issues)
app.get("/api/debug/auth", (req, res) => {
  res.json({
    cookies: req.cookies || {},
    authorization: req.headers.authorization ? "✅ Present" : "❌ Missing",
    "x-auth-token": req.headers["x-auth-token"] ? "✅ Present" : "❌ Missing",
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
});

// ✅ Debug cart lookup: query by guestId or userId
app.get('/api/debug/cart', async (req, res) => {
  try {
    const Cart = require('./models/Cart');
    const { guestId, userId } = req.query;
    if (!guestId && !userId) return res.status(400).json({ error: 'Provide guestId or userId as query param' });
    const query = guestId ? { guestId } : { user: userId };
    const carts = await Cart.find(query).populate('items.product').lean();
    res.json({ count: carts.length, carts });
  } catch (err) {
    console.error('❌ /api/debug/cart error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ API routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

// ✅ Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/images", express.static(path.join(__dirname, "images")));

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err);
  res
    .status(500)
    .json({ error: "Internal Server Error", details: err.message });
});

// ✅ Start server with auto-port handling
const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Port ${port} is busy, trying ${port + 1}...`);
      startServer(parseInt(port) + 1);
    } else {
      console.error("❌ Server error:", err);
    }
  });
};

startServer(parseInt(PORT) || 5001);

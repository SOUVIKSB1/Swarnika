const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Cart = require("../models/Cart");
const { authMiddleware } = require("./middleware");
const crypto = require("crypto");

// JWT generator
function generateToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

// ✅ Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email already registered" });

    const newUser = await User.create({
      name,
      email,
      password,
    });
    const token = generateToken(newUser);

    // Cookie options: In dev, allow cross-origin with Lax. In prod, use None with Secure
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true on HTTPS production
      sameSite: "Lax", // Works for both dev (localhost) and prod (same-site)
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", token, cookieOptions);

    console.log("🍪 Token cookie set on registration");
    // If a guestId was provided, merge the guest cart into the new user
    if (req.body?.guestId) {
      try {
        await mergeGuestCartToUser(req.body.guestId, newUser._id);
        console.log('🔀 Merged guest cart into new user during registration');
      } catch (e) {
        console.warn('⚠️ Guest cart merge failed during registration:', e.message);
      }
    }

    res.json({
      message: "Registered successfully",
      user: { name: newUser.name, email: newUser.email, role: newUser.role || "user" },
      token: token, // Send token in response so frontend can store it as fallback
    });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ✅ Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax", // Works for both dev and prod
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", token, cookieOptions);

    console.log("🍪 Token cookie set on login");
    // Merge guest cart if provided
    if (req.body?.guestId) {
      try {
        await mergeGuestCartToUser(req.body.guestId, user._id);
        console.log('🔀 Merged guest cart into user after login');
      } catch (e) {
        console.warn('⚠️ Guest cart merge failed during login:', e.message);
      }
    }

    res.json({
      message: "Login successful",
      user: { name: user.name, email: user.email, role: user.role || "user" },
      token: token, // Send token in response so frontend can store it as fallback
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ✅ Get current user
// Accepts JWT token from: cookies, x-auth-token header, or Bearer header
router.get("/me", async (req, res) => {
  try {
    console.log("🔍 Checking authentication for /me request...");
    console.log("🧠 Cookies received:", req.cookies);
    console.log(
      "🧠 Authorization Header:",
      req.headers.authorization || "none"
    );
    console.log("🧠 x-auth-token Header:", req.headers["x-auth-token"] || "none");

    // Extract token from cookie, x-auth-token, or Bearer header
    let token = null;
    if (req.cookies?.token) {
      token = req.cookies.token;
      console.log("✅ Token found in cookies");
    } else if (req.headers["x-auth-token"]) {
      token = req.headers["x-auth-token"];
      console.log("✅ Token found in x-auth-token header");
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      // Only accept Bearer for Firebase tokens, but try JWT verification first
      token = req.headers.authorization.split(" ")[1];
      console.log("✅ Token found in Authorization Bearer header");
    } else {
      console.warn("⚠️ No authentication token found in cookies or headers");
      return res
        .status(401)
        .json({ error: "Authentication token missing. Please log in again." });
    }

    // Verify JWT token
    let decoded;
    try {
      console.log("🔑 Attempting JWT verification...");
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("✅ JWT verified for user ID:", decoded.id);
    } catch (jwtErr) {
      console.warn("⚠️ JWT verification failed:", jwtErr.message);
      
      // If Bearer token and JWT fails, try Firebase verification
      if (req.headers.authorization?.startsWith("Bearer ")) {
        try {
          console.log("🔥 Attempting Firebase token verification as fallback...");
          const admin = require('firebase-admin');
          const decodedFirebase = await admin.auth().verifyIdToken(token);
          console.log("✅ Firebase token verified:", decodedFirebase.email);
          
          // Find user by Firebase UID
          const firebaseUser = await User.findOne({ firebaseUid: decodedFirebase.uid });
          if (!firebaseUser) {
            console.warn("⚠️ Firebase user not found in database");
            return res.status(404).json({ error: "User not found" });
          }
          
          console.log("✅ Authenticated user (Firebase):", firebaseUser.name);
          return res.status(200).json({
            id: firebaseUser._id,
            name: firebaseUser.name,
            email: firebaseUser.email,
            profileImage: firebaseUser.profileImage || "",
            role: firebaseUser.role || "user",
          });
        } catch (firebaseErr) {
          console.error("❌ Firebase verification also failed:", firebaseErr.message);
          return res.status(401).json({ error: "Invalid or expired token" });
        }
      }
      
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (!decoded?.id) {
      console.warn("⚠️ Invalid token payload detected");
      return res.status(401).json({ error: "Invalid token structure" });
    }

    // Fetch user
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      console.warn(`⚠️ User not found for decoded token ID: ${decoded.id}`);
      return res.status(404).json({ error: "User not found" });
    }

    // ✅ Respond with clean user info
    console.log("✅ Authenticated user (JWT):", user.name);
    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage || "",
      role: user.role || "user",
    });
  } catch (err) {
    console.error("❌ /me route error:", err);
    res
      .status(500)
      .json({ error: "Internal server error during authentication check" });
  }
});

// ✅ Get User Profile
router.get("/profile", async (req, res) => {
  try {
    console.log("📋 GET /auth/profile called");
    
    // Extract token from cookie, x-auth-token, or Bearer header
    let token = null;
    if (req.cookies?.token) {
      token = req.cookies.token;
    } else if (req.headers["x-auth-token"]) {
      token = req.headers["x-auth-token"];
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Fetch user
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      address: user.address || "",
      profileImage: user.profileImage || "",
      role: user.role || "user"
    });
  } catch (err) {
    console.error("❌ GET /auth/profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Update User Profile
router.put("/profile", async (req, res) => {
  try {
    console.log("✏️ PUT /auth/profile called");
    const { name, phone, address, profileImage } = req.body;

    // Extract token
    let token = null;
    if (req.cookies?.token) {
      token = req.cookies.token;
    } else if (req.headers["x-auth-token"]) {
      token = req.headers["x-auth-token"];
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Build update object — only include fields that were explicitly provided
    const updateData = {
      phone: phone !== undefined ? phone : "",
      address: address !== undefined ? address : "",
      profileImage: profileImage !== undefined ? profileImage : ""
    };
    if (name && name.trim()) updateData.name = name.trim();

    // Update user
    const user = await User.findByIdAndUpdate(
      decoded.id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ Profile updated for user:", user.email);
    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        profileImage: user.profileImage || "",
        role: user.role || "user"
      }
    });
  } catch (err) {
    console.error("❌ PUT /auth/profile error:", err);
    res.status(500).json({ error: "Server error during profile update" });
  }
});

// ✅ Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", { path: "/" });
  console.log("👋 Token cookie cleared on logout");
  res.json({ message: "Logged out successfully" });
});

// ✅ Social / Firebase token exchange
// Accepts a Firebase ID token from client, verifies it with Firebase Admin SDK,
// then finds or creates a corresponding user and issues a server JWT cookie.
router.post("/firebase", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken required" });

    console.log("🔐 Received Firebase ID token, verifying...");

    // Verify token with Firebase Admin SDK
    const admin = require('firebase-admin');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    console.log("✅ Firebase token verified:", decodedToken.email);

    const email = decodedToken.email;
    const name = decodedToken.name || (email ? email.split("@")[0] : "User");
    const firebaseUid = decodedToken.uid;
    
    if (!email) {
      return res.status(400).json({ error: "Token payload missing email" });
    }

    // Find or create a user record
    let user = await User.findOne({ email });
    if (!user) {
      // Create user with Firebase UID (no password needed)
      user = await User.create({ 
        name, 
        email, 
        firebaseUid,
        phone: req.body?.phone || "",
        address: req.body?.address || "",
        // Password not required for Firebase users
      });
      console.log("🆕 Created user from Firebase login:", email);
    } else {
      // Update existing user with Firebase UID and optionally phone/address
      let updated = false;
      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        updated = true;
      }
      if (req.body?.phone && !user.phone) {
        user.phone = req.body.phone;
        updated = true;
      }
      if (req.body?.address && !user.address) {
        user.address = req.body.address;
        updated = true;
      }
      if (updated) {
        await user.save();
        console.log("🔄 Updated user details with Firebase sync:", email);
      }
    }

    // Generate JWT token for backend session
    const token = generateToken(user);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax", // Works for both dev and prod
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", token, cookieOptions);
    console.log("🍪 JWT cookie set for Firebase user:", email);
    console.log("🍪 Cookie options:", cookieOptions);
    console.log("🍪 Response headers will include Set-Cookie");

    // Merge guest cart into user if client sent guestId (optional)
    if (req.body?.guestId) {
      try {
        await mergeGuestCartToUser(req.body.guestId, user._id);
        console.log('🔀 Merged guest cart into user after Firebase exchange');
      } catch (e) {
        console.warn('⚠️ Guest cart merge failed during Firebase exchange:', e.message);
      }
    }

    res.json({
      message: "Firebase authentication successful",
      user: { name: user.name, email: user.email, role: user.role || "user" },
      token: token, // Also send token in response so frontend can store it
      debug: {
        cookieSet: true,
        cookieName: 'token',
        cookieOptions: cookieOptions
      }
    });
  } catch (err) {
    console.error("❌ Firebase token verification failed:", err);
    res.status(401).json({ 
      error: "Invalid Firebase token",
      details: err.message 
    });
  }
});

// Helper: merge a guest cart into a user's cart (summing quantities)
async function mergeGuestCartToUser(guestId, userId) {
  if (!guestId) return;
  console.log('🔀 mergeGuestCartToUser called with', guestId, userId);
  const guestCart = await Cart.findOne({ guestId });
  if (!guestCart) {
    console.log('🔍 No guest cart found for', guestId);
    return;
  }

  let userCart = await Cart.findOne({ user: userId });
  if (!userCart) {
    // Attach guest cart to user
    guestCart.user = userId;
    guestCart.guestId = undefined;
    await guestCart.save();
    console.log('✅ Guest cart reassigned to user:', userId);
    return;
  }

  // Merge items: sum quantities for matching products
  for (const gItem of guestCart.items) {
    const existing = userCart.items.find(i => i.product.toString() === gItem.product.toString());
    if (existing) {
      existing.quantity += gItem.quantity;
    } else {
      userCart.items.push({ product: gItem.product, quantity: gItem.quantity, price_at_add: gItem.price_at_add });
    }
  }

  await userCart.save();
  // Remove guest cart
  await Cart.deleteOne({ _id: guestCart._id });
  console.log('✅ Merged guest cart into user cart and removed guest cart');
}

// ✅ GET notifications for current user
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("notifications");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const sorted = (user.notifications || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json(sorted);
  } catch (err) {
    console.error("❌ GET /auth/notifications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ PUT mark notifications as read
router.put("/notifications/read", authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (notificationId) {
      const notif = user.notifications.id(notificationId);
      if (notif) notif.read = true;
    } else {
      user.notifications.forEach(n => n.read = true);
    }

    await user.save();
    res.json({ message: "Notifications marked as read" });
  }
});

// Multer and file upload configuration
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  },
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit
});

// ✅ POST /auth/upload-avatar
router.post("/upload-avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }
    
    const avatarUrl = `/uploads/${req.file.filename}`;
    
    // Automatically update the user profileImage field
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    user.profileImage = avatarUrl;
    await user.save();
    
    res.json({
      message: "Avatar uploaded successfully",
      profileImage: avatarUrl
    });
  } catch (err) {
    console.error("❌ POST /auth/upload-avatar error:", err);
    res.status(500).json({ error: err.message || "Failed to upload avatar" });
  }
});

module.exports = router;



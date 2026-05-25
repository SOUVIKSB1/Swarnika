const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET';

async function authMiddleware(req, res, next) {
  try {
    console.log('🔍 Checking authentication for', req.path, 'request...');
    console.log('🔍 Origin:', req.headers.origin);
    console.log('🧠 Raw Cookies:', req.headers.cookie);
    console.log('🧠 Parsed Cookies:', req.cookies);
    console.log('🧠 Authorization Header:', req.headers.authorization || 'none');

    // Extract token from cookie, Authorization header, or x-auth-token header
    let token = req.cookies?.token || null;
    let isFirebaseToken = false;

    // Check Authorization: Bearer header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      isFirebaseToken = true;
    }

    // Check x-auth-token header (for localStorage fallback)
    if (!token && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
      console.log('🔑 Using x-auth-token header (localStorage fallback)');
    }

    if (!token) {
      console.warn('⚠️ No authentication token found in cookies or headers');
      console.warn('⚠️ req.cookies:', req.cookies);
      console.warn('⚠️ req.headers.cookie:', req.headers.cookie);
      console.warn('⚠️ req.headers.x-auth-token:', req.headers['x-auth-token']);
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    console.log('✅ Token found:', token.substring(0, 20) + '...');

    let user = null;

    // Try to verify as Firebase ID token first (if from Authorization header)
    if (isFirebaseToken) {
      try {
        console.log('🔥 Attempting Firebase token verification...');
        const decodedToken = await admin.auth().verifyIdToken(token);
        console.log('✅ Firebase token verified:', decodedToken.email);
        
        // Find or create user in database
        user = await User.findOne({ email: decodedToken.email });
        
        if (!user) {
          // Create user if doesn't exist (from Firebase Auth)
          console.log('👤 Creating new user from Firebase Auth');
          user = await User.create({
            name: decodedToken.name || decodedToken.email.split('@')[0],
            email: decodedToken.email,
            firebaseUid: decodedToken.uid,
          });
        }
        
        req.user = user;
        console.log(`✅ Authenticated user (Firebase): ${user.name} (${user.email})`);
        return next();
      } catch (firebaseError) {
        console.warn('⚠️ Firebase token verification failed:', firebaseError.message);
        // Fall through to try JWT verification
      }
    }

    // Try to verify as JWT token (legacy support)
    try {
      console.log('🔑 Attempting JWT token verification...');
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.id) {
        console.warn('⚠️ Invalid JWT payload');
        return res.status(401).json({ error: 'Invalid authentication token' });
      }

      // Fetch user from DB
      user = await User.findById(decoded.id).select('-password');
      if (!user) {
        console.warn('⚠️ User not found for decoded token');
        return res.status(404).json({ error: 'User not found' });
      }

      req.user = user;
      console.log(`✅ Authenticated user (JWT): ${user.name} (${user.email})`);
      next();
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }

      return res.status(401).json({ error: 'Invalid or missing authentication token' });
    }
  } catch (err) {
    console.error('❌ Authentication error:', err.message);
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

async function maybeAuth(req, res, next) {
  try {
    // Try to authenticate, but allow anonymous requests with a guestId
    console.log('🔍 maybeAuth: attempting optional authentication for', req.path);
    // Reuse same token extraction logic
    let token = req.cookies?.token || null;
    let isFirebaseToken = false;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      isFirebaseToken = true;
    }
    if (!token && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
      console.log('🔑 maybeAuth: Using x-auth-token header');
    }

    // If no token, treat as guest if guestId provided, otherwise proceed as anonymous
    if (!token) {
      req.user = null;
      req.guestId = req.headers['x-guest-id'] || req.body?.guestId || req.query?.guestId || null;
      console.log('🔐 maybeAuth: no token, guestId=', req.guestId);
      return next();
    }

    // If there is a token, attempt verification (same as authMiddleware)
    let user = null;
    if (isFirebaseToken) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        user = await User.findOne({ email: decodedToken.email });
        if (!user) {
          user = await User.create({
            name: decodedToken.name || decodedToken.email.split('@')[0],
            email: decodedToken.email,
            firebaseUid: decodedToken.uid,
          });
        }
        req.user = user;
        // Also capture guestId for potential cart merging
        req.guestId = req.headers['x-guest-id'] || req.body?.guestId || req.query?.guestId || null;
        console.log('✅ maybeAuth: Authenticated (Firebase) ->', user.email, 'guestId:', req.guestId);
        return next();
      } catch (e) {
        console.warn('⚠️ maybeAuth: Firebase token invalid:', e.message);
      }
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.id) {
        req.user = null;
        req.guestId = req.headers['x-guest-id'] || req.body?.guestId || req.query?.guestId || null;
        return next();
      }
      user = await User.findById(decoded.id).select('-password');
      if (!user) {
        req.user = null;
        req.guestId = req.headers['x-guest-id'] || req.body?.guestId || req.query?.guestId || null;
        return next();
      }
      req.user = user;
      // Also capture guestId for potential cart merging
      req.guestId = req.headers['x-guest-id'] || req.body?.guestId || req.query?.guestId || null;
      console.log('✅ maybeAuth: Authenticated (JWT) ->', user.email, 'guestId:', req.guestId);
      return next();
    } catch (err) {
      console.warn('⚠️ maybeAuth: token verify failed:', err.message);
      req.user = null;
      req.guestId = req.headers['x-guest-id'] || req.body?.guestId || req.query?.guestId || null;
      return next();
    }
  } catch (err) {
    console.error('❌ maybeAuth error:', err);
    req.user = null;
    req.guestId = req.headers['x-guest-id'] || req.body?.guestId || req.query?.guestId || null;
    return next();
  }
}

// ✅ Admin role checking middleware (requires authentication + admin role)
async function adminMiddleware(req, res, next) {
  try {
    console.log('🔐 Checking admin access for', req.path);
    
    // First, authenticate
    let token = req.cookies?.token || null;
    let isFirebaseToken = false;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      isFirebaseToken = true;
    }
    if (!token && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    if (!token) {
      console.warn('⚠️ Admin access denied: no token');
      return res.status(401).json({ error: 'Authentication required for admin access' });
    }

    let user = null;

    // Try Firebase token first if Bearer
    if (isFirebaseToken) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        user = await User.findOne({ email: decodedToken.email });
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
      } catch (e) {
        console.warn('⚠️ Firebase token invalid for admin:', e.message);
      }
    }

    // Try JWT token
    if (!user) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.id) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        user = await User.findById(decoded.id).select('-password');
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
      } catch (err) {
        console.warn('⚠️ JWT verification failed for admin:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    // Check admin role
    if (!user || user.role !== 'admin') {
      console.warn(`⚠️ Admin access denied: user is ${user ? user.role : 'unknown'}`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    console.log(`✅ Admin access granted to ${user.email}`);
    next();
  } catch (err) {
    console.error('❌ Admin middleware error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { authMiddleware, maybeAuth, adminMiddleware };

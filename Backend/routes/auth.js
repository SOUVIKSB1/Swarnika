// ✅ Authentication Routes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware } = require('./middleware'); // Import auth middleware

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET';

// Function to set token cookie
function setTokenCookie(res, user) {
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    path: '/', // ensure available across all routes
  });
  return token;
}

// ✅ Register new user
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (name, email, password_hash, phone) VALUES (?,?,?,?)',
      [name, email, hashed, phone || ''],
      function (err2) {
        if (err2) {
          console.error('DB error during registration:', err2.message);
          return res.status(500).json({ error: 'Registration failed' });
        }
        
        // ✅ Automatically log in user after registration
        const userId = this.lastID;
        const newUser = { id: userId, name, email };
        setTokenCookie(res, newUser);
        
        res.json({ 
          message: 'User registered successfully', 
          user: newUser
        });
      }
    );
  });
});

// ✅ Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    setTokenCookie(res, user);
    console.log('✅ Token cookie set for user:', user.email);
    res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email } });
  });
});

// ✅ Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// ✅ Get Profile (was /me, fixed to /profile)
router.get('/profile', authMiddleware, (req, res) => {
  // authMiddleware already added req.user
  db.get('SELECT id, name, email, phone, role, address FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// ✅ Update Profile (NEW ROUTE)
router.put('/profile', authMiddleware, (req, res) => {
  const { name, phone, address } = req.body;
  const uid = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  db.run(
    'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
    [name, phone || '', address || '', uid],
    function(err) {
      if (err) {
        console.error('Error updating profile:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

module.exports = router;
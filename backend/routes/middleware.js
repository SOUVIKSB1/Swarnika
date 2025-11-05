const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET';

function authMiddleware(req, res, next) {
  // Frontend must send the JWT token in either cookies or Authorization header
  // Check for token in both cookies and authorization header
  const cookieToken = req.cookies?.token;
  const headerToken = req.headers?.authorization?.split(' ')[1];
  console.debug('Debug: cookieToken:', cookieToken, 'headerToken:', headerToken);
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated, no token provided' });
  }

  try {
    // Verify the token and attach the user payload to req.user
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authMiddleware };
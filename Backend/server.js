
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

// ✅ Middleware setup (moved up for cookie parsing)
app.use(express.json());
app.use(cookieParser());

// ✅ CORS configuration (must be before routes)
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked for origin: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Ensure preflight requests are handled
app.options('*', cors());

// ✅ Optional root route (so / doesn’t show “Cannot GET /”)
app.get('/', (req, res) => {
  res.send('✅ Backend is running correctly and ready for API calls!');
});


// ✅ API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// ✅ Static files if needed
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Handle unknown routes (return JSON instead of HTML)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ✅ Global error handler to ensure consistent JSON responses
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
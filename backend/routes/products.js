const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// ✅ GET /api/products with search, category, pagination, and logs
router.get('/', async (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    console.log("🟢 Fetching products with filter:", { search, category, page, limit });

    const products = await Product.find(filter).skip(skip).limit(limit);
    res.json(products);
  } catch (error) {
    console.error("❌ Internal server error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Fetch a single product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error("❌ Internal server error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
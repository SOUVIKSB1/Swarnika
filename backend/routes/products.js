const express = require('express');
const db = require('../db');
const router = express.Router();

// ✅ Enhanced GET /api/products with search, category, pagination, and debugging logs
router.get('/', (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    const category = (req.query.category || '').trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let sql = "SELECT * FROM products WHERE 1=1";
    const params = [];

    if (search) {
      sql += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    console.log("🟢 Fetching products with query:", { search, category, page, limit });

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error("❌ Database error:", err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error("❌ Internal server error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Fetch a single product by ID
router.get('/:id', (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM products WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("❌ Database error:", err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
  });
});

module.exports = router;
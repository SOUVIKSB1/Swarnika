const express = require('express');
const { authMiddleware, adminMiddleware } = require('./middleware');
const Product = require('../models/Product');

const router = express.Router();

// ✅ Create new product (admin only)
router.post('/products', adminMiddleware, async (req, res) => {
  try {
    const { name, sku, category, metal, price, stock, weight, description, image } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const newProduct = new Product({
      name,
      sku,
      category,
      metal,
      price,
      stock,
      weight,
      description,
      image
    });

    await newProduct.save();
    res.status(201).json({ message: 'Product created successfully', product: newProduct });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Update product by ID (admin only)
router.put('/products/:id', adminMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Delete product by ID (admin only)
router.delete('/products/:id', adminMiddleware, async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
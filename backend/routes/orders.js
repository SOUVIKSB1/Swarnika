const express = require('express');
const { authMiddleware } = require('./middleware');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');

const router = express.Router();

// ✅ POST /checkout - Create a new order from the user's cart
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { shipping_address, payment_mode } = req.body;

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty' });
    }

    // Check stock availability
    for (const item of cart.items) {
      if (item.quantity > item.product.stock) {
        return res.status(400).json({ error: `Insufficient stock for ${item.product.name}` });
      }
    }

    // Compute total
    const total = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.price_at_add,
      0
    );

    // Create order
    const newOrder = new Order({
      user: userId,
      order_total: total,
      payment_mode: payment_mode || 'COD',
      payment_status: 'Success',
      shipping_address: shipping_address || 'Not provided',
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.price_at_add
      }))
    });

    await newOrder.save();

    // Decrease product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity }
      });
    }

    // Clear cart after order
    cart.items = [];
    await cart.save();

    res.json({ message: 'Order placed successfully', order_id: newOrder._id });
  } catch (error) {
    console.error('❌ Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET / - Fetch all orders for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET /:id - Fetch a specific order
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.product');

    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ DELETE /:id - Cancel (delete) an order
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    await Order.findByIdAndDelete(order._id);
    res.json({ message: 'Order cancelled successfully', order_id: order._id });
  } catch (error) {
    console.error('❌ Error cancelling order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
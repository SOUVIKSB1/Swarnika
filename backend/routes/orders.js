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
      if (!item.product) {
        return res.status(400).json({ error: 'Your cart contains a product that no longer exists. Please remove it and try again.' });
      }
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

async function autoUpdateOrdersDeliveryStatus(userId) {
  try {
    const now = new Date();
    const orders = await Order.find({
      user: userId,
      status: { $nin: ['Delivered', 'Cancelled'] }
    });
    const User = require('../models/User');
    for (const order of orders) {
      let targetDeliveryDate = order.deliveryDate;
      if (!targetDeliveryDate && order.createdAt) {
        const duration = order.estimatedDurationDays || 7;
        targetDeliveryDate = new Date(order.createdAt.getTime() + duration * 24 * 60 * 60 * 1000);
      }
      if (targetDeliveryDate && now >= new Date(targetDeliveryDate)) {
        order.status = 'Delivered';
        order.payment_status = 'Success';
        await order.save();
        
        await User.findByIdAndUpdate(order.user, {
          $push: {
            notifications: {
              title: `✅ Order Delivered: #${order._id}`,
              message: `Your order #${order._id} has been delivered automatically (estimated delivery date reached).`,
              type: 'delivery',
              read: false,
              createdAt: new Date()
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Error in autoUpdateOrdersDeliveryStatus:', err);
  }
}

// ✅ GET / - Fetch all orders for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    await autoUpdateOrdersDeliveryStatus(req.user._id);
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
    await autoUpdateOrdersDeliveryStatus(req.user._id);
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

    order.status = 'Cancelled';
    await order.save();
    res.json({ message: 'Order cancelled successfully', order_id: order._id });
  } catch (error) {
    console.error('❌ Error cancelling order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
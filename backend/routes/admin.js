const express = require('express');
const { adminMiddleware } = require('./middleware');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ✅ Configure multer storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
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
    cb(new Error("Error: File upload only supports images (jpeg, jpg, png, webp, gif)!"));
  }
});

// ✅ Upload product image (admin only)
router.post('/upload', adminMiddleware, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a file' });
    }
    // Return the relative URL of the uploaded image
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    res.status(201).json({ message: 'Product created successfully', product: newProduct, id: newProduct._id });
  } catch (error) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Update product by ID (admin only)
router.put('/products/:id', adminMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    // Map image_url if provided to image
    if (updates.image_url !== undefined && updates.image === undefined) {
      updates.image = updates.image_url;
    }
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

// ✅ Get list of all admins (admin only)
router.get('/admins', adminMiddleware, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }, 'name email createdAt');
    res.json(admins);
  } catch (error) {
    console.error('❌ Error fetching admins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Promote or add new admin (admin only)
router.post('/admins', adminMiddleware, async (req, res) => {
  try {
    const { email, name, password } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      // User exists, promote to admin
      user.role = 'admin';
      await user.save();
      return res.json({ message: `Successfully promoted ${user.name || email} to admin`, user });
    } else {
      // User doesn't exist, create a new admin user
      if (!name || !password) {
        return res.status(400).json({ error: 'User not found. Provide name and password to create a new admin.' });
      }
      
      const newAdmin = new User({
        name,
        email: email.toLowerCase(),
        password,
        role: 'admin'
      });
      
      await newAdmin.save();
      return res.status(201).json({ message: 'Successfully created new admin user', user: newAdmin });
    }
  } catch (error) {
    console.error('❌ Error adding admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Fetch all orders in the system (admin only)
router.get('/orders', adminMiddleware, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('❌ Error fetching all orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Update order by ID (admin only)
router.put('/orders/:id', adminMiddleware, async (req, res) => {
  try {
    const { status, shipping_address, order_total, payment_status } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // If status is changed to Cancelled, restore stock
    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }
    }
    if (status !== undefined && status !== order.status) {
      let title = `Order Status: ${status}`;
      let message = `Your order #${order._id} has been marked as ${status}.`;
      let type = 'info';

      if (status === 'Shipped') {
        title = `🚚 Order Shipped: #${order._id}`;
        message = `Great news! Your order #${order._id} has been shipped and is on its way.`;
        type = 'shipping';
      } else if (status === 'Delivered') {
        title = `✅ Order Delivered: #${order._id}`;
        message = `Your order #${order._id} has been delivered successfully. Thank you for shopping with Swarnika Jewels!`;
        type = 'delivery';
      } else if (status === 'Cancelled') {
        title = `❌ Order Cancelled: #${order._id}`;
        message = `Your order #${order._id} has been cancelled.`;
        type = 'cancelled';
      }

      await User.findByIdAndUpdate(order.user, {
        $push: {
          notifications: {
            title,
            message,
            type,
            read: false,
            createdAt: new Date()
          }
        }
      });
    }

    if (status !== undefined) order.status = status;
    if (shipping_address !== undefined) order.shipping_address = shipping_address;
    if (order_total !== undefined) order.order_total = order_total;
    if (payment_status !== undefined) order.payment_status = payment_status;
    
    await order.save();
    
    const updatedOrder = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('items.product');
      
    res.json({ message: 'Order updated successfully', order: updatedOrder });
  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Delete order by ID (admin only)
router.delete('/orders/:id', adminMiddleware, async (req, res) => {
  try {
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    if (!deletedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Get all registered users/members (admin only)
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('❌ Error fetching registered users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Update user profile details/role (admin only)
router.put('/users/:id', adminMiddleware, async (req, res) => {
  try {
    const { name, email, phone, address, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email: email.toLowerCase(), phone, address, role },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Delete user account (admin only)
router.delete('/users/:id', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user
    await User.findByIdAndDelete(req.params.id);
    // Delete their cart
    await Cart.deleteOne({ user: req.params.id });

    res.json({ message: 'User account and associated cart deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Send custom message/notification to user (admin only)
router.post('/users/:id/message', adminMiddleware, async (req, res) => {
  try {
    const { title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.notifications.push({
      title,
      message,
      type: type || 'admin_message',
      read: false,
      createdAt: new Date()
    });

    await user.save();
    res.json({ message: 'Notification sent successfully to the user' });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
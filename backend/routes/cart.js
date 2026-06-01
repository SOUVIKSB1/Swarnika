const express = require('express');
const { maybeAuth } = require('./middleware');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const router = express.Router();

// ✅ Get cart
router.get('/', maybeAuth, async (req, res) => {
  try {
    const identifier = req.user ? `user:${req.user._id}` : `guest:${req.guestId}`;
    console.log('📦 Fetching cart for', identifier);
    
    let cart = null;
    
    if (req.user) {
      if (req.guestId) {
        console.log('🔄 merging guest cart to user cart:', req.guestId);
        const guestCart = await Cart.findOne({ guestId: req.guestId });
        if (guestCart && guestCart.items.length > 0) {
          let userCart = await Cart.findOne({ user: req.user._id });
          if (!userCart) {
            guestCart.user = req.user._id;
            guestCart.guestId = undefined;
            await guestCart.save();
            cart = guestCart;
            console.log('✅ Reassigned guest cart to user');
          } else {
            // Merge items safely
            for (const gItem of guestCart.items) {
              if (!gItem.product) continue;
              const existing = userCart.items.find(i => {
                if (!i.product) return false;
                const pId = i.product._id ? i.product._id.toString() : i.product.toString();
                const gpId = gItem.product._id ? gItem.product._id.toString() : gItem.product.toString();
                return pId === gpId;
              });
              if (existing) {
                existing.quantity += gItem.quantity;
              } else {
                userCart.items.push({
                  product: gItem.product,
                  quantity: gItem.quantity,
                  price_at_add: gItem.price_at_add
                });
              }
            }
            await userCart.save();
            await Cart.deleteOne({ _id: guestCart._id });
            cart = userCart;
            console.log('✅ Merged guest cart items into user cart');
          }
        }
      }

      if (!cart) {
        cart = await Cart.findOne({ user: req.user._id }).populate('items.product').populate('user', 'name email phone address');
      } else {
        cart = await Cart.findById(cart._id).populate('items.product').populate('user', 'name email phone address');
      }
      console.log('📦 User cart loaded:', cart ? `${cart.items.length} items` : 'None');
    } else {
      // Guest user - look for cart by guestId
      cart = await Cart.findOne({ guestId: req.guestId }).populate('items.product');
      console.log('📦 Guest cart found:', cart ? `${cart.items.length} items` : 'None');
    }
    
    if (!cart) {
      // If there's no cart, create an empty cart for authenticated users or for guests with guestId
      if (req.user) {
        console.log('📦 No user cart found — creating an empty cart for user:', req.user._id);
        cart = new Cart({ user: req.user._id, items: [] });
        await cart.save();
          cart = await Cart.findById(cart._id).populate('items.product').populate('user', 'name email phone address');
      } else if (req.guestId) {
        console.log('📦 No guest cart found — creating an empty cart for guestId:', req.guestId);
        cart = new Cart({ guestId: req.guestId, items: [] });
        await cart.save();
          cart = await Cart.findById(cart._id).populate('items.product').populate('user', 'name email phone address');
      } else {
        console.log('📦 No cart found and no guestId present, returning empty');
        return res.json({ items: [] });
      }
    }
    
    if (cart.items.length > 0) {
      console.log('📦 Cart items:', cart.items.filter(i => i.product).map(i => ({ productId: i.product._id, qty: i.quantity })));
      
      // Remove deleted products (where populate resulted in null/undefined)
      const originalLength = cart.items.length;
      cart.items = cart.items.filter(i => i.product != null);
      if (cart.items.length < originalLength) {
        console.log(`🗑️ Removed ${originalLength - cart.items.length} deleted product(s) from cart`);
        await cart.save();
      }
    }
    
    res.json(cart);
  } catch (error) {
    console.error('❌ Error fetching cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Add item to cart
router.post('/add', maybeAuth, async (req, res) => {
  try {
    console.log('🛒 Adding to cart; auth user:', !!req.user, 'guestId:', req.guestId);
    const { productId, quantity, guestId } = req.body;
    console.log('🛒 Payload:', { productId, quantity, guestId });
    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Invalid product or quantity' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID format' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let cart = null;
    
    if (req.user) {
      // Authenticated user - check for existing user cart
      cart = await Cart.findOne({ user: req.user._id });
      
      // If no user cart but guestId provided, merge guest cart
      if (!cart && (guestId || req.guestId)) {
        const guestCartId = guestId || req.guestId;
        const guestCart = await Cart.findOne({ guestId: guestCartId });
        if (guestCart) {
          console.log('🛒 Migrating guest cart to user');
          guestCart.user = req.user._id;
          guestCart.guestId = undefined;
          cart = guestCart;
        }
      }
      
      // Create new user cart if still doesn't exist
      if (!cart) {
        cart = new Cart({ user: req.user._id, items: [] });
        console.log('🛒 Creating new user cart');
      }
    } else {
      // Guest user - use guestId
      const cartGuestId = guestId || req.guestId || `guest_${Date.now()}`;
      cart = await Cart.findOne({ guestId: cartGuestId });
      
      if (!cart) {
        cart = new Cart({ guestId: cartGuestId, items: [] });
        console.log('🛒 Creating new guest cart with id:', cartGuestId);
      }
    }

    const existingItem = cart.items.find(item => {
      if (!item.product) return false;
      const pId = item.product._id ? item.product._id.toString() : item.product.toString();
      return pId === productId;
    });
    if (existingItem) {
      existingItem.quantity += quantity;
      console.log('🛒 Updated existing item quantity:', existingItem.quantity);
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price_at_add: product.price,
      });
      console.log('🛒 Added new item to cart');
    }

    await cart.save();
    console.log('🛒 Cart saved with', cart.items.length, 'items, cartId:', cart._id);
    const populatedCart = await cart.populate([
      { path: 'items.product' },
      { path: 'user', select: 'name email phone address' }
    ]);
    res.json({ message: 'Item added to cart successfully', items: populatedCart.items, cart: populatedCart });
  } catch (error) {
    console.error('❌ Error adding item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Update item quantity
router.put('/items/:itemId', maybeAuth, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const query = req.user ? { user: req.user._id } : { guestId: req.guestId || req.body?.guestId };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find(i => i._id.toString() === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in cart' });

    item.quantity = quantity;
    await cart.save();
    const populatedCart = await cart.populate([
      { path: 'items.product' },
      { path: 'user', select: 'name email phone address' }
    ]);
    res.json({ message: 'Item updated', cart: populatedCart });
  } catch (error) {
    console.error('❌ Error updating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Remove item from cart
router.delete('/items/:itemId', maybeAuth, async (req, res) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId || req.body?.guestId };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
    await cart.save();
    const populatedCart = await cart.populate([
      { path: 'items.product' },
      { path: 'user', select: 'name email phone address' }
    ]);
    res.json({ message: 'Item removed from cart', cart: populatedCart });
  } catch (error) {
    console.error('❌ Error removing item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Legacy: Remove by cart item ID (kept for backward compatibility)
router.delete('/remove/:itemId', maybeAuth, async (req, res) => {
  try {
    const query = req.user ? { user: req.user._id } : { guestId: req.guestId || req.body?.guestId };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
    await cart.save();

    res.json({ message: 'Item removed from cart', cart });
  } catch (error) {
    console.error('❌ Error removing item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint - shows request auth state
router.get('/debug/headers', (req, res) => {
  res.json({
    user: req.user ? { id: req.user._id, email: req.user.email } : null,
    guestId: req.guestId,
    headers: {
      'x-auth-token': req.headers['x-auth-token'] ? 'SET' : 'NOT SET',
      'x-guest-id': req.headers['x-guest-id'] || 'NOT SET',
      'authorization': req.headers.authorization ? 'SET' : 'NOT SET',
    }
  });
});

module.exports = router;
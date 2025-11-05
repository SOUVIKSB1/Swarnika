const express = require('express');
const db = require('../db');
const { authMiddleware } = require('./middleware');

const router = express.Router();

// Utility: get or create cart for a user (async/await version)
async function getOrCreateCart(userId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM carts WHERE user_id = ?", [userId], (err, row) => {
      if (err) {
        console.error("❌ DB error fetching cart:", err.message);
        return reject(err);
      }
      if (row) return resolve(row);
      db.run("INSERT INTO carts (user_id) VALUES (?)", [userId], function (err2) {
        if (err2) {
          console.error("❌ DB error creating cart:", err2.message);
          return reject(err2);
        }
        db.get("SELECT * FROM carts WHERE id = ?", [this.lastID], (err3, newCart) => {
          if (err3) {
            console.error("❌ DB error fetching new cart:", err3.message);
            return reject(err3);
          }
          resolve(newCart);
        });
      });
    });
  });
}

// GET all cart items for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('DEBUG: req.user in GET /cart:', req.user);
    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    const cart = await getOrCreateCart(user.id);

    db.all(
      `SELECT ci.id as item_id, p.*, ci.quantity, ci.price_at_add
       FROM cart_items ci 
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ?`,
      [cart.id],
      (err, rows) => {
        if (err) {
          console.error("❌ Error fetching cart items:", err.message);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ cart_id: cart.id, items: rows });
      }
    );
  } catch (error) {
    console.error("❌ Unexpected error in GET /cart:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST add item to cart
router.post('/items', authMiddleware, async (req, res) => {
  try {
    console.log('DEBUG: req.user in POST /cart/items:', req.user);
    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    let { product_id, quantity } = req.body;
    product_id = parseInt(product_id);
    quantity = parseInt(quantity);
    if (!product_id || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid product or quantity' });
    }

    const cart = await getOrCreateCart(user.id);

    db.get("SELECT price, stock FROM products WHERE id = ?", [product_id], (err, product) => {
      if (err || !product) {
        console.error("❌ Product not found or DB error:", err ? err.message : 'No product');
        return res.status(400).json({ error: 'Product not found' });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ error: 'Out of stock' });
      }

      db.get("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?", [cart.id, product_id], (err2, existingItem) => {
        if (err2) {
          console.error("❌ DB error checking existing cart item:", err2.message);
          return res.status(500).json({ error: 'Database error' });
        }

        if (existingItem) {
          const newQty = existingItem.quantity + quantity;
          db.run("UPDATE cart_items SET quantity = ? WHERE id = ?", [newQty, existingItem.id], function (err3) {
            if (err3) {
              console.error("❌ Failed to update item quantity:", err3.message);
              return res.status(500).json({ error: 'Failed to update item quantity' });
            }
            res.json({ message: 'Cart item quantity updated', quantity: newQty });
          });
        } else {
          db.run(
            "INSERT INTO cart_items (cart_id, product_id, quantity, price_at_add) VALUES (?,?,?,?)",
            [cart.id, product_id, quantity, product.price],
            function (err4) {
              if (err4) {
                console.error("❌ Error inserting into cart:", err4.message);
                return res.status(500).json({ error: 'Database insert failed' });
              }
              res.json({ message: 'Added to cart', cart_item_id: this.lastID });
            }
          );
        }
      });
    });
  } catch (error) {
    console.error("❌ Unexpected error in POST /cart/items:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update quantity of a cart item
router.put('/items/:id', authMiddleware, async (req, res) => {
  try {
    console.log('DEBUG: req.user in PUT /cart/items/:id:', req.user);
    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    const qty = parseInt(req.body.quantity);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });

    db.run("UPDATE cart_items SET quantity = ? WHERE id = ?", [qty, req.params.id], function (err) {
      if (err) {
        console.error("❌ DB error updating quantity:", err.message);
        return res.status(500).json({ error: 'Database update failed' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
      res.json({ message: 'Quantity updated', id: req.params.id, quantity: qty });
    });
  } catch (error) {
    console.error("❌ Unexpected error in PUT /cart/items/:id:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE remove item from cart
router.delete('/items/:id', authMiddleware, async (req, res) => {
  try {
    console.log('DEBUG: req.user in DELETE /cart/items/:id:', req.user);
    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: 'Not authenticated' });

    db.run("DELETE FROM cart_items WHERE id = ?", [req.params.id], function (err) {
      if (err) {
        console.error("❌ DB error deleting item:", err.message);
        return res.status(500).json({ error: 'Database delete failed' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
      res.json({ message: 'Item removed successfully', id: req.params.id });
    });
  } catch (error) {
    console.error("❌ Unexpected error in DELETE /cart/items/:id:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
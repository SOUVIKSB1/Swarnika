const express = require('express');
const db = require('../db');
const { authMiddleware } = require('./middleware');

const router = express.Router();

router.post('/checkout', authMiddleware, (req,res)=>{
  const uid = req.user.id;
  const { shipping_address, payment_mode } = req.body;
  // load cart & items
  db.get("SELECT * FROM carts WHERE user_id = ?", [uid], (err, cart)=>{
    if(err || !cart) return res.status(400).json({error:'No cart'});
    
    // ✅ FIX: Select 'ci.price_at_add' to lock in the price
    db.all("SELECT ci.*, p.price, p.stock, ci.price_at_add FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.cart_id = ?", [cart.id], (err, items)=>{
      if(err) return res.status(500).json({error:'DB'});
      if(!items || items.length === 0) return res.status(400).json({error:'Cart empty'});
      // check stock
      for(const it of items){
        if(it.quantity > it.stock) return res.status(400).json({error:`Item ${it.product_id} out of stock`});
      }
      
      // ✅ FIX: Compute total using 'price_at_add'
      const total = items.reduce((s,it)=> s + (it.quantity * it.price_at_add), 0);
      
      // create order
      db.run("INSERT INTO orders (user_id, order_total, payment_mode, payment_status, shipping_address) VALUES (?,?,?,?,?)",
        [uid, total, payment_mode || 'COD', 'Success', shipping_address || 'Not provided'], function(err2){
          if(err2) return res.status(500).json({error:'DB'});
          const orderId = this.lastID;
          const insertItem = db.prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?,?,?,?)");
          
          for(const it of items){
            // ✅ FIX: Insert the 'price_at_add' into order_items as the final price
            insertItem.run(orderId, it.product_id, it.quantity, it.price_at_add);
            // decrease stock
            db.run("UPDATE products SET stock = stock - ? WHERE id = ?", [it.quantity, it.product_id]);
          }
          insertItem.finalize();
          // clear cart
          db.run("DELETE FROM cart_items WHERE cart_id = ?", [cart.id]);
          res.json({message:'Order placed', order_id: orderId});
      });
    });
  });
});

router.get('/', authMiddleware, (req,res)=>{
  const uid = req.user.id;
  db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [uid], (err, rows)=>{
    if(err) return res.status(500).json({error:'DB'});
    res.json(rows);
  });
});

router.get('/:id', authMiddleware, (req,res)=>{
  const uid = req.user.id;
  const oid = req.params.id;
  db.get("SELECT * FROM orders WHERE id = ? AND user_id = ?", [oid, uid], (err, order)=>{
    if(err || !order) return res.status(4404).json({error:'Not found'});
    db.all("SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?", [oid], (err, items)=>{
      res.json({order, items});
    });
  });
});

// ✅ Cancel (delete) order
router.delete('/:id', authMiddleware, (req, res) => {
  const uid = req.user.id;
  const oid = req.params.id;

  db.get("SELECT * FROM orders WHERE id = ? AND user_id = ?", [oid, uid], (err, order) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // delete order items first, then order
    db.run("DELETE FROM order_items WHERE order_id = ?", [oid], (err2) => {
      if (err2) return res.status(500).json({ error: 'Failed to remove order items' });

      db.run("DELETE FROM orders WHERE id = ? AND user_id = ?", [oid, uid], (err3) => {
        if (err3) return res.status(500).json({ error: 'Failed to remove order' });
        res.json({ message: 'Order cancelled successfully', order_id: oid });
      });
    });
  });
});

module.exports = router;
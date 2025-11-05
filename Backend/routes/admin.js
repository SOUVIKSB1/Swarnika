const express = require('express');
const db = require('../db');
const { authMiddleware } = require('./middleware');

const router = express.Router();

function adminOnly(req, res, next){
  if(req.user.role !== 'admin') return res.status(403).json({error:'Forbidden'});
  next();
}

// Create product (simple)
router.post('/products', authMiddleware, adminOnly, (req,res)=>{
  const { name, sku, category, metal, price, stock, weight, description, image_url } = req.body;
  db.run("INSERT INTO products (name, sku, category, metal, price, stock, weight, description, image_url) VALUES (?,?,?,?,?,?,?,?,?)",
    [name,sku,category,metal,price,stock,weight,description,image_url], function(err){
      if(err) return res.status(500).json({error:'DB'});
      res.json({message:'Created', id: this.lastID});
  });
});

router.put('/products/:id', authMiddleware, adminOnly, (req,res)=>{
  const id = req.params.id;
  const fields = req.body;
  const allowed = ['name','sku','category','metal','price','stock','weight','description','image_url'];
  const set = [];
  const vals = [];
  for(const k of allowed){
    if(fields[k] !== undefined){ set.push(`${k} = ?`); vals.push(fields[k]); }
  }
  if(set.length === 0) return res.status(400).json({error:'No fields'});
  vals.push(id);
  db.run(`UPDATE products SET ${set.join(', ')} WHERE id = ?`, vals, function(err){
    if(err) return res.status(500).json({error:'DB'});
    res.json({message:'Updated'});
  });
});

router.delete('/products/:id', authMiddleware, adminOnly, (req,res)=>{
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], function(err){
    if(err) return res.status(500).json({error:'DB'});
    res.json({message:'Deleted'});
  });
});

module.exports = router;
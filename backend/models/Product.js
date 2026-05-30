const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  image: String,
  category: String,
  metal: String,
  stock: { type: Number, default: 99 }
});

module.exports = mongoose.model('Product', productSchema);
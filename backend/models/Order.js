const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [orderItemSchema],
  order_total: { type: Number, required: true },
  payment_mode: { type: String, default: 'COD' },
  payment_status: { type: String, default: 'Pending' },
  status: { type: String, default: 'Processing' },
  shipping_address: { type: String },
  deliveryDate: { type: Date },
  estimatedDurationDays: { type: Number, default: 7 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
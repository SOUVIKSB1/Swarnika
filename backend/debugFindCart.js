require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('./models/Cart');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const userId = '691346c351b8e23c06839ccc';
    console.log('🔎 Searching for carts for user:', userId);
    const carts = await Cart.find({ user: userId }).populate('items.product').lean();
    console.log('Found', carts.length, 'cart(s) for', userId);
    console.log(JSON.stringify(carts, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ DB query error:', err);
    process.exit(1);
  }
})();

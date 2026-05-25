require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const p = await Product.findOne().lean();
    if (!p) {
      console.log('No products found');
      process.exit(0);
    }
    console.log('Product:', p._id.toString(), p.name, p.price);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
})();

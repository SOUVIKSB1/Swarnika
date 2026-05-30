const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.log('🔌 Trying fallback connection to local MongoDB (mongodb://127.0.0.1:27017/swarnika)...');
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/swarnika');
      console.log('✅ Connected to Local MongoDB');
    } catch (localError) {
      console.error('❌ Local MongoDB Connection Error:', localError.message);
      console.error('🔴 Please make sure MongoDB is running locally or check your MONGO_URI.');
      process.exit(1);
    }
  }
};

module.exports = connectDB;
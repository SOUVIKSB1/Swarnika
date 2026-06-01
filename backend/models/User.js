const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: function() {
      // Password not required if using Firebase Auth
      return !this.firebaseUid;
    },
    minlength: 6
  },
  firebaseUid: {
    type: String,
    sparse: true, // Allow null values but enforce uniqueness when present
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  phone: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  notifications: [
    {
      title: { type: String, required: true },
      message: { type: String, required: true },
      type: { type: String, default: 'info' }, // 'info', 'shipping', 'delivery', 'admin_message', 'cancelled'
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

// Hash password before saving (only if password exists)
userSchema.pre('save', async function(next) {
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
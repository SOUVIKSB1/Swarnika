const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');

dotenv.config();

// High-quality online references from Unsplash for luxury jewellery
const imagesByCategory = {
  'Necklace': [
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1576053139778-7e32f2ae3cfd?q=80&w=600&auto=format&fit=crop'
  ],
  'Bracelet': [
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?q=80&w=600&auto=format&fit=crop'
  ],
  'Ring': [
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1598560917505-59a3ad559071?q=80&w=600&auto=format&fit=crop'
  ],
  'Earrings': [
    'https://images.unsplash.com/photo-1635767798638-3e25273a8236?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?q=80&w=600&auto=format&fit=crop'
  ],
  'Pendant': [
    'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?q=80&w=600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=600&auto=format&fit=crop'
  ],
  'Anklet': [
    'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?q=80&w=600&auto=format&fit=crop'
  ]
};

function getOnlineImageForProduct(category, index) {
  const list = imagesByCategory[category] || imagesByCategory['Ring'];
  return list[index % list.length];
}

async function seed() {
  try {
    const uri = process.env.MONGO_URI;
    console.log('🔌 Connecting to MongoDB for seeding...');
    try {
      await mongoose.connect(uri);
      console.log('✅ Connected to MongoDB Atlas for seeding');
    } catch (connectionError) {
      console.warn('⚠️ MongoDB Atlas Connection failed:', connectionError.message);
      console.log('🔌 Trying fallback to local MongoDB (mongodb://127.0.0.1:27017/swarnika)...');
      await mongoose.connect('mongodb://127.0.0.1:27017/swarnika');
      console.log('✅ Connected to Local MongoDB for seeding');
    }

    // Clear existing records
    await Product.deleteMany();

    const metals = ['Gold', 'Silver', 'Platinum', 'Rose Gold'];
    const categories = ['Necklace', 'Bracelet', 'Ring', 'Earrings', 'Pendant', 'Anklet'];
    const adjectives = [
      'Majestic', 'Lustrous', 'Royal', 'Celestial', 'Imperial', 
      'Vintage', 'Minimalist', 'Radiant', 'Classic', 'Eternal', 
      'Ethereal', 'Divine', 'Infinite', 'Graceful', 'Sophisticated', 
      'Sleek', 'Delicate', 'Opulent', 'Glimmering', 'Enchanted'
    ];
    const nouns = [
      'Bloom', 'Moon', 'Star', 'Petal', 'Cascade', 
      'Horizon', 'Dusk', 'Dawn', 'Ocean', 'Forest', 
      'Meadow', 'Whisper', 'Melody', 'Harmony', 'Eternity', 
      'Serenity', 'Essence', 'Aura', 'Solitude', 'Glow'
    ];

    const products = [];
    
    while (products.length < 105) {
      const idx = products.length;
      const metal = metals[idx % metals.length];
      const category = categories[idx % categories.length];
      const adj = adjectives[idx % adjectives.length];
      const noun = nouns[idx % nouns.length];
      
      const name = `${adj} ${metal} ${noun} ${category}`;
      
      // Determine price based on metal and category - realistic market rates for fine luxury jewellery (e.g. Gold Necklace is in Lakhs)
      let basePrice = 50000;
      let multiplier = 1.0;
      
      if (category === 'Necklace') multiplier = 3.5; // e.g. Gold Necklace is base 1.75 Lakhs
      else if (category === 'Bracelet') multiplier = 2.2; // e.g. Gold Bracelet is base 1.1 Lakhs
      else if (category === 'Ring') multiplier = 1.0; // e.g. Gold Ring is base 50k
      else if (category === 'Earrings') multiplier = 1.4; // e.g. Gold Earrings are base 70k
      else if (category === 'Pendant') multiplier = 0.8;
      else if (category === 'Anklet') multiplier = 1.2;
      
      if (metal === 'Platinum') {
        basePrice = 70000;
      } else if (metal === 'Gold') {
        basePrice = 50000;
      } else if (metal === 'Rose Gold') {
        basePrice = 55000;
      } else if (metal === 'Silver') {
        basePrice = 6000;
      }
      
      // Compute price: basePrice * multiplier + variation offset
      const variation = (idx * 1157) % (basePrice * 0.4);
      const price = Math.round(basePrice * multiplier + variation);
      
      const description = `A beautiful and unique ${adj.toLowerCase()} ${metal.toLowerCase()} ${category.toLowerCase()} featuring the exquisite ${noun.toLowerCase()} design. Handcrafted to perfection for timeless elegance.`;
      
      // Generate a deterministic 24-character ObjectId based on products.length to keep product IDs stable
      const hexId = "507f1f77bcf86cd799" + idx.toString(16).padStart(6, '0');
      const productId = new mongoose.Types.ObjectId(hexId);
      
      products.push({
        _id: productId,
        name,
        price,
        description,
        image: getOnlineImageForProduct(category, idx),
        category,
        metal: metal.toLowerCase(),
        stock: 99
      });
    }

    // Insert products into database
    await Product.insertMany(products);
    console.log(`✅ ${products.length} Products seeded successfully with stable ObjectIds`);
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding products:', err);
    process.exit(1);
  }
}

seed();
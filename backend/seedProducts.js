const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');

dotenv.config();

// Function to assign correct image based on product name keywords
function getImageForProduct(name) {
  const lower = name.toLowerCase();
  let imageName = 'default.avif';
  if (lower.includes('gold')) imageName = 'gold.avif';
  else if (lower.includes('silver')) imageName = 'silver.avif';
  else if (lower.includes('platinum')) imageName = 'platinum.avif';
  // Use an explicit local backend image URL pointing at 127.0.0.1 so seeded
  // products have working images when developing via 127.0.0.1.
  // Note: frontend image-normalization logic will also handle relative paths,
  // but we keep explicit local URLs here per developer request.
  const imageURL = `http://127.0.0.1:5001/images/${imageName}`;
  console.log(`🖼️ Assigned image for "${name}": ${imageURL}`);
  return imageURL;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected for seeding');

    // Clear existing records
    await Product.deleteMany();

    // Product data
    const products = [
      {
        name: 'Majestic Gold Necklace',
        price: 15999,
        description: 'A handcrafted 22K gold-plated necklace featuring intricate filigree detailing inspired by royal artistry. Perfect for weddings and grand occasions.',
        image: getImageForProduct('Majestic Gold Necklace'),
        category: 'Necklace'
      },
      {
        name: 'Lustrous Silver Bracelet',
        price: 3999,
        description: 'A sleek sterling silver bracelet crafted with precision to complement modern elegance and everyday luxury.',
        image: getImageForProduct('Lustrous Silver Bracelet'),
        category: 'Bracelet'
      },
      {
        name: 'Platinum Grace Ring',
        price: 17999,
        description: 'An elegant platinum ring set with a single diamond, symbolizing eternal love and sophistication.',
        image: getImageForProduct('Platinum Grace Ring'),
        category: 'Ring'
      },
      {
        name: 'Golden Bloom Earrings',
        price: 6499,
        description: 'A pair of gold earrings designed in a floral motif that reflects radiance and timeless beauty.',
        image: getImageForProduct('Golden Bloom Earrings'),
        category: 'Earrings'
      },
      {
        name: 'Silver Moon Pendant',
        price: 4999,
        description: 'A crescent-shaped silver pendant representing calmness and charm, perfect for evening attire.',
        image: getImageForProduct('Silver Moon Pendant'),
        category: 'Pendant'
      },
      {
        name: 'Platinum Essence Anklet',
        price: 7999,
        description: 'A delicate platinum anklet with a fine chain and minimalist aesthetic that enhances every step with grace.',
        image: getImageForProduct('Platinum Essence Anklet'),
        category: 'Anklet'
      },
      {
        name: 'Regal Gold Bangles',
        price: 10999,
        description: 'A set of intricately carved gold bangles designed to add a royal touch to festive wear.',
        image: getImageForProduct('Regal Gold Bangles'),
        category: 'Bracelet'
      },
      {
        name: 'Silver Petal Necklace',
        price: 5799,
        description: 'A silver necklace featuring petal-shaped links symbolizing delicate beauty and modern artistry.',
        image: getImageForProduct('Silver Petal Necklace'),
        category: 'Necklace'
      },
      {
        name: 'Platinum Star Pendant',
        price: 8999,
        description: 'A platinum pendant inspired by celestial charm, making it a perfect gift for your loved one.',
        image: getImageForProduct('Platinum Star Pendant'),
        category: 'Pendant'
      },
      {
        name: 'Golden Whispers Ring',
        price: 5899,
        description: 'An elegantly designed gold ring featuring smooth curves and a polished finish for understated beauty.',
        image: getImageForProduct('Golden Whispers Ring'),
        category: 'Ring'
      },
      {
        name: 'Silver Twilight Earrings',
        price: 4599,
        description: 'Silver earrings with a minimalist design that captures the beauty of dusk in its refined craftsmanship.',
        image: getImageForProduct('Silver Twilight Earrings'),
        category: 'Earrings'
      },
      {
        name: 'Platinum Harmony Bracelet',
        price: 9999,
        description: 'A timeless platinum bracelet symbolizing unity and balance, ideal for both formal and casual wear.',
        image: getImageForProduct('Platinum Harmony Bracelet'),
        category: 'Bracelet'
      },
      {
        name: 'Golden Aura Necklace',
        price: 13499,
        description: 'A radiant gold necklace that blends tradition and modern aesthetics with delicate artistry.',
        image: getImageForProduct('Golden Aura Necklace'),
        category: 'Necklace'
      },
      {
        name: 'Silver Dew Earrings',
        price: 3799,
        description: 'Dainty silver earrings resembling morning dew, capturing simplicity and purity.',
        image: getImageForProduct('Silver Dew Earrings'),
        category: 'Earrings'
      },
      {
        name: 'Platinum Infinity Ring',
        price: 18999,
        description: 'A stunning platinum infinity ring representing eternal connection and style.',
        image: getImageForProduct('Platinum Infinity Ring'),
        category: 'Ring'
      },
      {
        name: 'Golden Horizon Pendant',
        price: 7399,
        description: 'A pendant inspired by the sunrise, designed in gold with radiant charm for every occasion.',
        image: getImageForProduct('Golden Horizon Pendant'),
        category: 'Pendant'
      },
      {
        name: 'Silver Melody Anklet',
        price: 4199,
        description: 'A beautifully crafted silver anklet with jingling charm that embodies joyful motion.',
        image: getImageForProduct('Silver Melody Anklet'),
        category: 'Anklet'
      },
      {
        name: 'Platinum Eternity Necklace',
        price: 21499,
        description: 'A luxury platinum necklace representing timeless grace and refinement, ideal for grand celebrations.',
        image: getImageForProduct('Platinum Eternity Necklace'),
        category: 'Necklace'
      },
      {
        name: 'Golden Radiance Earrings',
        price: 6299,
        description: 'Gold earrings with polished texture and intricate carving, radiating elegance in every glance.',
        image: getImageForProduct('Golden Radiance Earrings'),
        category: 'Earrings'
      },
      {
        name: 'Silver Charm Ring',
        price: 3399,
        description: 'A chic silver ring featuring a minimalist charm design for contemporary styling.',
        image: getImageForProduct('Silver Charm Ring'),
        category: 'Ring'
      },
      {
        name: 'Golden Legacy Bracelet',
        price: 10499,
        description: 'Gold bracelet symbolizing tradition, crafted with refined motifs and superior craftsmanship.',
        image: getImageForProduct('Golden Legacy Bracelet'),
        category: 'Bracelet'
      },
      {
        name: 'Platinum Bloom Earrings',
        price: 8499,
        description: 'Delicate platinum earrings featuring a floral bloom design that highlights subtle sophistication.',
        image: getImageForProduct('Platinum Bloom Earrings'),
        category: 'Earrings'
      },
      {
        name: 'Silver Cascade Necklace',
        price: 6899,
        description: 'Silver necklace with cascading design that exudes luxury and grace in every detail.',
        image: getImageForProduct('Silver Cascade Necklace'),
        category: 'Necklace'
      },
      {
        name: 'Golden Dusk Pendant',
        price: 7799,
        description: 'Gold pendant inspired by the serene glow of dusk, radiating timeless allure.',
        image: getImageForProduct('Golden Dusk Pendant'),
        category: 'Pendant'
      },
      {
        name: 'Platinum Serenity Ring',
        price: 16999,
        description: 'A sophisticated platinum ring that embodies calmness and refined luxury.',
        image: getImageForProduct('Platinum Serenity Ring'),
        category: 'Ring'
      }
    ];

    // Ensure we seed exactly 25 products for local development as requested.
    if (products.length > 25) products.splice(25);
    if (products.length < 25) {
      console.warn(`⚠️ Only ${products.length} base products available; duplicating to reach 25 entries.`);
      // Duplicate last product with a small suffix until we have 25
      while (products.length < 25) {
        const last = products[products.length - 1];
        const clone = { ...last, name: `${last.name} Copy ${products.length + 1}` };
        clone.image = getImageForProduct(clone.name);
        products.push(clone);
      }
    }

    // Insert products into database (exactly 25)
    await Product.insertMany(products);
    console.log(`✅ ${products.length} Products seeded successfully`);
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding products:', err);
    process.exit(1);
  }
}

seed();
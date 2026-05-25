const mongoose = require("mongoose");
const Product = require("./models/Product");
require("dotenv").config();
const path = require("path");

async function update() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for image path update");

  const products = await Product.find({});
  let updated = 0;
  for (const p of products) {
    if (!p.image) continue;
    const img = p.image;
    // Look for localhost or 127 references and convert to relative /images/filename
    const m = img.match(
      /(?:https?:\/\/)?(?:127\.0\.0\.1|localhost)(?::\d+)?\/(?:images\/)??(.+)$/i
    );
    if (m && m[1]) {
      const file = path.basename(m[1]);
      const newPath = `/images/${file}`;
      if (p.image !== newPath) {
        p.image = newPath;
        await p.save();
        updated++;
        console.log(`Updated ${p._id} image -> ${newPath}`);
      }
    }
  }
  console.log(`Done. Updated ${updated} products.`);
  process.exit(0);
}

update().catch((err) => {
  console.error("Error updating images", err);
  process.exit(1);
});

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ✅ Define database path
const dbFile = path.join(__dirname, 'database.sqlite');

// ✅ Initialize and connect to SQLite
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Failed to connect to database:", err.message);
  } else {
    console.log("✅ Connected to SQLite database:", dbFile);
  }
});

// ✅ Enable foreign key support
db.run("PRAGMA foreign_keys = ON", (err) => {
  if (err) {
    console.error("⚠️ Failed to enable foreign keys:", err.message);
  } else {
    console.log("✅ Foreign key support enabled in SQLite");
  }
});

// ✅ Initialize schema
db.serialize(() => {
  // USERS TABLE
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // PRODUCTS TABLE
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    category TEXT,
    metal TEXT,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    weight REAL,
    description TEXT,
    image_url TEXT
  )`);

  // CARTS TABLE
  db.run(`CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // CART ITEMS TABLE
  db.run(`CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_add REAL NOT NULL,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);

  // ORDERS TABLE
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_total REAL NOT NULL,
    status TEXT DEFAULT 'Processing',
    payment_mode TEXT,
    payment_status TEXT DEFAULT 'Pending',
    shipping_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ORDER ITEMS TABLE
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`);

  // ✅ Indexes for performance
  db.run("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
  db.run("CREATE INDEX IF NOT EXISTS idx_cart_user ON carts(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_order_user ON orders(user_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)");

  // ✅ Optional: Pre-seed demo products if DB empty
  db.get("SELECT COUNT(*) AS count FROM products", (err, row) => {
    if (err) {
      console.error("❌ Error checking product count:", err.message);
    } else if (row.count === 0) {
      console.log("🪴 Seeding sample products...");
      const stmt = db.prepare(
        "INSERT INTO products (name, sku, category, metal, price, stock, weight, description, image_url) VALUES (?,?,?,?,?,?,?,?,?)"
      );
      const categories = ['Ring', 'Necklace', 'Bracelet', 'Earrings'];
      const metals = ['Gold', 'Silver', 'Platinum', 'Rose Gold'];
      for (let i = 1; i <= 20; i++) {
        const category = categories[i % categories.length];
        const metal = metals[i % metals.length];
        const name = `${metal} ${category} ${i}`;
        const sku = `${metal.slice(0, 2).toUpperCase()}-${category.slice(0, 2).toUpperCase()}-${i.toString().padStart(3, '0')}`;
        const price = Math.round(Math.random() * 9000 + 2000);
        const stock = Math.floor(Math.random() * 10) + 1;
        const weight = (Math.random() * 10 + 1).toFixed(2);
        const description = `Elegant ${metal.toLowerCase()} ${category.toLowerCase()} perfect for any occasion.`;
        const image = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop';
        stmt.run(name, sku, category, metal, price, stock, weight, description, image);
      }
      stmt.finalize(() => console.log("✅ Sample products seeded"));
    }
  });
});

module.exports = db;
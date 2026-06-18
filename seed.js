import db from "#db/client";
import { createUser } from "#db/queries/users";
import { createProduct } from "#db/queries/products";
import { createOrder } from "#db/queries/orders";
import { addProductToOrder } from "#db/queries/orders_products";

await db.connect();
await seed();
await db.end();
console.log("🌱 Database seeded.");

async function seed() {
  const user = await createUser("admin", "admin123");

  const productData = [
    ["Coffee Mug", "Ceramic mug that holds 12oz of your favorite drink.", 12.99],
    ["Notebook", "A5 dotted notebook with 192 pages.", 8.5],
    ["Mechanical Keyboard", "Hot-swappable 65% keyboard with brown switches.", 89.0],
    ["Desk Lamp", "Adjustable LED lamp with three brightness levels.", 34.95],
    ["Water Bottle", "Insulated stainless steel bottle, 24oz.", 21.0],
    ["Backpack", "Weatherproof backpack with laptop sleeve.", 59.99],
    ["Wireless Mouse", "Ergonomic wireless mouse with silent clicks.", 27.5],
    ["Headphones", "Over-ear noise-cancelling headphones.", 149.99],
    ["Plant Pot", "Terracotta pot with drainage tray.", 14.25],
    ["Sticky Notes", "Pack of 12 colorful sticky note pads.", 6.75],
    ["Phone Stand", "Aluminum adjustable phone stand.", 16.0],
    ["Travel Tumbler", "Leak-proof tumbler for hot and cold drinks.", 19.5],
  ];

  const products = [];
  for (const [title, description, price] of productData) {
    products.push(await createProduct(title, description, price));
  }

  const order = await createOrder("2024-01-15", "First order", user.id);

  // Add 5 distinct products to the order
  for (let i = 0; i < 5; i++) {
    await addProductToOrder(order.id, products[i].id, i + 1);
  }
}

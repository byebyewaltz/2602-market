import db from "#db/client";
import { createUser } from "#db/queries/users";
import { createProduct } from "#db/queries/products";
import { createOrder } from "#db/queries/orders";
import { addProductToOrder } from "#db/queries/orders_products";
import PRODUCTS from "./products.json" with { type: "json" };

await db.connect();

const user = await createUser("admin", "admin123");
const products = await Promise.all(
  PRODUCTS.map((p) => createProduct(p.title, p.description, p.price))
);

// One order containing the first 5 distinct products (quantities 1–5).
const order = await createOrder("2024-01-15", "First order", user.id);
await Promise.all(
  products.slice(0, 5).map((p, i) => addProductToOrder(order.id, p.id, i + 1))
);

await db.end();
console.log("🌱 Database seeded.");

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

  // 12 products
  const products = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      createProduct(`Product ${i + 1}`, `Description for product ${i + 1}`, (i + 1) * 9.99)
    )
  );

  // One order containing the first 6 products (quantities 1–6)
  const order = await createOrder("2025-01-15", "First order", user.id);
  await Promise.all(
    products.slice(0, 6).map((p, i) => addProductToOrder(order.id, p.id, i + 1))
  );
}
import db from "#db/client";

/**
 * Adds a product to an order (or updates the quantity if it already exists)
 * and returns the orders_products record.
 */
export async function addProductToOrder(orderId, productId, quantity) {
  const sql = `
    INSERT INTO orders_products (order_id, product_id, quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (order_id, product_id)
    DO UPDATE SET quantity = orders_products.quantity + EXCLUDED.quantity
    RETURNING order_id, product_id, quantity
  `;
  const {
    rows: [record],
  } = await db.query(sql, [orderId, productId, quantity]);
  return record;
}

/**
 * Returns the products in an order, each with its line-item quantity.
 */
export async function getProductsByOrderId(orderId) {
  const sql = `
    SELECT p.id, p.title, p.description, p.price, op.quantity
    FROM orders_products op
    JOIN products p ON p.id = op.product_id
    WHERE op.order_id = $1
    ORDER BY p.id
  `;
  const { rows } = await db.query(sql, [orderId]);
  return rows;
}

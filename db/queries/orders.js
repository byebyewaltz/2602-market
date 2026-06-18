import db from "#db/client";

/** Creates an order for a user and returns it. */
export async function createOrder(date, note, userId) {
  const sql = `
    INSERT INTO orders (date, note, user_id)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const {
    rows: [order],
  } = await db.query(sql, [date, note, userId]);
  return order;
}

/** Returns all orders made by a given user. */
export async function getOrdersByUserId(userId) {
  const sql = `
    SELECT *
    FROM orders
    WHERE user_id = $1
    ORDER BY id
  `;
  const { rows } = await db.query(sql, [userId]);
  return rows;
}

/** Returns a single order by id, or undefined if it does not exist. */
export async function getOrderById(id) {
  if (!Number.isInteger(Number(id))) return undefined;
  const sql = `
    SELECT *
    FROM orders
    WHERE id = $1
  `;
  const {
    rows: [order],
  } = await db.query(sql, [id]);
  return order;
}

/**
 * Returns all orders made by a user that include a given product.
 */
export async function getOrdersByUserIdAndProductId(userId, productId) {
  const sql = `
    SELECT o.*
    FROM orders o
    JOIN orders_products op ON op.order_id = o.id
    WHERE o.user_id = $1 AND op.product_id = $2
    ORDER BY o.id
  `;
  const { rows } = await db.query(sql, [userId, productId]);
  return rows;
}

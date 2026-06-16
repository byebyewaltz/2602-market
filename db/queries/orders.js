import db from "#db/client";

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

export async function getOrdersByUserId(userId) {
  const sql = `
    SELECT *
    FROM orders
    WHERE user_id = $1
  `;
  const { rows: orders } = await db.query(sql, [userId]);
  return orders;
}

export async function getOrderById(id) {
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

/** Orders made by the given user that include the given product */
export async function getOrdersByUserIdAndProductId(userId, productId) {
  const sql = `
    SELECT orders.*
    FROM orders
    JOIN orders_products AS op ON op.order_id = orders.id
    WHERE orders.user_id = $1 AND op.product_id = $2
  `;
  const { rows: orders } = await db.query(sql, [userId, productId]);
  return orders;
}

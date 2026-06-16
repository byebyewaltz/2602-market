import db from "#db/client";

export async function addProductToOrder(orderId, productId, quantity) {
  const sql = `
    INSERT INTO orders_products (order_id, product_id, quantity)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const {
    rows: [orderProduct],
  } = await db.query(sql, [orderId, productId, quantity]);
  return orderProduct;
}


/** Products belonging to the given order */
export async function getProductsByOrderId(orderId) {
  const sql = `
    SELECT products.*, op.quantity
    FROM products
    JOIN orders_products AS op ON op.product_id = products.id
    WHERE op.order_id = $1
  `;
  const { rows: products } = await db.query(sql, [orderId]);
  return products;
}
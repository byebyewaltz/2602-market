import db from "#db/client";

/** Creates a product and returns it. */
export async function createProduct(title, description, price) {
  const sql = `
    INSERT INTO products (title, description, price)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const {
    rows: [product],
  } = await db.query(sql, [title, description, price]);
  return product;
}

/** Returns all products. */
export async function getProducts() {
  const sql = `
    SELECT *
    FROM products
    ORDER BY id
  `;
  const { rows } = await db.query(sql);
  return rows;
}

/** Returns a single product by id, or undefined if it does not exist. */
export async function getProductById(id) {
  if (!Number.isInteger(Number(id))) return undefined;
  const sql = `
    SELECT *
    FROM products
    WHERE id = $1
  `;
  const {
    rows: [product],
  } = await db.query(sql, [id]);
  return product;
}

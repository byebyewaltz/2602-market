import express from "express";
const router = express.Router();
export default router;

import requireUser from "#middleware/requireUser";
import { getProducts, getProductById } from "#db/queries/products";
import { getOrdersByUserIdAndProductId } from "#db/queries/orders";

router.get("/", async (req, res) => {
  const products = await getProducts();
  res.send(products);
});

// 🔒 Protected. A missing/invalid token must 401 *before* the product
// existence check. This route uses the param name `:productId` so the
// public `router.param("id")` handler below does NOT intercept it and
// 404 ahead of the auth check.
router.get("/:productId/orders", requireUser, async (req, res) => {
  const product = await getProductById(req.params.productId);
  if (!product) return res.status(404).send("Product not found.");

  const orders = await getOrdersByUserIdAndProductId(req.user.id, product.id);
  res.send(orders);
});

// Public single-product lookup.
router.param("id", async (req, res, next, id) => {
  const product = await getProductById(id);
  if (!product) return res.status(404).send("Product not found.");
  req.product = product;
  next();
});

router.get("/:id", (req, res) => {
  res.send(req.product);
});

import express from "express";
const router = express.Router();
export default router;

import requireUser from "#middleware/requireUser";
import {
  createOrder,
  getOrdersByUserId,
  getOrderById,
} from "#db/queries/orders";
import { getProductById } from "#db/queries/products";
import {
  addProductToOrder,
  getProductsByOrderId,
} from "#db/queries/orders_products";

// 🔒 Every order route is protected. requireUser runs first, so any request
// without a valid token gets 401 before any other check.
router.use(requireUser);

// 🔒 POST /orders — 400 if no date, else create and 201.
router.post("/", async (req, res) => {
  const { date, note } = req.body;
  if (!date) return res.status(400).send("Date is required.");

  const order = await createOrder(date, note ?? null, req.user.id);
  res.status(201).send(order);
});

// 🔒 GET /orders — all orders made by the logged-in user.
router.get("/", async (req, res) => {
  const orders = await getOrdersByUserId(req.user.id);
  res.send(orders);
});

// Resolve :id for every order route below. 404 if the order is absent,
// 403 if it belongs to a different user. Runs after requireUser (above),
// so the auth check always comes first.
router.param("id", async (req, res, next, id) => {
  const order = await getOrderById(id);
  if (!order) return res.status(404).send("Order not found.");
  if (order.user_id !== req.user.id) {
    return res.status(403).send("Forbidden.");
  }
  req.order = order;
  next();
});

// 🔒 GET /orders/:id — the order itself (ownership enforced in param).
router.get("/:id", (req, res) => {
  res.send(req.order);
});

// 🔒 POST /orders/:id/products — add a line item.
// Order: 404/403 (param) -> 400 missing fields -> 400 bad product -> 201.
router.post("/:id/products", async (req, res) => {
  const { productId, quantity } = req.body;
  if (
    productId === undefined ||
    productId === null ||
    quantity === undefined ||
    quantity === null
  ) {
    return res.status(400).send("productId and quantity are required.");
  }

  const product = await getProductById(productId);
  if (!product) return res.status(400).send("Product does not exist.");

  const orderProduct = await addProductToOrder(
    req.order.id,
    productId,
    quantity
  );
  res.status(201).send(orderProduct);
});

// 🔒 GET /orders/:id/products — products in the order (ownership enforced).
router.get("/:id/products", async (req, res) => {
  const products = await getProductsByOrderId(req.order.id);
  res.send(products);
});

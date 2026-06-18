import express from "express";
const app = express();
export default app;

import getUserFromToken from "#middleware/getUserFromToken";
import usersRouter from "#api/users";
import productsRouter from "#api/products";
import ordersRouter from "#api/orders";

// Serve the front-end SPA from /public
app.use(express.static("public"));

app.use(express.json());
app.use(getUserFromToken);

app.use("/users", usersRouter);
app.use("/products", productsRouter);
app.use("/orders", ordersRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Something went wrong.");
});

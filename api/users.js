import express from "express";
const router = express.Router();
export default router;

import { createToken } from "#utils/jwt";
import {
  createUser,
  getUserByUsernameAndPassword,
} from "#db/queries/users";

router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Username and password required.");
  }

  const user = await createUser(username, password);
  const token = createToken({ id: user.id });
  res.status(201).send(token);
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Username and password required.");
  }

  const user = await getUserByUsernameAndPassword(username, password);
  if (!user) return res.status(401).send("Invalid credentials.");

  const token = createToken({ id: user.id });
  res.send(token);
});

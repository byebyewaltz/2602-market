import db from "#db/client";
import bcrypt from "bcrypt";

/**
 * Creates a user with a bcrypt-hashed password and returns the new record
 * (without the password hash).
 */
export async function createUser(username, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const sql = `
    INSERT INTO users (username, password)
    VALUES ($1, $2)
    RETURNING id, username
  `;
  const {
    rows: [user],
  } = await db.query(sql, [username, hashedPassword]);
  return user;
}

/** Returns a user by id (without the password hash). */
export async function getUserById(id) {
  const sql = `
    SELECT id, username
    FROM users
    WHERE id = $1
  `;
  const {
    rows: [user],
  } = await db.query(sql, [id]);
  return user;
}

/**
 * Returns the user if the username exists and the password matches the stored
 * hash, otherwise undefined.
 */
export async function getUserByUsernameAndPassword(username, password) {
  const sql = `
    SELECT id, username, password
    FROM users
    WHERE username = $1
  `;
  const {
    rows: [user],
  } = await db.query(sql, [username]);
  if (!user) return undefined;

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) return undefined;

  return { id: user.id, username: user.username };
}

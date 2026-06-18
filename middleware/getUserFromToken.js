import { verifyToken } from "#utils/jwt";
import { getUserById } from "#db/queries/users";

/** Reads a Bearer token, verifies it, and attaches the user to the request. */
export default async function getUserFromToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const token = authHeader.replace(/^Bearer\s+/i, "");
  try {
    const { id } = verifyToken(token);
    const user = await getUserById(id);
    req.user = user;
  } catch {
    // Invalid token: leave req.user undefined; protected routes will 401.
  }
  next();
}

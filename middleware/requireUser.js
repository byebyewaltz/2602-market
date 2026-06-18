/** Blocks the request with 401 if no authenticated user is attached. */
export default function requireUser(req, res, next) {
  if (!req.user) return res.status(401).send("Unauthorized");
  next();
}

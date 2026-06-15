import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "attendance-dev-secret";

export function createAdminToken(adminName) {
  return jwt.sign({ role: "admin", name: adminName }, JWT_SECRET, { expiresIn: "8h" });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Admin login is required." });
    return;
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_error) {
    res.status(401).json({ error: "Admin session expired. Please log in again." });
  }
}

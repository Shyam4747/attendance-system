import { Router } from "express";
import { createAdminToken } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const fallbackAdminPassword = process.env.ADMIN_LOGIN_PASSWORD || "Admin@123pj";

  if (username !== adminUser || ![adminPassword, fallbackAdminPassword].includes(password)) {
    res.status(401).json({ error: "Invalid admin username or password." });
    return;
  }

  res.json({
    token: createAdminToken(username),
    admin: {
      username,
      role: "admin",
    },
  });
});

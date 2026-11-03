import { Router } from "express";
import { login, register, me, updateMe } from "../controllers/authController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
const router = Router();
router.post("/register", register); router.post("/login", login); router.get("/me", optionalAuth, requireAuth, me); router.patch("/me", optionalAuth, requireAuth, updateMe);
export default router;

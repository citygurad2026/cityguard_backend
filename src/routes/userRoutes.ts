import { Router } from "express";
import {
  registerUser,
  loginUser,
  getUser,
  updateUser,
  deleteUser,
  refreshToken,
  getUsers,
  getActiveSessions,
  adminCreateUser,
  
} from "../controllers/Users/userController";

import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";

const router = Router();

/* ============================
        AUTH ROUTES
============================ */
router.post("/create",adminCreateUser)
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshToken);
router.get("/active",getActiveSessions)
/* ============================
        USER ROUTES
============================ */

// جلب مستخدم (يتطلب تسجيل دخول)
router.get("/get-all",getUsers)
router.get("/getUser/:id", getUser);


// تحديث مستخدم (مسموح لصاحب الحساب أو Admin)
router.patch(
  "/update/:id",
  authMiddleware,
  (req: any, res, next) => {
    if (req.user.role === "ADMIN" || req.user.id === Number(req.params.id)) {
      return next();
    }
    return res.status(403).json({ message: "Forbidden" });
  },
  updateUser
);

// حذف مستخدم (Admin فقط)
router.delete(
  "/delete/:id",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  deleteUser
);


export default router;

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
  logoutUser,
  updateProfile,
  
} from "../controllers/Users/userController";

import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";
import { AuthRequest } from "../middlewares/authMiddleware";
const userRoutes = Router();

/* ============================
        AUTH ROUTES
============================ */
userRoutes.post("/create",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  adminCreateUser)
userRoutes.post("/register", registerUser);
userRoutes.post("/login", loginUser);
userRoutes.post('/logout',logoutUser)
userRoutes.post("/refresh-token", refreshToken);
userRoutes.get("/getUser/:id", getUser);
userRoutes.get(
  "/get-all",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  getUsers
);
userRoutes.get(
  "/auth/me",
  authMiddleware,
  (req: AuthRequest, res) => {
    res.status(200).json({
      user: req.user
    });
  }
);


userRoutes.get(
  "/active",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  getActiveSessions
);




// تحديث مستخدم (مسموح لصاحب الحساب أو Admin)
userRoutes.patch(
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
// تحديث مستخدم ()
userRoutes.patch(
  "/updateprofile/:id",
  authMiddleware,
  updateProfile
);

// حذف مستخدم (Admin فقط)
userRoutes.delete(
  "/delete/:id",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  deleteUser
);



export default userRoutes;

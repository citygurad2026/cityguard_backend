import express from "express";
import adController from "../controllers/Advertising/adController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { upload } from "../middlewares/uploadMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";

const adrouter = express.Router();

// ==== راوترات عامة للجميع ====
adrouter.get("/get-public", adController.getPublicAds); // متاح للجميع
adrouter.get("/get-adstype/:type", adController.getAdsByType); // متاح للجميع

// ==== زيادة النقرات ====
// يمكن لأي شخص مسجل الدخول (أو يمكن فتحه للجميع إذا تريد)
adrouter.post("/increment/:id/click", adController.incrementClicks);

// ==== إنشاء إعلان ====
adrouter.post(
  "/create-add",
  authMiddleware,
  roleMiddleware(["ADMIN", "OWNER"]),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
    { name: "tabletImage", maxCount: 1 },
  ]),
  adController.createAd
);

// ==== جلب جميع الإعلانات (للإدارة) ====
adrouter.get("/get-all", authMiddleware, roleMiddleware(["ADMIN", "OWNER"]), adController.getAllAds);

// ==== جلب الإعلانات الخاصة بالمالك ====
adrouter.get("/get-my", authMiddleware, roleMiddleware(["OWNER"]), adController.getMyAds);

// ==== جلب إعلان بالمعرف ====
adrouter.get("/get-add/:id", authMiddleware, roleMiddleware(["ADMIN", "OWNER"]), adController.getAdById);

// ==== تحديث حالة الإعلان (للادمن فقط) ====
adrouter.put(
  "/update-states/:id/status",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  adController.updateAdStatus
);

// ==== تعديل إعلان (ADMIN أو OWNER حسب ملكيته) ====
adrouter.put(
  "/update-ad/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
    { name: "tabletImage", maxCount: 1 },
  ]),
  authMiddleware,
  roleMiddleware(["ADMIN", "OWNER"]),
  adController.updateAd
);

// ==== حذف إعلان (للادمن فقط) ====
adrouter.delete(
  "/delete-add/:id",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  adController.deleteAd
);

export default adrouter;

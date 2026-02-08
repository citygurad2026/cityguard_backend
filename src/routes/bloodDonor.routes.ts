import { Router } from "express";
import bloodDonorController from "../controllers/BloodDonor/bloodDonorController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";

const bloodDonorRouter = Router();

// ==== PUBLIC ROUTES ====
bloodDonorRouter.get("/blood-donors/search", bloodDonorController.searchDonors);
bloodDonorRouter.get("/blood-donors/statistics", bloodDonorController.getDonorStatistics);

// ==== AUTHENTICATED ROUTES ====
bloodDonorRouter.post("/blood-donors/register", authMiddleware, bloodDonorController.registerDonor);
bloodDonorRouter.get("/blood-donors/my-profile", authMiddleware, bloodDonorController.getDonorProfile);
bloodDonorRouter.put("/blood-donors/status", authMiddleware, bloodDonorController.updateDonorStatus);
bloodDonorRouter.put("/blood-donors/updateprofile", authMiddleware, bloodDonorController.updateDonorProfile);
bloodDonorRouter.put("/blood-donors/last-donation", authMiddleware, bloodDonorController.updateLastDonation);

// ==== ADMIN ROUTES ====
bloodDonorRouter.get("/blood-donors", 
  authMiddleware, 
  roleMiddleware(["ADMIN"]), 
  bloodDonorController.getAllDonors
);

export default bloodDonorRouter;
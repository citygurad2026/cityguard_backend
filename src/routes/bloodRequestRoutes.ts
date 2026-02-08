import { Router } from "express";
import bloodRequestController from "../controllers/BloodRequests/bloodRequestController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";

const bloodRouter = Router();

// ==== PUBLIC ROUTES ====
bloodRouter.get("/blood-requests", bloodRequestController.getAllRequests);
bloodRouter.get("/blood-requests/search", bloodRequestController.searchRequests);
bloodRouter.get("/blood-requests/statistics", bloodRequestController.getStatistics);
bloodRouter.get("/blood-requests/:id", bloodRequestController.getRequestById);
bloodRouter.get("/blood-requests/:id/match-donors", bloodRequestController.matchDonors)

// ==== AUTHENTICATED ROUTES ====
bloodRouter.post("/blood-requests",bloodRequestController.createRequest);
bloodRouter.get("/my/blood-requests", authMiddleware, bloodRequestController.getMyRequests);

// ==== OWNER ROUTES ====
bloodRouter.put("/blood-requests/:id",authMiddleware, bloodRequestController.updateRequest);
bloodRouter.delete("/blood-requests/:id",authMiddleware, bloodRequestController.deleteRequest);

// ==== ADMIN ROUTES ====
bloodRouter.put("/blood-requests/:id/status", 
  authMiddleware, 
  roleMiddleware(["ADMIN"]), 
  bloodRequestController.updateStatus
);

export default bloodRouter;
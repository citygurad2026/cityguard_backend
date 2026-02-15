import express from "express";
import jobController from "../controllers/jobs&Professionals/jobController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { roleMiddleware } from "../middlewares/roleMiddleware";


const jobrouter = express.Router();

// ========== المسارات العامة (بدون تسجيل دخول) ==========
jobrouter.get("/featured", jobController.getFeaturedJobs);
jobrouter.get("/search/quick", jobController.quickSearchJobs);
jobrouter.get("/category/:category", jobController.getJobsByCategory);
jobrouter.get("/popular-categories", jobController.getPopularCategories);
jobrouter.get("/notifications/new", jobController.getNewJobsNotification);
jobrouter.get("/mycity", jobController.getJobsInMyCity);
jobrouter.get("/getjob/:id", jobController.getJob);

// ========== مسارات ADMIN فقط ==========
jobrouter.get("/getall",

  jobController.getAllJobs
);

jobrouter.get("/statistics",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  jobController.getJobsStatistics
);

// ========== مسارات OWNER فقط ==========
jobrouter.post("/create",
  authMiddleware,
  roleMiddleware(["OWNER"]),

  jobController.createJob
);

jobrouter.get("/business/myjobs",
  authMiddleware,
  roleMiddleware(["OWNER"]),
  jobController.getBusinessJobs
);

// ========== مسارات ADMIN + OWNER ==========
jobrouter.put("/update/:id",
  authMiddleware,
  roleMiddleware(["ADMIN", "OWNER"]),
  jobController.updateJob
);

jobrouter.delete("/delete/:id",
  authMiddleware,
  roleMiddleware(["ADMIN", "OWNER"]),
  jobController.deleteJob
);

jobrouter.patch("/:id/renew",
  authMiddleware,
  roleMiddleware(["ADMIN", "OWNER"]),
  jobController.renewJob
);

jobrouter.patch("/:id/toggle-status",
  authMiddleware,
  roleMiddleware(["ADMIN", "OWNER"]),
  jobController.toggleJobStatus
);

export default jobrouter;
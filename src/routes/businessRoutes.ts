import { Router } from "express";
import { createBusiness,getOwnerBusinesses,updateBusiness ,getBusinessStats, deleteBusiness, checkUserBusiness, getBusinessById} from "../controllers/Businesses/businessesController";
import { upload } from "../middlewares/uploadMiddleware";
import { authMiddleware } from "../middlewares/authMiddleware";

const BusRouter=Router()

BusRouter.post('/createbusinesses',authMiddleware,upload.array('images', 10), createBusiness);
BusRouter.get('/getbusinesses',authMiddleware, getOwnerBusinesses);
BusRouter.put(
  '/updatebusinesses/:id',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'removeImages', maxCount: 20 },
  ]),
  updateBusiness
);

BusRouter.get('/getbusinesse',authMiddleware, getBusinessById);
BusRouter.delete('/deletebusinesses/:id',authMiddleware, deleteBusiness);
BusRouter.get('/getbusinessesState/:id/stats',authMiddleware, getBusinessStats);
BusRouter.get('/checkUserBusiness',authMiddleware,checkUserBusiness)
export default BusRouter
import { Router } from "express";
import { createBusiness,getOwnerBusinesses,updateBusiness ,getBusinessStats, deleteBusiness, checkUserBusiness, getBusinessById} from "../controllers/Businesses/businessesController";
import { upload } from "../middlewares/uploadMiddleware";
import { authMiddleware } from "../middlewares/authMiddleware";

const router=Router()

router.post('/createbusinesses',authMiddleware,upload.array('images', 10), createBusiness);
router.get('/getbusinesses',authMiddleware, getOwnerBusinesses);
router.put(
  '/updatebusinesses/:id',
  authMiddleware,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'removeImages', maxCount: 20 },
  ]),
  updateBusiness
);

router.get('/getbusinesse/:id',authMiddleware, getBusinessById);
router.delete('/deletebusinesses/:id',authMiddleware, deleteBusiness);
router.get('/getbusinessesState/:id/stats',authMiddleware, getBusinessStats);
router.get('/checkUserBusiness',authMiddleware,checkUserBusiness)
export default router
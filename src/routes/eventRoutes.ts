import { Router } from "express";
import { createEvent ,getBusinessEvents} from "../controllers/Events/eventController";

const router=Router()

router.post('/create-events', createEvent);
router.get('/get-businesses/:businessId/events', getBusinessEvents);
export default router
import { Router } from 'express';
import * as ctrl from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { mongoId, validated } from '../middleware/validate.js';
const router = Router();
router.use(requireAuth);
router.get('/', ctrl.list);
router.patch('/:id/read', mongoId(), validated, ctrl.read);
export default router;

import { Router } from 'express';
import {
  createServiceTypeController,
  getServiceTypeByIDController,
  getAllServiceTypesController,
  updateServiceTypeController,
  deleteServiceTypeController,
  getServiceTypeByNameController
} from '../controller/serviceTypeController.js';
import { validateToken, validateAdmin } from '../middleware/authMiddleware.js';

const router = Router();

// Public routes
router.get('/', getAllServiceTypesController); 
router.get('/:id', getServiceTypeByIDController);
router.get('/name/:name', getServiceTypeByNameController);
// Admin routes
router.post('/',validateToken, validateAdmin, createServiceTypeController);
router.put('/:id', validateToken, validateAdmin, updateServiceTypeController);
router.delete('/:id', validateToken, validateAdmin, deleteServiceTypeController);

export default router;

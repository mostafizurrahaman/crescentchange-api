import { Router } from 'express';
import { auth } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';
import { AdminController } from './admin.controller';

const router = Router();

// all states for dashboard home page
router.get('/states', auth(ROLE.ADMIN), AdminController.getAdminStates);

export const AdminRoutes = router;

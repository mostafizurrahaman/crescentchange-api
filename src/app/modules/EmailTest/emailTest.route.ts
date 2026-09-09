import { Router } from 'express';
import { auth, validateRequest } from '../../middlewares';
import { ROLE } from '../Auth/auth.constant';
import { EmailTestController } from './emailTest.controller';
import { testEmailsSchema } from './emailTest.validation';

const router = Router();

router.post(
  '/test',
  auth(ROLE.ADMIN),
  validateRequest(testEmailsSchema),
  EmailTestController.sendTestEmails
);

export const EmailTestRoutes = router;

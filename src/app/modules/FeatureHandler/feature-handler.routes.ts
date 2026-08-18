

import express from 'express';
import { ROLE } from '../Auth/auth.constant';
import { auth } from '../../middlewares';
import { featuredControllers } from './feature-handler.controllers';


const router = express.Router();

router.post(
  '/',
  auth(ROLE.ADMIN),
  featuredControllers.toggleFeatureEnabled
);


router.get(
  '/',
  featuredControllers.getFeatureHandler
);




export const featureHandlerRoutes = router;

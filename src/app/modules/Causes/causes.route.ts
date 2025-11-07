// src/app/modules/Causes/causes.route.ts
import { Router } from 'express';
import { auth, validateRequest } from '../../middlewares';
import { CauseValidation } from './causes.validation';
import { CauseController } from './causes.controller';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// Get cause names (public route for dropdowns)
router.route('/names').get(CauseController.getCauseNames);

// Create cause and get all causes
router
  .route('/')
  .post(
    auth(ROLE.ORGANIZATION, ROLE.ADMIN),
    validateRequest(CauseValidation.createCauseSchema),
    CauseController.createCause
  )
  .get(
    validateRequest(CauseValidation.getCausesQuerySchema),
    CauseController.getCauses
  );

// Get causes by organization (public route)
router
  .route('/organization/:organizationId')
  .get(
    validateRequest(CauseValidation.getCausesByOrganizationSchema),
    CauseController.getCausesByOrganization
  );

// Get, update, and delete cause by ID
router
  .route('/:id')
  .get(
    validateRequest(CauseValidation.getCauseByIdSchema),
    CauseController.getCauseById
  )
  .patch(
    auth(ROLE.ORGANIZATION, ROLE.ADMIN),
    validateRequest(CauseValidation.updateCauseSchema),
    CauseController.updateCause
  )
  .delete(
    auth(ROLE.ORGANIZATION, ROLE.ADMIN),
    validateRequest(CauseValidation.getCauseByIdSchema),
    CauseController.deleteCause
  );

export const CauseRoutes = router;

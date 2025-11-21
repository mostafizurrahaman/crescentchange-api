// src/app/modules/Causes/causes.route.ts
import { Router } from 'express';
import { auth, validateRequest } from '../../middlewares';
import { CauseValidation } from './causes.validation';
import { CauseController } from './causes.controller';
import { ROLE } from '../Auth/auth.constant';

const router = Router();

// Get cause categories (public route for dropdowns)
router.route('/categories').get(CauseController.getCauseCategories);

// Create cause and get all causes with filters
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

// Get causes by organization (public route with filters)
router
  .route('/organization/:organizationId')
  .get(
    validateRequest(CauseValidation.getCausesByOrganizationSchema),
    CauseController.getCausesByOrganization
  );

// Update cause status (admin only) - Separate endpoint for status updates
router.route('/:id/status').patch(
  auth(ROLE.ADMIN), //: TODO: Update cause status only for admin and organization
  validateRequest(CauseValidation.updateCauseStatusSchema),
  CauseController.updateCauseStatus
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

import express from 'express';
import { PaymentMethodController } from './paymentMethod.controller';
import { PaymentMethodValidation } from './paymentMethod.validation';
import { validateRequest } from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { ROLE } from '../Auth/auth.constant';

const router = express.Router();

// Create setup intent (for collecting payment method)
router.post(
  '/setup-intent',
  auth(ROLE.CLIENT, ROLE.BUSINESS, ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(PaymentMethodValidation.createSetupIntentSchema),
  PaymentMethodController.createSetupIntent
);

// Add payment method
router.post(
  '/',
  auth(ROLE.CLIENT, ROLE.BUSINESS, ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(PaymentMethodValidation.addPaymentMethodSchema),
  PaymentMethodController.addPaymentMethod
);

// Get user's payment methods
router.get(
  '/',
  auth(ROLE.CLIENT, ROLE.BUSINESS, ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(PaymentMethodValidation.getPaymentMethodsSchema),
  PaymentMethodController.getUserPaymentMethods
);

// Get default payment method
router.get(
  '/default',
  auth(ROLE.CLIENT, ROLE.BUSINESS, ROLE.ORGANIZATION, ROLE.ADMIN),
  PaymentMethodController.getDefaultPaymentMethod
);

// Get payment method by ID
router.get(
  '/:id',
  auth(ROLE.CLIENT, ROLE.BUSINESS, ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(PaymentMethodValidation.getPaymentMethodByIdSchema),
  PaymentMethodController.getPaymentMethodById
);

// Set default payment method
router.patch(
  '/:id/default',
  auth(ROLE.CLIENT, ROLE.BUSINESS, ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(PaymentMethodValidation.setDefaultPaymentMethodSchema),
  PaymentMethodController.setDefaultPaymentMethod
);

// Delete payment method
router.delete(
  '/:id',
  auth(ROLE.CLIENT, ROLE.BUSINESS, ROLE.ORGANIZATION, ROLE.ADMIN),
  validateRequest(PaymentMethodValidation.deletePaymentMethodSchema),
  PaymentMethodController.deletePaymentMethod
);

export const PaymentMethodRoutes = router;

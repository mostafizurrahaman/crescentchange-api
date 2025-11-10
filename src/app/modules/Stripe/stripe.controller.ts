import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { StripeValidation } from './stripe.validation';
import { asyncHandler, sendResponse, AppError } from '../../utils';

// 1. Create checkout session for one-time donation
const createCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
  // Get user from request
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Extract validated body (validated by middleware)
  const body = req.body;

  // Prepare data for service
  const checkoutData = {
    ...body,
    userId,
  };

  // Call Stripe service layer
  const session = await StripeService.createCheckoutSession(checkoutData);

  // Send standardized response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Checkout session created successfully',
    data: session,
  });
});

// 2. Retrieve checkout session details
const retrieveCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
  // Get user from request
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Get session ID from request
  const { sessionId } = req.params;
  if (!sessionId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Session ID is required');
  }

  // Call Stripe service layer
  const session = await StripeService.retrieveCheckoutSession(sessionId);

  // Send standardized response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Checkout session retrieved successfully',
    data: session,
  });
});

// 3. Create refund for payment
const createRefund = asyncHandler(async (req: Request, res: Response) => {
  // Get user from request
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Get payment intent ID and optional amount
  const { paymentIntentId, amount } = req.body;

  if (!paymentIntentId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment intent ID is required');
  }

  // Call Stripe service layer
  const refund = await StripeService.createRefund(paymentIntentId, amount);

  // Send standardized response
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Refund created successfully',
    data: refund,
  });
});

export const StripeController = {
  createCheckoutSession,
  retrieveCheckoutSession,
  createRefund,
};

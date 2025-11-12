import httpStatus from 'http-status';
import { Response } from 'express';
import { asyncHandler, sendResponse, AppError } from '../../utils';
import { ExtendedRequest } from '../../types';
import { OrganizationService } from './organization.service';

/**
 * Start Stripe Connect onboarding
 * POST /api/v1/organization/stripe-connect/onboard
 */
const startStripeConnectOnboarding = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const result = await OrganizationService.startStripeConnectOnboarding(
      userId
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Stripe Connect onboarding initiated successfully',
      data: result,
    });
  }
);

/**
 * Get Stripe Connect account status
 * GET /api/v1/organization/stripe-connect/status
 */
const getStripeConnectStatus = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const result = await OrganizationService.getStripeConnectStatus(userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Stripe Connect status retrieved successfully',
      data: result,
    });
  }
);

/**
 * Refresh Stripe Connect onboarding link
 * POST /api/v1/organization/stripe-connect/refresh
 */
const refreshStripeConnectOnboarding = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    const result = await OrganizationService.refreshStripeConnectOnboarding(
      userId
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Onboarding link refreshed successfully',
      data: result,
    });
  }
);

export const OrganizationController = {
  startStripeConnectOnboarding,
  getStripeConnectStatus,
  refreshStripeConnectOnboarding,
};
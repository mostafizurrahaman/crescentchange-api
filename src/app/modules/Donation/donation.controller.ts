import httpStatus from 'http-status';
import { Response } from 'express';

import { asyncHandler, sendResponse, AppError } from '../../utils';
import { ExtendedRequest } from '../../types';
import { DonationService } from './donation.service';
import {
  TGetUserDonationsQuery,
  TGetOrganizationDonationsQuery,
  TProcessPaymentForDonationParams,
  TProcessPaymentForDonationBody,
  TRetryFailedPaymentParams,
} from './donation.validation';

// 1. Create one-time donation
const createOneTimeDonation = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    // Get user from request
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get validated body (validation handled by middleware)
    const body = req.body;

    // Prepare data for service
    const donationData = {
      ...body,
      userId,
    };

    // Call service layer
    const result = await DonationService.createOneTimeDonation(donationData);

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      message: 'Donation created successfully',
      data: result,
    });
  }
);

// 2. Get user donations with pagination and filters
const getUserDonations = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    // Get user from request
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get validated query (validation handled by middleware)
    const validatedQuery = (
      req as unknown as { validatedQuery?: TGetUserDonationsQuery }
    ).validatedQuery;
    const query: TGetUserDonationsQuery =
      validatedQuery || (req.query as unknown as TGetUserDonationsQuery);

    // Prepare filters
    const filters = {
      donor: userId,
      ...(query.status !== 'all' && { status: query.status }),
      ...(query.donationType !== 'all' && { donationType: query.donationType }),
    };

    // Call service layer
    const result = await DonationService.getDonationsByUser(
      userId,
      query.page,
      query.limit,
      filters
    );

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Donations retrieved successfully',
      data: result,
    });
  }
);

// 3. Get specific donation by ID (user must own it)
const getDonationById = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    // Get user from request
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get validated params (validation handled by middleware)
    const { id } = req.params;

    // Call service layer
    const donation = await DonationService.getDonationById(id);

    // Check if user owns this donation
    if (donation.donor._id.toString() !== userId) {
      throw new AppError(httpStatus.FORBIDDEN, 'Access denied');
    }

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Donation retrieved successfully',
      data: donation,
    });
  }
);

// 4. Get donations by organization ID (for organization admin)
const getOrganizationDonations = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    // Get user from request
    const userId = req.user?._id.toString();
    // Note: userRole is commented out as it's not currently used
    // const userRole = req.user?.role;
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get validated params and query (validation handled by middleware)
    const { organizationId } = req.params;
    const validatedQuery = (
      req as unknown as { validatedQuery?: TGetOrganizationDonationsQuery }
    ).validatedQuery;
    const query: TGetOrganizationDonationsQuery =
      validatedQuery ||
      (req.query as unknown as TGetOrganizationDonationsQuery);

    // TODO: Add authorization check to ensure user can access organization's donations
    // For now, we'll allow organization admins to view their donations
    // if (userRole !== 'ADMIN' && !userHasAccessToOrganization(userId, organizationId)) {
    //   throw new AppError(httpStatus.FORBIDDEN, 'Access denied');
    // }

    // Prepare filters
    const filters = {
      organization: organizationId,
      ...(query.status !== 'all' && { status: query.status }),
      ...(query.type !== 'all' && { donationType: query.type }),
    };

    // Call service layer
    const result = await DonationService.getDonationsByOrganization(
      organizationId,
      query.page,
      query.limit,
      filters
    );

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Organization donations retrieved successfully',
      data: result,
    });
  }
);

// 6. Process payment for existing donation
const processPaymentForDonation = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    // Get user from request
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get validated params and body
    const { donationId } = req.params as TProcessPaymentForDonationParams;
    const body = req.body as TProcessPaymentForDonationBody;

    // Call service layer
    const result = await DonationService.processPaymentForDonation(
      donationId,
      body
    );

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Payment session created successfully',
      data: result,
    });
  }
);

// 7. Get donation full status with payment info
const getDonationFullStatus = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    // Get user from request
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get validated params
    const { id } = req.params;

    // Call service layer
    const result = await DonationService.getDonationFullStatus(id);

    // Verify donation belongs to user
    if (result.donation.donor._id.toString() !== userId) {
      throw new AppError(httpStatus.FORBIDDEN, 'Access denied');
    }

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Donation status retrieved successfully',
      data: result,
    });
  }
);

// 8. Retry failed payment
const retryFailedPayment = asyncHandler(
  async (req: ExtendedRequest, res: Response) => {
    // Get user from request
    const userId = req.user?._id.toString();
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get validated params
    const { donationId } = req.params as TRetryFailedPaymentParams;

    // Call service layer
    const result = await DonationService.retryFailedPayment(donationId);

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Payment retry session created successfully',
      data: result,
    });
  }
);

export const DonationController = {
  createOneTimeDonation,

  processPaymentForDonation,
  getDonationFullStatus,
  retryFailedPayment,

  // Existing endpoints
  getUserDonations,
  getDonationById,
  getOrganizationDonations,
};

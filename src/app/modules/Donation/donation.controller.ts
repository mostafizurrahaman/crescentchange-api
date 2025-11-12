import httpStatus from 'http-status';
import { Response } from 'express';

import { asyncHandler, sendResponse, AppError } from '../../utils';
import { ExtendedRequest } from '../../types';
import { DonationService } from './donation.service';
import { TRetryFailedPaymentParams } from './donation.validation';
import Client from '../Client/client.model';

// 1. Create one-time donation with Payment Intent
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

    // Call service layer - now returns donation and payment intent
    const result = await DonationService.createOneTimeDonation(donationData);

    // Send standardized response with both donation and payment details
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      message: 'Donation created and payment initiated successfully',
      data: {
        donation: result.donation,
        payment: {
          clientSecret: result.paymentIntent.client_secret,
          paymentIntentId: result.paymentIntent.payment_intent_id,
          status: result.donation.status,
        },
      },
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

    // Get query parameters
    const query = req.query as Record<string, unknown>;

    // Call service layer with full query object for QueryBuilder
    const result = await DonationService.getDonationsByUser(userId, query);

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Donations retrieved successfully',
      data: result.donations,
      meta: result.meta,
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

    // Check if donation has donor information
    if (!donation.donor) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Donor information not available'
      );
    }

    // Check if user owns this donation
    if (donation.donor.auth.toString() !== userId) {
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
    if (!userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'User not authenticated');
    }

    // Get organization ID from params
    const { organizationId } = req.params;

    // Get query parameters
    const query = req.query as Record<string, unknown>;

    // TODO: Add authorization check to ensure user can access organization's donations
    // For now, we'll allow organization admins to view their donations

    // Call service layer with full query object for QueryBuilder
    const result = await DonationService.getDonationsByOrganization(
      organizationId,
      query
    );

    // Send standardized response
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Organization donations retrieved successfully',
      data: result.donations,
      meta: result.meta,
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

    // check is donor exists :
    const donor = await Client?.findOne({
      auth: userId,
    });

    if (!donor?._id) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donor not found');
    }

    // Get validated params
    const { id } = req.params;

    // Call service layer
    const result = await DonationService.getDonationFullStatus(id);

    // Verify donation and donor exist
    if (!result?.donation) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donation not found');
    }

    if (!result.donation.donor) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Donor information not available'
      );
    }

    console.log(result);
    // Verify donation belongs to user
    if (result.donation.donor._id?.toString() !== donor._id?.toString()) {
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

  getDonationFullStatus,
  retryFailedPayment,

  // Existing endpoints
  getUserDonations,
  getDonationById,
  getOrganizationDonations,
};

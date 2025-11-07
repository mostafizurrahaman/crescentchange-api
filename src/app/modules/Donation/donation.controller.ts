import httpStatus from 'http-status';
import { asyncHandler, sendResponse } from '../../utils';
import { DonationService } from './donation.service';
import { AppError } from '../../utils';
import { IAuth } from '../Auth/auth.interface';
import Client from '../Client/client.model';

// Create donation
const createDonation = asyncHandler(async (req, res) => {
  const user = req.user as IAuth;

  // Get client ID from user
  const client = await Client.findOne({ auth: user._id });
  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'Client profile not found!');
  }

  const result = await DonationService.createDonationIntoDB({
    donor: client._id.toString(),
    organization: req.body.organization,
    donationType: req.body.donationType,
    amount: req.body.amount,
    currency: req.body.currency,
    causeCategory: req.body.causeCategory,
    specialMessage: req.body.specialMessage,
    scheduledDonationId: req.body.scheduledDonationId,
    roundUpId: req.body.roundUpId,
    stripePaymentIntentId: req.body.stripePaymentIntentId,
    stripeChargeId: req.body.stripeChargeId,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Donation created successfully!',
    data: result,
  });
});

// Get donation by ID
const getDonationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await DonationService.getDonationByIdFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donation retrieved successfully!',
    data: result,
  });
});

// Get donations with filters
const getDonations = asyncHandler(async (req, res) => {
  const user = req.user as IAuth;
  const filters = req.query;

  // If user is a client, filter by their donations only
  if (user.role === 'CLIENT') {
    const client = await Client.findOne({ auth: user._id });
    if (client) {
      filters.donor = client._id.toString();
    }
  }

  const result = await DonationService.getDonationsFromDB({
    donor: filters.donor as string,
    organization: filters.organization as string,
    donationType: filters.donationType as string,
    status: filters.status as string,
    startDate: filters.startDate
      ? new Date(filters.startDate as string)
      : undefined,
    endDate: filters.endDate ? new Date(filters.endDate as string) : undefined,
    page: filters.page ? Number(filters.page) : undefined,
    limit: filters.limit ? Number(filters.limit) : undefined,
    sortBy: filters.sortBy as string,
    sortOrder: filters.sortOrder as 'asc' | 'desc',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donations retrieved successfully!',
    data: result.donations,
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPage: result.meta.totalPages,
    },
  });
});

// Update donation status
const updateDonationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await DonationService.updateDonationStatusIntoDB(id, status);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donation status updated successfully!',
    data: result,
  });
});

// Update donation
const updateDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await DonationService.updateDonationIntoDB(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donation updated successfully!',
    data: result,
  });
});

// Delete donation
const deleteDonation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await DonationService.deleteDonationFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donation deleted successfully!',
    data: result,
  });
});

// Get donation statistics
const getDonationStatistics = asyncHandler(async (req, res) => {
  const user = req.user as IAuth;
  const filters = req.query;

  // If user is a client, filter by their donations only
  if (user.role === 'CLIENT') {
    const client = await Client.findOne({ auth: user._id });
    if (client) {
      filters.donor = client._id.toString();
    }
  }

  const result = await DonationService.getDonationStatisticsFromDB({
    donor: filters.donor as string,
    organization: filters.organization as string,
    startDate: filters.startDate
      ? new Date(filters.startDate as string)
      : undefined,
    endDate: filters.endDate ? new Date(filters.endDate as string) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donation statistics retrieved successfully!',
    data: result,
  });
});

export const DonationController = {
  createDonation,
  getDonationById,
  getDonations,
  updateDonationStatus,
  updateDonation,
  deleteDonation,
  getDonationStatistics,
};

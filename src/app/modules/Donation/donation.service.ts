import httpStatus from 'http-status';
import { FilterQuery, startSession } from 'mongoose';
import { AppError } from '../../utils';
import Donation from './donation.model';
import { IDonation, TDonationStatus } from './donation.interface';
import Client from '../Client/client.model';
import Organization from '../Organization/organization.model';
import { DONATION_STATUS } from './donation.constant';

// Create donation
const createDonationIntoDB = async (payload: {
  donor: string;
  organization: string;
  donationType: string;
  amount: number;
  currency?: string;
  causeCategory?: string;
  specialMessage?: string;
  scheduledDonationId?: string;
  roundUpId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
}) => {
  const session = await startSession();

  try {
    session.startTransaction();

    // Verify donor exists
    const donor = await Client.findById(payload.donor).session(session);
    if (!donor) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donor not found!');
    }

    // Verify organization exists
    const organization = await Organization.findById(
      payload.organization
    ).session(session);
    if (!organization) {
      throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
    }

    // Create donation
    const donationData = {
      donor: payload.donor,
      organization: payload.organization,
      donationType: payload.donationType,
      amount: payload.amount,
      currency: payload.currency || 'USD',
      causeCategory: payload.causeCategory,
      specialMessage: payload.specialMessage,
      scheduledDonationId: payload.scheduledDonationId,
      roundUpId: payload.roundUpId,
      stripePaymentIntentId: payload.stripePaymentIntentId,
      stripeChargeId: payload.stripeChargeId,
      status: DONATION_STATUS.PENDING,
      pointsEarned: Math.round(payload.amount * 100), // 1 USD = 100 points
    };

    const [donation] = await Donation.create([donationData], { session });

    await session.commitTransaction();
    await session.endSession();

    // Populate references
    const populatedDonation = await Donation.findById(donation._id)
      .populate('donor', 'name image')
      .populate('organization', 'name serviceType coverImage');

    return populatedDonation;
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create donation!'
    );
  }
};

// Get donation by ID
const getDonationByIdFromDB = async (donationId: string) => {
  const donation = await Donation.findById(donationId)
    .populate('donor', 'name image')
    .populate('organization', 'name serviceType coverImage')
    .populate('scheduledDonationId')
    .populate('roundUpId')
    .populate('receiptId');

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  return donation;
};

// Get donations with filters
const getDonationsFromDB = async (filters: {
  donor?: string;
  organization?: string;
  donationType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  const {
    donor,
    organization,
    donationType,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    sortBy = 'donationDate',
    sortOrder = 'desc',
  } = filters;

  // Build query
  const query: FilterQuery<IDonation> = {};

  if (donor) {
    query.donor = donor;
  }

  if (organization) {
    query.organization = organization;
  }

  if (donationType) {
    query.donationType = donationType;
  }

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.donationDate = {};
    if (startDate) {
      query.donationDate.$gte = startDate;
    }
    if (endDate) {
      query.donationDate.$lte = endDate;
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Build sort object
  const sort: Record<string, 1 | -1> = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query
  const donations = await Donation.find(query)
    .populate('donor', 'name image')
    .populate('organization', 'name serviceType coverImage')
    .sort(sort)
    .skip(skip)
    .limit(limit);

  // Get total count
  const total = await Donation.countDocuments(query);

  return {
    donations,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Update donation status
const updateDonationStatusIntoDB = async (
  donationId: string,
  status: TDonationStatus
) => {
  const donation = await Donation.findByIdAndUpdate(
    donationId,
    { status },
    { new: true, runValidators: true }
  )
    .populate('donor', 'name image')
    .populate('organization', 'name serviceType coverImage');

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  return donation;
};

// Update donation
const updateDonationIntoDB = async (
  donationId: string,
  payload: {
    amount?: number;
    status?: TDonationStatus;
    causeCategory?: string;
    specialMessage?: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
  }
) => {
  const donation = await Donation.findByIdAndUpdate(donationId, payload, {
    new: true,
    runValidators: true,
  })
    .populate('donor', 'name image')
    .populate('organization', 'name serviceType coverImage');

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  return donation;
};

// Delete donation (soft delete by setting status to failed or refunded)
const deleteDonationFromDB = async (donationId: string) => {
  const donation = await Donation.findByIdAndUpdate(
    donationId,
    { status: DONATION_STATUS.FAILED },
    { new: true }
  );

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  return donation;
};

// Get donation statistics
const getDonationStatisticsFromDB = async (filters: {
  donor?: string;
  organization?: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const { donor, organization, startDate, endDate } = filters;

  const query: FilterQuery<IDonation> = {};

  if (donor) {
    query.donor = donor;
  }

  if (organization) {
    query.organization = organization;
  }

  if (startDate || endDate) {
    query.donationDate = {};
    if (startDate) {
      query.donationDate.$gte = startDate;
    }
    if (endDate) {
      query.donationDate.$lte = endDate;
    }
  }

  // Only count completed donations
  query.status = DONATION_STATUS.COMPLETED;

  const stats = await Donation.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalDonations: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' },
        totalPoints: { $sum: '$pointsEarned' },
      },
    },
  ]);

  return (
    stats[0] || {
      totalDonations: 0,
      totalAmount: 0,
      averageAmount: 0,
      totalPoints: 0,
    }
  );
};

export const DonationService = {
  createDonationIntoDB,
  getDonationByIdFromDB,
  getDonationsFromDB,
  updateDonationStatusIntoDB,
  updateDonationIntoDB,
  deleteDonationFromDB,
  getDonationStatisticsFromDB,
};

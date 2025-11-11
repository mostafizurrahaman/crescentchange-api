import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { Donation } from './donation.model';
import { IDonation } from './donation.interface';
import { TCreateOneTimeDonationPayload } from './donation.validation';
import { AppError } from '../../utils';
import httpStatus from 'http-status';
import { StripeService } from '../Stripe/stripe.service';
import { ICheckoutSessionResponse } from '../Stripe/stripe.interface';
import { IDonationWithTracking } from './donation.interface';
import Organization from '../Organization/organization.model';

// Helper function to generate unique idempotency key
const generateIdempotencyKey = (): string => {
  return `don-${new Types.ObjectId().toString()}-${Date.now()}`;
};

// 1. Create donation record with transaction support (single consolidated function)
const createOneTimeDonation = async (
  payload: TCreateOneTimeDonationPayload & {
    userId: string;
  }
): Promise<{
  donation: IDonation;
  isIdempotent: boolean;
}> => {
  const {
    amount,
    causeId,
    organizationId,
    userId,
    connectedAccountId,
    specialMessage,
  } = payload;

  // Generate idempotency key on backend
  const idempotencyKey = generateIdempotencyKey();

  // Start mongoose session for transaction
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    // Check for existing donation with this idempotency key (within transaction)
    const existingDonation = await Donation.findOne({
      idempotencyKey,
    }).session(session);

    if (existingDonation) {
      await session.commitTransaction();
      return {
        donation: existingDonation,
        isIdempotent: true,
      };
    }

    // Validate organization exists
    const organization = await Organization.findById(organizationId).session(
      session
    );
    if (!organization) {
      throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
    }

    // Validate causeId is provided
    if (!causeId || causeId.trim() === '') {
      throw new AppError(httpStatus.BAD_REQUEST, 'Cause ID is required!');
    }

    // Generate unique ID for the donation
    const donationUniqueId = new Types.ObjectId();

    // Create donation record with pending status
    const donation = new Donation({
      _id: donationUniqueId,
      donor: new Types.ObjectId(userId),
      organization: new Types.ObjectId(organizationId),
      cause: new Types.ObjectId(causeId), // Required field
      donationType: 'one-time',
      amount,
      currency: 'USD',
      status: 'pending',
      specialMessage,
      pointsEarned: Math.floor(amount * 100), // 100 points per dollar
      connectedAccountId,
      idempotencyKey,
      createdAt: new Date(),
    });

    // Save donation within transaction
    const savedDonation = await donation.save({ session });

    // Commit transaction
    await session.commitTransaction();

    return {
      donation: savedDonation,
      isIdempotent: false,
    };
  } catch (error: unknown) {
    // Rollback on any error
    await session.abortTransaction();

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create donation record: ${errorMessage}`
    );
  } finally {
    await session.endSession();
  }
};

// 1a. Process payment for existing donation (separate endpoint) - for CheckoutSession flow
const processPaymentForDonation = async (
  donationId: string,
  paymentData?: {
    successUrl?: string;
    cancelUrl?: string;
    paymentMethodType?: 'card' | 'ideal' | 'sepa_debit';
  }
): Promise<{ donation: IDonation; session: ICheckoutSessionResponse }> => {
  // Validate donation exists
  if (!donationId || donationId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Donation ID is required!');
  }

  const donation = await Donation.findById(donationId);
  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  // Check if donation is already being processed
  if (donation.stripeSessionId) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Payment session already exists for this donation'
    );
  }

  // Prepare checkout session data
  const checkoutSessionData = {
    amount: donation.amount,
    causeId: donation.cause?.toString(),
    organizationId: donation.organization.toString(),
    connectedAccountId: donation.connectedAccountId,
    specialMessage: donation.specialMessage,
    userId: donation.donor.toString(),
    successUrl: paymentData?.successUrl,
    cancelUrl: paymentData?.cancelUrl,
    paymentMethodType: paymentData?.paymentMethodType || 'card',
  };

  try {
    const session = await StripeService.createCheckoutSessionWithDonation(
      checkoutSessionData,
      donationId
    );

    // Update donation with session information
    // Note: payment_intent_id will be set when the webhook is triggered
    donation.stripeSessionId = session.sessionId;
    donation.status = 'pending'; // Keep as pending until payment is completed
    await donation.save();

    return {
      donation,
      session,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create payment session: ${errorMessage}`
    );
  }
};

// 2. Get donation by ID
const getDonationById = async (donationId: string): Promise<IDonation> => {
  // Validate donation ID
  if (!donationId || donationId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Donation ID is required!');
  }

  const donation = await Donation.findById(donationId)
    .populate('donor', 'name email')
    .populate('organization', 'name')
    .populate('cause', 'name description');

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  // Ensure donor information is available
  if (!donation.donor) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Donor information not available. The donor reference may be invalid.'
    );
  }

  return donation as IDonation;
};

// 3. Update donation status
const updateDonationStatus = async (
  donationId: string,
  status: 'completed' | 'failed' | 'refunded',
  stripePaymentIntentId?: string,
  stripeCustomerId?: string
): Promise<IDonation> => {
  const updateData: Record<string, unknown> = { status };

  if (stripePaymentIntentId) {
    updateData.stripePaymentIntentId = stripePaymentIntentId;
  }

  if (stripeCustomerId) {
    updateData.stripeCustomerId = stripeCustomerId;
  }

  const donation = await Donation.findByIdAndUpdate(
    donationId,
    { $set: updateData },
    { new: true }
  )
    .populate('donor', 'name email')
    .populate('organization', 'name')
    .populate('cause', 'name description');

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found');
  }

  return donation;
};

// 4. Find donation by payment intent ID
const findDonationByPaymentIntentId = async (
  paymentIntentId: string
): Promise<IDonation | null> => {
  const donation = await Donation.findOne({
    stripePaymentIntentId: paymentIntentId,
  })
    .populate('donor', 'name email')
    .populate('organization', 'name')
    .populate('cause', 'name description');

  return donation ? (donation as IDonation) : null;
};

// 5. Update donation status by payment intent ID
const updateDonationStatusByPaymentIntent = async (
  paymentIntentId: string,
  status: 'completed' | 'failed' | 'refunded'
): Promise<IDonation | null> => {
  const donation = await findDonationByPaymentIntentId(paymentIntentId);

  if (!donation) {
    return null;
  }

  // Update directly by finding the document first
  const updateData: Record<string, unknown> = { status };
  return await Donation.findOneAndUpdate(
    { stripePaymentIntentId: paymentIntentId }, // Find by paymentIntentId instead
    { $set: updateData },
    { new: true }
  )
    .populate('donor', 'name email')
    .populate('organization', 'name')
    .populate('cause', 'name description');
};

// 6. Get donations by user with filters
const getDonationsByUser = async (
  userId: string,
  page: number = 1,
  limit: number = 10,
  filter: Record<string, unknown> = {}
) => {
  // Validate parameters
  if (!userId || userId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required!');
  }

  if (page < 1) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Page must be at least 1!');
  }

  if (limit < 1 || limit > 100) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Limit must be between 1 and 100!'
    );
  }

  const skip = (page - 1) * limit;

  try {
    const donations = await Donation.find({ donor: userId, ...filter })
      .populate('organization', 'name')
      .populate('cause', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Donation.countDocuments({ donor: userId, ...filter });

    return {
      donations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to retrieve donations: ${errorMessage}`
    );
  }
};

// 7. Get donations by organization with filters
const getDonationsByOrganization = async (
  organizationId: string,
  page: number = 1,
  limit: number = 10,
  filter: Record<string, unknown> = {}
) => {
  // Validate parameters
  if (!organizationId || organizationId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Organization ID is required!');
  }

  if (page < 1) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Page must be at least 1!');
  }

  if (limit < 1 || limit > 100) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Limit must be between 1 and 100!'
    );
  }

  const skip = (page - 1) * limit;

  try {
    const donations = await Donation.find({
      organization: organizationId,
      ...filter,
    })
      .populate('donor', 'name email')
      .populate('cause', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Donation.countDocuments({
      organization: organizationId,
      ...filter,
    });

    return {
      donations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to retrieve organization donations: ${errorMessage}`
    );
  }
};

// 8. Get donation statistics
const getDonationStatistics = async (
  userId?: string,
  organizationId?: string
) => {
  const matchStage: Record<string, unknown> = {};
  if (userId) matchStage.donor = new Types.ObjectId(userId);
  if (organizationId)
    matchStage.organization = new Types.ObjectId(organizationId);

  const stats = await Donation.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDonations: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        completedDonations: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        pendingDonations: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        failedDonations: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
        },
        totalPointsEarned: { $sum: '$pointsEarned' },
        averageDonationAmount: { $avg: '$amount' },
      },
    },
  ]);

  return (
    stats[0] || {
      totalDonations: 0,
      totalAmount: 0,
      completedDonations: 0,
      pendingDonations: 0,
      failedDonations: 0,
      totalPointsEarned: 0,
      averageDonationAmount: 0,
    }
  );
};

// 9. Update donation with payment status (for webhooks)
const updateDonationPaymentStatus = async (
  paymentIntentId: string,
  status: 'completed' | 'failed',
  paymentData?: {
    chargeId?: string;
    customerId?: string;
    failureReason?: string;
    failureCode?: string;
  }
): Promise<IDonation | null> => {
  const donation = await findDonationByPaymentIntentId(paymentIntentId);

  if (!donation) {
    return null;
  }

  // Type donation with tracking fields
  const donationWithTracking = donation as IDonationWithTracking;

  // Update status and attempt tracking
  const updateData: Record<string, unknown> = {
    status: status === 'completed' ? 'completed' : 'failed',
    paymentAttempts: (donationWithTracking.paymentAttempts || 0) + 1,
    lastPaymentAttempt: new Date(),
  };

  if (paymentData?.chargeId) {
    updateData.stripeChargeId = paymentData.chargeId;
  }

  if (paymentData?.customerId) {
    updateData.stripeCustomerId = paymentData.customerId;
  }

  if (status === 'failed' && paymentData?.failureReason) {
    // Store failure reason in special message or custom error field
    updateData.specialMessage = `${
      donation.specialMessage || ''
    }\n[Payment Failed: ${paymentData.failureReason}]`;
  }

  return (await Donation.findByIdAndUpdate(
    donationWithTracking._id,
    { $set: updateData },
    { new: true }
  )
    .populate('donor', 'name email')
    .populate('organization', 'name')
    .populate('cause', 'name description')) as unknown as IDonation;
};

// 10. Retry failed payment
const retryFailedPayment = async (
  donationId: string
): Promise<{ donation: IDonation; session: ICheckoutSessionResponse }> => {
  const donation = await Donation.findById(donationId);

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  if (donation.status !== 'failed') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Can only retry failed donations!'
    );
  }

  // Type donation with tracking fields
  const donationWithTracking = donation as IDonationWithTracking;

  // Check if there have been too many attempts
  const maxRetries = 3;
  if (donationWithTracking.paymentAttempts >= maxRetries) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      'Maximum payment retries reached!'
    );
  }

  // Clear previous session info and retry
  donation.stripeSessionId = undefined;
  donation.stripePaymentIntentId = undefined;
  donation.status = 'pending';
  await donation.save();

  // Create new payment session
  return await processPaymentForDonation(donationId);
};

// 11. Get donation full status including payment info
const getDonationFullStatus = async (
  donationId: string
): Promise<{
  donation: IDonation;
  paymentStatus: {
    status: string;
    lastPaymentAttempt?: Date;
    paymentAttempts: number;
    canRetry: boolean;
    sessionId?: string;
    paymentIntentId?: string;
  };
}> => {
  const donation = await getDonationById(donationId);

  // Type donation with tracking fields
  const donationWithTracking = donation as IDonationWithTracking;

  const paymentStatus = {
    status: donation.status,
    lastPaymentAttempt: donationWithTracking.lastPaymentAttempt,
    paymentAttempts: donationWithTracking.paymentAttempts || 0,
    canRetry:
      donation.status === 'failed' &&
      (donationWithTracking.paymentAttempts || 0) < 3,
    sessionId: donation.stripeSessionId,
    paymentIntentId: donation.stripePaymentIntentId,
  };

  return {
    donation,
    paymentStatus,
  };
};

export const DonationService = {
  // Core donation functions
  createOneTimeDonation, // Single consolidated function

  getDonationById,
  getDonationFullStatus,

  // Payment processing
  processPaymentForDonation,
  retryFailedPayment,
  updateDonationStatus,
  updateDonationPaymentStatus,
  updateDonationStatusByPaymentIntent,

  // Query functions
  findDonationByPaymentIntentId,
  getDonationsByUser,
  getDonationsByOrganization,
  getDonationStatistics,
};

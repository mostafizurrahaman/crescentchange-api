import httpStatus from 'http-status';
import { FilterQuery, startSession } from 'mongoose';
import { AppError } from '../../utils';
import QueryBuilder from '../../builders/QueryBuilder';
import Donation from './donation.model';
import { IDonation } from './donation.interface';
import {
  ICreateDonation,
  IDonationFilters,
  IStripeWebhookEvent,
} from './donation.interface';
import Organization from '../Organization/organization.model';
import Client from '../Client/client.model';
import Cause from '../Causes/causes.model';
// import { calculateAndAssignPoints } from '../Points/points.service';
// import { updateUserBadgeProgress } from '../UserBadge/userBadge.service';
import { createNotification } from '../Notification/notification.service';
import Stripe from 'stripe';

// Initialize Stripe with Connect support
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29',
});

// Create donation with Stripe payment intent
const createDonation = async (
  donationData: ICreateDonation,
  donorAuthId: string,
  userRole: string
) => {
  const session = await startSession();

  try {
    session.startTransaction();

    // Get donor profile
    const donor = await Client.findOne({ auth: donorAuthId }).session(session);
    if (!donor) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donor profile not found!');
    }

    // Verify organization exists and is active
    const organization = await Organization.findById(donationData.organization)
      .populate('auth _id isActive')
      .session(session);
    if (!organization) {
      throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
    }

    // Check if organization is active
    if (!organization.auth?.isActive) {
      throw new AppError(httpStatus.FORBIDDEN, 'Organization is not active!');
    }

    // Validate cause belongs to organization (if cause is specified)
    if (donationData.cause) {
      const cause = await Cause.findOne({
        _id: donationData.cause,
        organization: donationData.organization,
      }).session(session);

      if (!cause) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Cause does not belong to this organization!'
        );
      }
    }

    // Get or create organization's Stripe Connect account
    // TODO: Implement Stripe Connect account management
    let stripeConnectAccountId = organization.stripeConnectAccountId;
    if (!stripeConnectAccountId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Organization does not have a payment processor configured!'
      );
    }

    // Create Stripe payment intent with Connect destination
    const paymentIntent = await stripe.paymentIntents.create({
      amount: donationData.amount,
      currency: donationData.currency || 'usd',
      metadata: {
        donorId: donor._id.toString(),
        organizationId: organization._id.toString(),
        causeId: donationData.cause?.toString() || '',
        donationType: donationData.donationType,
      },
      transfer_data: {
        destination: stripeConnectAccountId,
      },
    });

    // Create donation record
    const [donation] = await Donation.create(
      [
        {
          donor: donor._id,
          organization: organization._id,
          cause: donationData.cause,
          donationType: donationData.donationType,
          amount: donationData.amount,
          currency: donationData.currency || 'usd',
          stripePaymentIntentId: paymentIntent.id,
          stripeConnectAccountId: stripeConnectAccountId,
          specialMessage: donationData.specialMessage,
          roundUpTransactionIds: donationData.roundUpTransactionIds,
          scheduledDonationId: donationData.scheduledDonationId,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    await session.endSession();

    // Populate donation details for response
    const populatedDonation = await Donation.findById(donation._id)
      .populate('donor', 'name image')
      .populate('organization', 'name serviceType')
      .populate('cause', 'name');

    return {
      donation: populatedDonation,
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// Define searchable fields
const donationSearchFields = ['donationType', 'status'];

// Get donations with filtering
const getDonationsFromDB = async (query: Record<string, unknown>) => {
  // Apply additional filters for date range and specific IDs
  const filters = { ...query };

  // Handle date range filtering
  if (filters.startDate || filters.endDate) {
    const dateFilter: Record<string, unknown> = {};
    if (filters.startDate)
      dateFilter.$gte = new Date(filters.startDate as string);
    if (filters.endDate) dateFilter.$lte = new Date(filters.endDate as string);
    (filters as Record<string, unknown>).createdAt = dateFilter;
    delete (filters as Record<string, unknown>).startDate;
    delete (filters as Record<string, unknown>).endDate;
  }

  // Create base query with population
  const baseQuery = Donation.find(filters)
    .populate('donor', 'name image')
    .populate('organization', 'name serviceType')
    .populate('cause', 'name');

  const donationQuery = new QueryBuilder<IDonation>(baseQuery, query)
    .search(donationSearchFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await donationQuery.modelQuery;
  const meta = await donationQuery.countTotal();

  return { donations: result, meta };
};

// Get donation by ID
const getDonationById = async (
  id: string,
  requesterAuthId?: string,
  requesterRole?: string
) => {
  const donation = await Donation.findById(id)
    .populate('donor', 'name image')
    .populate('organization', 'name serviceType')
    .populate('cause', 'name');

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
  }

  // Authorization check - only donor, organization, or admin can view full details
  if (requesterAuthId && requesterRole !== 'ADMIN') {
    const requester = await Client.findOne({ auth: requesterAuthId });
    if (
      requesterRole === 'CLIENT' &&
      donation.donor._id.toString() !== requester?._id.toString()
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You can only view your own donations!'
      );
    }

    const org = await Organization.findOne({ auth: requesterAuthId });
    if (
      requesterRole === 'ORGANIZATION' &&
      donation.organization._id.toString() !== org?._id.toString()
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You can only view donations to your organization!'
      );
    }
  }

  return donation;
};

// Get user's donations
const getUserDonations = async (
  userId: string,
  requesterAuthId: string,
  requesterRole: string,
  options: Partial<IDonationFilters> = {}
) => {
  // Authorization check
  if (requesterRole === 'CLIENT') {
    const requester = await Client.findOne({ auth: requesterAuthId });
    if (!requester || requester._id.toString() !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You can only view your own donations!'
      );
    }
  }

  return getDonationsFromDB({ donor: userId, ...options });
};

// Get organization's received donations
const getOrganizationDonations = async (
  organizationId: string,
  requesterAuthId: string,
  requesterRole: string,
  options: Partial<IDonationFilters> = {}
) => {
  // Authorization check
  if (requesterRole === 'ORGANIZATION') {
    const requester = await Organization.findOne({ auth: requesterAuthId });
    if (!requester || requester._id.toString() !== organizationId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You can only view donations to your organization!'
      );
    }
  }

  return getDonationsFromDB({ organization: organizationId, ...options });
};

// Handle Stripe webhook events
const handleStripeWebhook = async (event: IStripeWebhookEvent) => {
  const eventType = event.type;
  const session = await startSession();

  try {
    session.startTransaction();

    switch (eventType) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, session);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object, session);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object, session);
        break;

      case 'charge.dispute.created':
      case 'charge.dispute.lost':
        await handleChargeDispute(event.data.object, session);
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    await session.commitTransaction();
    await session.endSession();
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// Handle successful payment
const handlePaymentIntentSucceeded = async (
  paymentIntent: {
    id: string;
    charges?: { data: Array<{ id: string }> };
  },
  session: typeof startSession
) => {
  const donation = await Donation.findOne({
    stripePaymentIntentId: paymentIntent.id,
  }).session(session);

  if (!donation) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Donation not found for payment intent!'
    );
  }

  if (donation.status === 'completed') {
    return; // Already processed
  }

  // Update donation status
  donation.status = 'completed';
  donation.stripeChargeId = paymentIntent.charges?.data[0]?.id;
  donation.donationDate = new Date();

  await donation.save({ session });

  // Create points transaction (TODO: Implement Points module)
  try {
    const { calculateAndAssignPoints } = await import(
      '../Points/points.service'
    );
    await calculateAndAssignPoints(
      donation.donor.toString(),
      donation.pointsEarned,
      'donation',
      donation._id.toString(),
      `Earned from $${(donation.amount / 100).toFixed(2)} donation to ${
        donation.organization
      }`,
      session
    );
  } catch (error) {
    console.warn('Points module not implemented yet:', error);
  }

  // Update badge progress (TODO: Implement UserBadge module)
  try {
    const { updateUserBadgeProgress } = await import(
      '../UserBadge/userBadge.service'
    );
    await updateUserBadgeProgress(
      donation.donor.toString(),
      donation._id.toString(),
      'donation',
      session
    );
  } catch (error) {
    console.warn('UserBadge module not implemented yet:', error);
  }

  // Create notification for donor
  await createNotification(
    donation.donor.toString(),
    'donation_completed',
    `Thank you! Your $${(donation.amount / 100).toFixed(
      2
    )} donation was successful!`,
    donation._id.toString(),
    session
  );

  // Create notification for organization
  await createNotification(
    donation.organization.toString(),
    'donation_received',
    `You received a $${(donation.amount / 100).toFixed(2)} donation!`,
    donation._id.toString(),
    session
  );
};

// Handle failed payment
const handlePaymentIntentFailed = async (
  paymentIntent: { id: string },
  session: typeof startSession
) => {
  const donation = await Donation.findOne({
    stripePaymentIntentId: paymentIntent.id,
  }).session(session);

  if (!donation) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Donation not found for payment intent!'
    );
  }

  donation.status = 'failed';
  await donation.save({ session });

  // Create notification for donor
  await createNotification(
    donation.donor.toString(),
    'donation_failed',
    'Your donation payment failed. Please try again.',
    donation._id.toString(),
    session
  );
};

// Handle canceled payment
const handlePaymentIntentCanceled = async (
  paymentIntent: { id: string },
  session: typeof startSession
) => {
  const donation = await Donation.findOne({
    stripePaymentIntentId: paymentIntent.id,
  }).session(session);

  if (!donation) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Donation not found for payment intent!'
    );
  }

  donation.status = 'failed';
  await donation.save({ session });
};

// Handle charge disputes (potential refund)
const handleChargeDispute = async (
  charge: { id: string },
  session: typeof startSession
) => {
  // Find donation by charge ID
  const donation = await Donation.findOne({
    stripeChargeId: charge.id,
  }).session(session);

  if (!donation) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donation not found for charge!');
  }

  // Create notification for organization about dispute
  await createNotification(
    donation.organization.toString(),
    'donation_dispute',
    `A dispute has been opened for a $${(donation.amount / 100).toFixed(
      2
    )} donation.`,
    donation._id.toString(),
    session
  );
};

// Process refund with automatic point and badge adjustment
const processRefund = async (
  donationId: string,
  refundAmount: number,
  refundReason: string,
  requesterAuthId: string,
  requesterRole: string
) => {
  const session = await startSession();

  try {
    session.startTransaction();

    const donation = await Donation.findById(donationId).session(session);
    if (!donation) {
      throw new AppError(httpStatus.NOT_FOUND, 'Donation not found!');
    }

    if (donation.status !== 'completed') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Can only refund completed donations!'
      );
    }

    if (refundAmount > donation.amount) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Refund amount cannot exceed donation amount!'
      );
    }

    // Calculate points to deduct (proportional to refund amount)
    const pointsToDeduct = Math.floor(
      (refundAmount * donation.pointsEarned) / donation.amount
    );

    // Authorization check
    if (requesterRole === 'ORGANIZATION') {
      const requester = await Organization.findOne({
        auth: requesterAuthId,
      }).session(session);
      if (
        !requester ||
        requester._id.toString() !== donation.organization.toString()
      ) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          'You can only refund donations to your organization!'
        );
      }
    }

    // Create refund in Stripe
    if (donation.stripeChargeId) {
      try {
        await stripe.refunds.create({
          charge: donation.stripeChargeId,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            donationId: donationId,
            refundedBy: requesterAuthId,
            refundReason,
          },
        });
      } catch (stripeError) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Failed to process refund with Stripe!'
        );
      }
    }

    // Update donation record
    donation.status = 'refunded';
    donation.refundAmount = refundAmount;
    donation.refundDate = new Date();
    donation.refundReason = refundReason;
    await donation.save({ session });

    // Deduct points from user
    if (pointsToDeduct > 0) {
      // Create negative points transaction (deduction)
      try {
        const { calculateAndAssignPoints } = await import(
          '../Points/points.service'
        );
        await calculateAndAssignPoints(
          donation.donor.toString(),
          -pointsToDeduct,
          'donation',
          donationId,
          `Points deducted from $${(refundAmount / 100).toFixed(2)} refund`,
          session
        );
      } catch (error) {
        console.warn('Points module not implemented yet:', error);
      }

      // Update badge progress (badge progress will be recalculated based on updated donation history)
      try {
        const { updateUserBadgeProgress } = await import(
          '../UserBadge/userBadge.service'
        );
        await updateUserBadgeProgress(
          donation.donor.toString(),
          donationId,
          'refund',
          session
        );
      } catch (error) {
        console.warn('UserBadge module not implemented yet:', error);
      }
    }

    // Create notifications
    await createNotification(
      donation.donor.toString(),
      'donation_refunded',
      `Your $${(refundAmount / 100).toFixed(2)} donation has been refunded. ${
        pointsToDeduct > 0 ? `${pointsToDeduct} points have been deducted.` : ''
      }`,
      donationId,
      session
    );

    await session.commitTransaction();
    await session.endSession();

    return await Donation.findById(donationId)
      .populate('donor', 'name image')
      .populate('organization', 'name serviceType')
      .populate('cause', 'name');
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// Get donation statistics for user or organization
const getDonationStats = async (
  entity: 'user' | 'organization',
  entityId: string,
  startDate?: Date,
  endDate?: Date
) => {
  const filter: FilterQuery<IDonation> = {};

  if (entity === 'user') {
    filter.donor = entityId;
  } else {
    filter.organization = entityId;
  }

  filter.status = 'completed'; // Only count successful donations

  // Date range
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const [stats] = await Donation.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalDonations: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' },
        oneTimeCount: {
          $sum: { $cond: [{ $eq: ['$donationType', 'one-time'] }, 1, 0] },
        },
        recurringCount: {
          $sum: { $cond: [{ $eq: ['$donationType', 'recurring'] }, 1, 0] },
        },
        roundUpCount: {
          $sum: { $cond: [{ $eq: ['$donationType', 'round-up'] }, 1, 0] },
        },
        totalPointsEarned: { $sum: '$pointsEarned' },
      },
    },
    {
      $project: {
        totalDonations: 1,
        totalAmount: 1,
        averageAmount: 1,
        donationCounts: {
          oneTime: '$oneTimeCount',
          recurring: '$recurringCount',
          roundUp: '$roundUpCount',
        },
        totalPointsEarned: 1,
      },
    },
  ]);

  if (!stats) {
    return {
      totalDonations: 0,
      totalAmount: 0,
      averageAmount: 0,
      donationCounts: {
        oneTime: 0,
        recurring: 0,
        roundUp: 0,
      },
      totalPointsEarned: 0,
    };
  }

  return stats;
};

export const DonationService = {
  createDonation,
  getDonationsFromDB,
  getDonationById,
  getUserDonations,
  getOrganizationDonations,
  handleStripeWebhook,
  processRefund,
  getDonationStats,
};

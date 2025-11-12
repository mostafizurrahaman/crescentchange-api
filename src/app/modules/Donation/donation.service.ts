import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { Donation } from './donation.model';
import { IDonation, IDonationModel } from './donation.interface';
import { TCreateOneTimeDonationPayload } from './donation.validation';
import { AppError } from '../../utils';
import httpStatus from 'http-status';
import { StripeService } from '../Stripe/stripe.service';
import { ICheckoutSessionResponse } from '../Stripe/stripe.interface';
import { IDonationWithTracking } from './donation.interface';
import Organization from '../Organization/organization.model';
import { PaymentMethodService } from '../PaymentMethod/paymentMethod.service';
import Client from '../Client/client.model';
import QueryBuilder from '../../builders/QueryBuilder';

// Helper function to generate unique idempotency key
const generateIdempotencyKey = (): string => {
  return `don-${new Types.ObjectId().toString()}-${Date.now()}`;
};

// 1. Create one-time donation with Payment Intent (direct charge with saved payment method)
const createOneTimeDonation = async (
  payload: TCreateOneTimeDonationPayload & {
    userId: string;
  }
): Promise<{
  donation: IDonation;
  paymentIntent: {
    client_secret: string;
    payment_intent_id: string;
  };
}> => {
  const {
    amount,
    causeId,
    organizationId,
    userId,
    paymentMethodId,
    specialMessage,
  } = payload;

  // Generate idempotency key on backend
  const idempotencyKey = generateIdempotencyKey();

  // check is donar exists ?:
  const donor = await Client?.findOne({
    auth: userId,
  });
  if (!donor?._id) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor not found!');
  }

  // Validate organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  // Get organization's Stripe Connect account (required for receiving payments)
  const connectedAccountId = organization.stripeConnectAccountId;
  if (!connectedAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'This organization has not set up payment receiving. Please contact the organization to complete their Stripe Connect onboarding.'
    );
  }

  // Validate causeId is provided
  if (!causeId || causeId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cause ID is required!');
  }

  // Verify payment method exists and belongs to user
  const paymentMethod = await PaymentMethodService.getPaymentMethodById(
    paymentMethodId,
    userId
  );

  if (!paymentMethod.isActive) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Payment method is not active!');
  }

  // Start mongoose session for transaction
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    // Generate unique ID for the donation
    const donationUniqueId = new Types.ObjectId();

    // Create donation record with pending status
    const donation = new Donation({
      _id: donationUniqueId,
      donor: new Types.ObjectId(donor?._id),
      organization: new Types.ObjectId(organizationId),
      cause: new Types.ObjectId(causeId),
      donationType: 'one-time',
      amount,
      currency: 'USD',
      status: 'pending',
      specialMessage,
      pointsEarned: Math.floor(amount * 100), // 100 points per dollar
      connectedAccountId,
      stripeCustomerId: paymentMethod.stripeCustomerId,
      idempotencyKey,
      createdAt: new Date(),
    });

    // Save donation within transaction
    const savedDonation = await donation.save({ session });

    // Create payment intent with saved payment method
    const paymentIntent = await StripeService.createPaymentIntentWithMethod({
      amount,
      currency: 'usd',
      customerId: paymentMethod.stripeCustomerId,
      paymentMethodId: paymentMethod.stripePaymentMethodId,
      donationId: donationUniqueId.toString(),
      organizationId,
      causeId,
      connectedAccountId,
      specialMessage,
    });

    // Update donation with payment intent ID
    savedDonation.stripePaymentIntentId = paymentIntent.payment_intent_id;
    savedDonation.status = 'processing';
    await savedDonation.save({ session });

    // Commit transaction
    await session.commitTransaction();

    return {
      donation: savedDonation,
      paymentIntent,
    };
  } catch (error: unknown) {
    // Rollback on any error
    await session.abortTransaction();

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to create donation and process payment: ${errorMessage}`
    );
  } finally {
    await session.endSession();
  }
};

// 2. Get donation by ID
const getDonationById = async (donationId: string): Promise<IDonation> => {
  // Validate donation ID
  if (!donationId || donationId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Donation ID is required!');
  }

  const donation = await Donation.findById(donationId)
    .populate('donor', '_id name auth address state postalCode image')
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

// 6. Get donations by user with filters (using QueryBuilder)
const getDonationsByUser = async (
  userId: string,
  query: Record<string, unknown>
) => {
  // Validate user ID
  if (!userId || userId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required!');
  }

  // Find donor by auth ID
  const donor = await Client.findOne({ auth: userId });
  if (!donor?._id) {
    throw new AppError(httpStatus.NOT_FOUND, 'Donor not found!');
  }

  try {
    // Prepare modified query - remove 'all' values before QueryBuilder processes it
    const modifiedQuery = { ...query };
    if (modifiedQuery.status === 'all') {
      delete modifiedQuery.status;
    }
    if (modifiedQuery.donationType === 'all') {
      delete modifiedQuery.donationType;
    }

    // Create base query with only donor filter
    const baseQuery = Donation.find({ donor: donor._id })
      .populate('organization', 'name')
      .populate('cause', 'name');

    // Define searchable fields for donations
    const donationSearchFields = ['specialMessage', 'status', 'donationType'];

    // Use QueryBuilder for flexible querying (it will apply status and donationType filters if present)
    const donationQuery = new QueryBuilder<IDonationModel>(
      baseQuery,
      modifiedQuery
    )
      .search(donationSearchFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const donations = await donationQuery.modelQuery;
    const meta = await donationQuery.countTotal();

    return {
      donations,
      meta,
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

// 7. Get donations by organization with filters (using QueryBuilder)
const getDonationsByOrganization = async (
  organizationId: string,
  query: Record<string, unknown>
) => {
  // Validate organization ID
  if (!organizationId || organizationId.trim() === '') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Organization ID is required!');
  }

  // Validate organization exists
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  try {
    // Prepare modified query - remove 'all' values before QueryBuilder processes it
    const modifiedQuery = { ...query };
    if (modifiedQuery.status === 'all') {
      delete modifiedQuery.status;
    }
    if (modifiedQuery.donationType === 'all') {
      delete modifiedQuery.donationType;
    }

    // Create base query with only organization filter
    const baseQuery = Donation.find({ organization: organizationId })
      .populate('donor')
      .populate('cause', 'name');

    // Define searchable fields for donations
    const donationSearchFields = ['specialMessage', 'status', 'donationType'];

    // Use QueryBuilder for flexible querying (it will apply status and donationType filters if present)
    const donationQuery = new QueryBuilder<IDonationModel>(
      baseQuery,
      modifiedQuery
    )
      .search(donationSearchFields)
      .filter()
      .sort()
      .paginate()
      .fields();

    const donations = await donationQuery.modelQuery;
    const meta = await donationQuery.countTotal();

    return {
      donations,
      meta,
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

  // Get payment method info - need to fetch from stripe customer's default payment method
  if (!donation.stripeCustomerId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No payment method associated with this donation. Please create a new donation.'
    );
  }

  // Fetch organization for Stripe Connect account
  const organization = await Organization.findById(donation.organization);
  if (!organization?.stripeConnectAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Organization payment setup not found'
    );
  }

  // For retry, we need the payment method ID which should be stored or retrieved
  // Since we're using Payment Intent flow, we create a new payment intent
  const paymentIntent = await StripeService.createPaymentIntentWithMethod({
    amount: donation.amount,
    currency: 'usd',
    customerId: donation.stripeCustomerId,
    paymentMethodId: donation.stripeCustomerId, // Note: This needs to be payment method ID, not customer ID
    donationId: donation?._id.toString(),
    organizationId: donation.organization.toString(),
    causeId: donation.cause?.toString() || '',
    connectedAccountId: organization.stripeConnectAccountId,
    specialMessage: donation.specialMessage,
  });

  // Update donation with new payment intent
  donation.stripePaymentIntentId = paymentIntent.payment_intent_id;
  donation.status = 'processing';
  donation.stripeSessionId = undefined; // Clear old session if any
  await donation.save();

  return {
    donation,
    session: {
      sessionId: paymentIntent.payment_intent_id,
      url: '', // Payment Intent doesn't have a URL, frontend handles with client secret
    } as ICheckoutSessionResponse,
  };
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

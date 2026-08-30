/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { AppError, deleteFromS3, uploadToS3 } from '../../utils';
import Organization from './organization.model';
import Auth from '../Auth/auth.model';
import { StripeService } from '../Stripe/stripe.service';
import {
  TEditOrgTaxDetails,
  TEditProfileOrgDetails,
} from './organization.validation';
import { ROLE, AUTH_STATUS } from '../Auth/auth.constant';
import { IAuth } from '../Auth/auth.interface';
import { createAccessToken } from '../../lib';
import { searchableFields } from './organization.constants';
import QueryBuilder from '../../builders/QueryBuilder';
import Cause from '../Causes/causes.model';
import Donation from '../Donation/donation.model';
import { StripeAccount } from '../OrganizationAccount/stripe-account.model';
import { getS3KeyFromUrl } from '../../utils/s3.utils';
import { CAUSE_STATUS_TYPE } from '../Causes/causes.constant';
import { SubscriptionService } from '../Subscription/subscription.service';
import {
  getCurrencyForCountry,
  getStripeCountryCode,
  STRIPE_CONNECT_COUNTRIES,
} from '../../utils/currency.utils';
import {
  buildOrganizationCurrencyDisplay,
  resolveOrganizationChargeCurrency,
} from '../../utils/donation-pricing.utils';
import { PLATFORM_BASE_CURRENCY } from '../../utils/currency.utils';
import {
  assertOrganizationCountryMutable,
  isOrganizationCountryLocked,
  resolveOrganizationCountryFields,
} from '../../utils/organization-country.utils';
import {
  syncStripeAccountFromStripe,
} from '../OrganizationAccount/stripe-account.sync';

/**
 * Start Stripe Connect onboarding for an organization
 * Checks for existing account first to prevent duplicates.
 */
const startStripeConnectOnboarding = async (
  userId: string
): Promise<{ onboardingUrl: string; accountId: string }> => {
  // 1. Find user to get email
  const user = await Auth.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // 2. Find organization associated with this user
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Organization not found! Only organizations can onboard for payment receiving.'
    );
  }

  if (!organization.country || !getStripeCountryCode(organization.country)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A supported country is required in your profile before connecting Stripe.'
    );
  }

  // 3. Check if a Stripe Account ALREADY exists for this org
  let stripeAccount = await StripeAccount.findOne({
    organization: organization._id,
  });

  let accountId = '';

  if (stripeAccount) {
    console.log(
      `♻️ Reusing existing Stripe Account: ${stripeAccount.stripeAccountId}`
    );
    accountId = stripeAccount.stripeAccountId;
    await syncStripeAccountFromStripe(accountId);
  } else {
    console.log(`🆕 Creating new Stripe Connected Account...`);

    const stripeCountry = getStripeCountryCode(organization.country);
    if (!stripeCountry) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Organization country is not supported for Stripe Connect. Please set a supported country in your profile.'
      );
    }

    // Ensure org currency is set before onboarding
    if (!organization.defaultCurrency) {
      organization.defaultCurrency = getCurrencyForCountry(organization.country);
      await organization.save();
    }

    // Call Stripe API to create the Express account
    const stripeResponse = await StripeService.createConnectAccount(
      user.email,
      organization.name || 'Organization',
      stripeCountry
    );

    // Save the new ID to our dedicated StripeAccount model
    stripeAccount = await StripeAccount.create({
      organization: organization._id,
      stripeAccountId: stripeResponse.accountId,
      status: 'pending',
      requirements: {
        currently_due: [],
        eventually_due: [],
      },
    });

    accountId = stripeResponse.accountId;
  }

  // 4. Generate a fresh Onboarding Link
  const { onboardingUrl } = await StripeService.createAccountLink(accountId);

  return {
    onboardingUrl,
    accountId,
  };
};

/**
 * Get Stripe Connect account status
 */

const getStripeConnectStatus = async (
  userId: string
): Promise<{
  hasAccount: boolean;
  accountId?: string;
  isActive: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: string[];
  status: string;
  country: string;
  defaultCurrency: string;
  isCountryLocked: boolean;
}> => {
  // 1. Find Organization
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  // 2. Find the Stripe Account record
  const stripeAccount = await StripeAccount.findOne({
    organization: organization._id,
  });

  // 3. Return early if no account exists
  const defaultCurrency =
    organization.defaultCurrency || getCurrencyForCountry(organization.country);
  const countryLocked = await isOrganizationCountryLocked(
    organization._id.toString()
  );

  if (!stripeAccount) {
    return {
      hasAccount: false,
      isActive: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirements: [],
      status: 'not_connected',
      country: organization.country || '',
      defaultCurrency,
      isCountryLocked: countryLocked,
    };
  }

  // 4. Sync latest Connect account state from Stripe into MongoDB
  try {
    const syncedAccount = await syncStripeAccountFromStripe(
      stripeAccount.stripeAccountId
    );

    if (!syncedAccount) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Stripe Connect account record not found after sync.'
      );
    }

    return {
      hasAccount: true,
      accountId: syncedAccount.stripeAccountId,
      isActive: syncedAccount.chargesEnabled && syncedAccount.payoutsEnabled,
      chargesEnabled: syncedAccount.chargesEnabled,
      payoutsEnabled: syncedAccount.payoutsEnabled,
      detailsSubmitted: syncedAccount.detailsSubmitted,
      requirements: syncedAccount.requirements?.currently_due || [],
      status: syncedAccount.status,
      country: organization.country || '',
      defaultCurrency,
      isCountryLocked: countryLocked,
    };
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to fetch Stripe Connect status: ${(error as Error).message}`
    );
  }
};

/**
 * Refresh Stripe Connect onboarding link
 * Used when a user's link expires or they return to finish the process.
 */
const refreshStripeConnectOnboarding = async (
  userId: string
): Promise<{ onboardingUrl: string }> => {
  // 1. Find Organization
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  // 2. Find Stripe Account
  const stripeAccount = await StripeAccount.findOne({
    organization: organization._id,
  });

  if (!stripeAccount || !stripeAccount.stripeAccountId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No Stripe Connect account found! Please start onboarding first.'
    );
  }

  // 3. Sync latest flags from Stripe, then create a fresh onboarding link
  await syncStripeAccountFromStripe(stripeAccount.stripeAccountId);

  const { onboardingUrl } = await StripeService.createAccountLink(
    stripeAccount.stripeAccountId
  );

  return { onboardingUrl };
};

export const updateOrganizationImage = async (
  user: IAuth,
  file: Express.Multer.File | undefined,
  imageField: 'coverImage' | 'logoImage'
) => {
  // 1. Validation: Since we use memoryStorage, check for the file object
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'File is required!');
  }

  // 2. Find the organization
  const organization = await Organization.findOne({ auth: user?._id });

  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  // 3. Cleanup: Delete the old image from S3 if it exists
  const oldImageUrl = organization[imageField];
  if (oldImageUrl) {
    const oldKey = getS3KeyFromUrl(oldImageUrl);
    if (oldKey) {
      // Delete from S3 (fire and forget or await)
      await deleteFromS3(oldKey).catch((err) =>
        console.error('Failed to delete old organization image from S3:', err)
      );
    }
  }

  // 4. Upload new image to S3
  const folderPath = `profiles/organizations`;
  const fileName = `${user._id}-${Date.now()}`;

  const uploadResult = await uploadToS3({
    buffer: file.buffer,
    key: fileName,
    contentType: file.mimetype,
    folder: folderPath,
  });

  const updatedOrganization = await Organization.findOneAndUpdate(
    { auth: user?._id },
    { [imageField]: uploadResult.url },
    { new: true }
  ).select('name coverImage logoImage');

  if (!updatedOrganization) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update organization image in database'
    );
  }

  if (imageField === 'coverImage') {
    const accessTokenPayload = {
      id: user?._id.toString(),
      name: updatedOrganization?.name,
      image: updatedOrganization?.coverImage || '',
      email: user?.email,
      role: user?.role,
      isProfile: user?.isProfile,
      isActive: user?.isActive,
      status: user?.status,
    };

    const accessToken = createAccessToken(accessTokenPayload);

    return { accessToken, organization: updatedOrganization };
  }

  return { organization: updatedOrganization };
};

/**
 * Edit Organization Profile Details (Tab 1 - Text fields only)
 * PATCH /api/v1/organization/profile-details
 */
const editProfileOrgDetailsIntoDB = async (
  userId: string,
  payload: TEditProfileOrgDetails
) => {
  // Find user
  const user = await Auth.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (user.role !== ROLE.ORGANIZATION) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only organizations can update these details!'
    );
  }

  // Find organization
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  const updatePayload: TEditProfileOrgDetails & { defaultCurrency?: string } = {
    ...payload,
  };

  if (payload.country !== undefined) {
    await assertOrganizationCountryMutable(
      organization._id.toString(),
      organization.country,
      payload.country
    );

    const resolved = resolveOrganizationCountryFields(payload.country);
    updatePayload.country = resolved.country;
    updatePayload.defaultCurrency = resolved.defaultCurrency;
  }

  const countryLocked = await isOrganizationCountryLocked(
    organization._id.toString()
  );

  // Update organization
  const updatedOrganization = await Organization.findOneAndUpdate(
    { auth: userId },
    { $set: updatePayload },
    { new: true, runValidators: true }
  ).populate({
    path: 'auth',
    select: 'email role isProfile',
  });

  if (!updatedOrganization) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update organization profile!'
    );
  }

  return {
    organization: updatedOrganization,
    country: updatedOrganization.country,
    defaultCurrency:
      updatedOrganization.defaultCurrency ||
      getCurrencyForCountry(updatedOrganization.country),
    isCountryLocked: countryLocked,
  };
};

/**
 * Update Organization Logo Image
 * PATCH /api/v1/organization/logo-image
 */
const updateLogoImageIntoDB = async (
  user: IAuth,
  file: Express.Multer.File | undefined
) => {
  if (user.role !== ROLE.ORGANIZATION) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only organizations can update logo image!'
    );
  }

  return updateOrganizationImage(user, file, 'logoImage');
};

/**
 * Edit Organization Tax Details (Tab 2)
 * PATCH /api/v1/organization/tax-details
 */
const editOrgTaxDetailsIntoDB = async (
  userId: string,
  payload: TEditOrgTaxDetails
) => {
  // Find user
  const user = await Auth.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (user.role !== ROLE.ORGANIZATION) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only organizations can update tax details!'
    );
  }

  // Find organization
  const organization = await Organization.findOne({ auth: userId });
  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  // Update tax details
  const updatedOrganization = await Organization.findOneAndUpdate(
    { auth: userId },
    { $set: payload },
    { new: true, runValidators: true }
  ).populate({
    path: 'auth',
    select: 'email role isProfile',
  });

  if (!updatedOrganization) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update tax details!'
    );
  }

  return {
    organization: updatedOrganization,
  };
};

/**
 * Get verified Charities/ Organizations list
 */
const getAllOrganizations = async (query: Record<string, unknown>) => {
  // Extract special filters
  const {
    dateFrom,
    dateTo,
    dateOfEstablishment,
    status,
    isProfileVisible,
    populateCauses, // Add this to control whether to populate causes
    ...restQuery
  } = query;

  // Build base conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any = {};

  if (dateOfEstablishment) {
    conditions.dateOfEstablishment = new Date(dateOfEstablishment as string);
  }

  if (isProfileVisible) {
    conditions.isProfileVisible = Boolean(isProfileVisible);
  }

  // Handle date range filters
  if (dateFrom || dateTo) {
    conditions.createdAt = {};
    if (dateFrom) {
      conditions.createdAt.$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      conditions.createdAt.$lte = new Date(dateTo as string);
    }
  }

  // Handle status filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authIdArray: any[] = [];
  if (status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authQuery: any = { role: ROLE.ORGANIZATION,   isDeleted: { 
      $ne: true,
    } };

    if (status) {
      authQuery.status = status;
      // Map active status to isActive flag for legacy support if needed
      authQuery.isActive = status === AUTH_STATUS.VERIFIED;
    }



    const authIds = await Auth.find(authQuery).select('_id');
    authIdArray = authIds.map((auth) => auth._id);
    conditions.auth = { $in: authIdArray };
  } else { 
  const authIds = await Auth.find({ 
    role: ROLE.ORGANIZATION,
    isDeleted: { 
      $ne: true,
    }

  }).select('_id');
    authIdArray = authIds.map((auth) => auth._id);
    conditions.auth = { $in: authIdArray };
  }

  // Create base query with conditions
  const organizationQuery = Organization.find(conditions).populate({
    path: 'auth',
    select: 'email role isActive status',
    match: {
     isDeleted: false
    }
  });

  // Apply QueryBuilder
  const queryBuilder = new QueryBuilder(organizationQuery, restQuery)
    .search(searchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  // Execute query
  const result = await queryBuilder.modelQuery;
  const meta = await queryBuilder.countTotal();

  // Populate causes after QueryBuilder execution (if requested)
  if (populateCauses === 'true' || populateCauses === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationIds = result.map((org: any) => org._id);

    // Get causes for all organizations in one query
    const causes = await Cause.find({
      organization: { $in: organizationIds },
    });

    // Map causes to their organizations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultWithCauses = result.map((org: any) => {
      const orgObject = org.toObject();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orgObject.causes = causes.filter(
        (cause: any) => cause.organization.toString() === org._id.toString()
      );
      return orgObject;
    });

    return {
      data: resultWithCauses,
      meta,
    };
  }

  return {
    data: result,
    meta,
  };
};

/**
 * Get Organization Details by ID
 */
const getOrganizationDetailsById = async (organizationId: string) => {
  // Find organization by ID
  const organization = await Organization.findById(organizationId)
    .select(
      'name registeredCharityName logoImage coverImage aboutUs serviceType address state country postalCode defaultCurrency website phoneNumber'
    )
    .populate('auth', 'email role isActive status');

  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, 'Organization not found!');
  }

  const hasSubscription = await SubscriptionService.checkHasSubscription(
    organization._id.toString()
  );

  const organizationDonationStats = await Donation.aggregate([
    {
      $match: {
        organization: organization._id,
        status: 'completed',
      },
    },
    {
      $facet: {
        totalDonations: [{ $count: 'count' }],
        totalDonationAmount: [
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$amount' },
            },
          },
        ],
        totalDonationAmountBase: [
          {
            $group: {
              _id: null,
              totalAmount: { $sum: { $ifNull: ['$amountBase', '$amount'] } },
            },
          },
        ],
        recentDonors: [
          { $sort: { donationDate: -1 } },
          {
            $group: {
              _id: '$donor',
              lastDonationDate: { $first: '$donationDate' },
              lastDonationAmount: { $first: '$amount' },
            },
          },
          { $limit: 5 },
          {
            $lookup: {
              from: 'clients',
              localField: '_id',
              foreignField: '_id',
              as: 'donorDetails',
            },
          },
          { $unwind: '$donorDetails' },
          {
            $project: {
              donorId: '$_id',
              lastDonationDate: 1,
              lastDonationAmount: 1,
              donorName: '$donorDetails.name',
              donorImage: '$donorDetails.image',
              donorAddress: '$donorDetails.address',
              _id: 0,
            },
          },
        ],
      },
    },
  ]);

  // supported causes:
  const causes = await Cause.find({
    organization: organization?._id,
    status: CAUSE_STATUS_TYPE.VERIFIED,
  }).select('name category status description');

  const organizationStats = organizationDonationStats[0];

  const totalDonation = organizationStats?.totalDonations?.[0]?.count || 0;
  const totalDonationAmount =
    organizationStats?.totalDonationAmount?.[0]?.totalAmount || 0;
  const totalDonationAmountBase =
    organizationStats?.totalDonationAmountBase?.[0]?.totalAmount || 0;
  const recentDonors = organizationStats?.recentDonors || [];

  const organizationCurrency = resolveOrganizationChargeCurrency(
    organization.country,
    organization.defaultCurrency
  );
  const currencyDisplay = buildOrganizationCurrencyDisplay(organizationCurrency);

  return {
    ...organization.toObject(),
    ...currencyDisplay,
    message: `Donations to this organization are processed in ${organizationCurrency}`,
    totalDonation,
    totalDonationAmount,
    totalDonationAmountBase,
    reportingCurrency: PLATFORM_BASE_CURRENCY,
    recentDonors,
    causes,
    isOnetime: true,
    isRecurring: hasSubscription,
    isRoundup: hasSubscription,
  };
};

/**
 * List Stripe Connect countries enabled on this platform (for signup/profile dropdowns).
 */
const getSupportedStripeCountries = () =>
  STRIPE_CONNECT_COUNTRIES.map((c) => ({
    countryCode: c.countryCode,
    name: c.name,
    currency: c.currency,
    stripeCurrency: c.currency.toLowerCase(),
  }));

export const OrganizationService = {
  startStripeConnectOnboarding,
  getStripeConnectStatus,
  refreshStripeConnectOnboarding,
  getSupportedStripeCountries,
  editProfileOrgDetailsIntoDB,
  updateLogoImageIntoDB,
  editOrgTaxDetailsIntoDB,
  getAllOrganizations,
  getOrganizationDetailsById,
};

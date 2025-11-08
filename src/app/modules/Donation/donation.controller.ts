import httpStatus from 'http-status';
import { asyncHandler, sendResponse } from '../../utils';
import { DonationService } from './donation.service';
import { AppError } from '../../utils';
import { IAuth } from '../Auth/auth.interface';
import { ExtendedRequest } from '../../types';
import Client from '../Client/client.model';
import Organization from '../Organization/organization.model';
import { ROLE } from '../Auth/auth.constant';
import Stripe from 'stripe';
import type { Request, Response } from 'express';

// Initialize Stripe with webhook support
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover' as any, // Temporarily using type assertion
});

// Create donation
const createDonation = asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const user = req.user;
  let donorData = { ...req.body };

  // If user is a client, use their profile as donor
  if (user.role === ROLE.CLIENT) {
    const client = await Client.findOne({ auth: user._id });
    if (!client) {
      throw new AppError(httpStatus.NOT_FOUND, 'Client profile not found!');
    }
    donorData.donor = client._id.toString();
  }

  const result = await DonationService.createDonation(donorData, user._id.toString(), user.role);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Donation created successfully! Please complete the payment.',
    data: {
      donation: result.donation,
      clientSecret: result.clientSecret,
    },
  });
});

// Get all donations (with filtering)
const getDonations = asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const filters = req.query;
  const user = req.user;

  let modifiedFilters = { ...filters };

  // If user is client, only show their donations
  if (user.role === ROLE.CLIENT) {
    const client = await Client.findOne({ auth: user._id });
    if (client) {
      modifiedFilters.donor = client._id.toString();
    }
  }
  // If user is organization, only show donations to their organization
  else if (user.role === ROLE.ORGANIZATION) {
    const organization = await Organization.findOne({ auth: user._id });
    if (organization) {
      modifiedFilters.organization = organization._id.toString();
    }
  }

  const result = await DonationService.getDonationsFromDB(modifiedFilters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donations retrieved successfully!',
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPage: result.meta.totalPage
    },
    data: result.donations,
  });
});

// Get donation by ID
const getDonationById = asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  const result = await DonationService.getDonationById(id, user._id.toString(), user.role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donation retrieved successfully!',
    data: result,
  });
});

// Get user's donations
const getUserDonations = asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { userId } = req.params;
  const user = req.user;
  const options = req.query;

  const result = await DonationService.getUserDonations(
    userId,
    user._id.toString(),
    user.role,
    options
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User donations retrieved successfully!',
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPage: result.meta.totalPage
    },
    data: result.donations,
  });
});

// Get organization's received donations
const getOrganizationDonations = asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { organizationId } = req.params;
  const user = req.user;
  const options = req.query;

  const result = await DonationService.getOrganizationDonations(
    organizationId,
    user._id.toString(),
    user.role,
    options
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Organization donations retrieved successfully!',
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPage: result.meta.totalPage
    },
    data: result.donations,
  });
});

// Process refund
const processRefund = asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { id } = req.params;
  const { refundAmount, refundReason } = req.body;
  const user = req.user;

  // Convert amount from dollars to cents for processing
  const refundAmountInCents = Math.round(refundAmount * 100);

  const result = await DonationService.processRefund(
    id,
    refundAmountInCents,
    refundReason,
    user._id.toString(),
    user.role
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: `Refund of $${refundAmount} processed successfully! Points and badge progress have been adjusted.`,
    data: result,
  });
});

// Get donation statistics
const getDonationStats = asyncHandler(async (req, res) => {
  const { entity, id } = req.params;
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate as string) : undefined;
  const end = endDate ? new Date(endDate as string) : undefined;

  const result = await DonationService.getDonationStats(
    entity as 'user' | 'organization',
    id,
    start,
    end
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Donation statistics retrieved successfully!',
    data: result,
  });
});

// Handle Stripe webhook
const handleStripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`Webhook signature verification failed: ${errorMessage}`);
    return res.status(400).send(`Webhook Error: ${errorMessage}`);
  }

  // Process the webhook event
  await DonationService.handleStripeWebhook(event);

  // Return 200 OK to acknowledge receipt
  res.status(200).json({ received: true });
});

// Create payment intent directly (alternative endpoint)
const createPaymentIntent = asyncHandler(async (req: ExtendedRequest, res: Response) => {
  const { amount, organizationId, causeId, donationType } = req.body;
  const user = req.user;

  // Get user and organization profiles
  const client = await Client.findOne({ auth: user._id });
  if (!client) {
    throw new AppError(httpStatus.NOT_FOUND, 'Client profile not found!');
  }

  const organization = await Organization.findById(organizationId);
  if (!organization || !organization.stripeConnectAccountId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Organization not found or not configured for payments!');
  }

  // Create payment intent
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        donorId: client._id.toString(),
        organizationId: organization._id.toString(),
        causeId: causeId || '',
        donationType: donationType || 'one-time',
      },
      transfer_data: {
        destination: organization.stripeConnectAccountId,
      },
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Payment intent created successfully!',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new AppError(httpStatus.BAD_REQUEST, `Failed to create payment intent: ${errorMessage}`);
  }
});

export const DonationController = {
  createDonation,
  getDonations,
  getDonationById,
  getUserDonations,
  getOrganizationDonations,
  processRefund,
  getDonationStats,
  handleStripeWebhook,
  createPaymentIntent,
};

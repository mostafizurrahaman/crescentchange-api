import { z } from 'zod';
import { donationTypeValues, donationStatusValues } from './donation.constant';

// Create donation schema
const createDonationSchema = z.object({
  body: z.object({
    donor: z.string({
      message: 'Donor ID is required!',
    }),
    organization: z.string({
      message: 'Organization ID is required!',
    }),
    cause: z.string({
      message: 'Cause ID is required!',
    }).optional(),
    donationType: z.enum(donationTypeValues as [string, ...string[]], {
      message: 'Invalid donation type! Must be one-time, recurring, or round-up',
    }),
    amount: z.number({
      message: 'Amount is required!',
    }).min(100, 'Minimum amount is 100 cents ($1.00)').int('Amount must be an integer'),
    currency: z.string().default('USD').optional(),
    specialMessage: z.string().max(500, 'Special message cannot exceed 500 characters!').optional(),
    roundUpTransactionIds: z.array(z.string()).optional(),
    scheduledDonationId: z.string().optional(),
  }),
});

// Update donation schema
const updateDonationSchema = z.object({
  body: z.object({
    status: z.enum(donationStatusValues as [string, ...string[]], {
      message: 'Invalid donation status!',
    }).optional(),
    specialMessage: z.string().max(500, 'Special message cannot exceed 500 characters!').optional(),
    refundAmount: z.number().min(0, 'Refund amount must be non-negative').int('Refund amount must be an integer').optional(),
    refundReason: z.string().max(500, 'Refund reason cannot exceed 500 characters!').optional(),
  }).strict(),
  params: z.object({
    id: z.string({
      message: 'Donation ID is required!',
    }),
  }),
});

// Get donation by ID schema
const getDonationByIdSchema = z.object({
  params: z.object({
    id: z.string({
      message: 'Donation ID is required!',
    }),
  }),
});

// Get donations query schema
const getDonationsQuerySchema = z.object({
  query: z.object({
    donor: z.string().optional(),
    organization: z.string().optional(),
    cause: z.string().optional(),
    donationType: z.enum(donationTypeValues as [string, ...string[]]).optional(),
    status: z.enum(donationStatusValues as [string, ...string[]]).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    sortBy: z.string().default('createdAt').optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

// Get user donations schema
const getUserDonationsSchema = z.object({
  params: z.object({
    userId: z.string({
      message: 'User ID is required!',
    }),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    donationType: z.enum(donationTypeValues as [string, ...string[]]).optional(),
    status: z.enum(donationStatusValues as [string, ...string[]]).optional(),
    sortBy: z.string().default('createdAt').optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

// Get organization donations schema
const getOrganizationDonationsSchema = z.object({
  params: z.object({
    organizationId: z.string({
      message: 'Organization ID is required!',
    }),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    donationType: z.enum(donationTypeValues as [string, ...string[]]).optional(),
    status: z.enum(donationStatusValues as [string, ...string[]]).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    sortBy: z.string().default('createdAt').optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

// Get donation statistics schema
const getDonationStatsSchema = z.object({
  params: z.object({
    entity: z.enum(['user', 'organization'], {
      message: 'Entity type must be either user or organization!',
    }),
    id: z.string({
      message: 'Entity ID is required!',
    }),
  }),
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

// Process refund schema
const processRefundSchema = z.object({
  params: z.object({
    id: z.string({
      message: 'Donation ID is required!',
    }),
  }),
  body: z.object({
    refundAmount: z.number({
      message: 'Refund amount is required!',
    }).min(1, 'Refund amount must be at least 1 cent').int('Refund amount must be an integer'),
    refundReason: z.string({
      message: 'Refund reason is required!',
    }).max(500, 'Refund reason cannot exceed 500 characters!'),
  }).strict(),
});

// Webhook event schema (basic validation)
const webhookEventSchema = z.object({
  headers: z.object({
    'stripe-signature': z.string({
      message: 'Stripe signature is required!',
    }),
  }),
  body: z.any(), // Raw body will be validated by Stripe library
});

export const DonationValidation = {
  createDonationSchema,
  updateDonationSchema,
  getDonationByIdSchema,
  getDonationsQuerySchema,
  getUserDonationsSchema,
  getOrganizationDonationsSchema,
  getDonationStatsSchema,
  processRefundSchema,
  webhookEventSchema,
};

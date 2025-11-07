import { z } from 'zod';
import {
  donationTypeValues,
  donationStatusValues,
  DONATION_TYPE,
  DONATION_STATUS,
} from './donation.constant';

// Create donation schema
const createDonationSchema = z.object({
  body: z.object({
    organization: z
      .string({
        message: 'Organization ID is required!',
      })
      .refine((val) => val !== '', {
        message: 'Organization ID cannot be empty!',
      }),
    donationType: z.enum(
      [DONATION_TYPE.ONE_TIME, DONATION_TYPE.RECURRING, DONATION_TYPE.ROUND_UP],
      {
        message: 'Invalid donation type!',
      }
    ),
    amount: z
      .number({
        message: 'Amount is required!',
      })
      .positive('Amount must be positive!')
      .min(0.01, 'Amount must be at least 0.01'),
    currency: z.string().default('USD').optional(),
    causeCategory: z.string().optional(),
    specialMessage: z.string().optional(),
    scheduledDonationId: z.string().optional(),
    roundUpId: z.string().optional(),
  }),
});

// Update donation status schema
const updateDonationStatusSchema = z.object({
  body: z.object({
    status: z.enum(
      [
        DONATION_STATUS.PENDING,
        DONATION_STATUS.COMPLETED,
        DONATION_STATUS.FAILED,
        DONATION_STATUS.REFUNDED,
      ] as [string, ...string[]],
      {
        message: 'Invalid donation status!',
      }
    ),
  }),
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
    donationType: z
      .enum(donationTypeValues as [string, ...string[]])
      .optional(),
    status: z.enum(donationStatusValues as [string, ...string[]]).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(10).optional(),
    sortBy: z.string().default('donationDate').optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
});

// Update donation schema (for admin updates)
const updateDonationSchema = z.object({
  body: z
    .object({
      amount: z.number().positive().min(0.01).optional(),
      status: z.enum(donationStatusValues as [string, ...string[]]).optional(),
      causeCategory: z.string().optional(),
      specialMessage: z.string().optional(),
      stripePaymentIntentId: z.string().optional(),
      stripeChargeId: z.string().optional(),
    })
    .strict(),
  params: z.object({
    id: z.string({
      message: 'Donation ID is required!',
    }),
  }),
});

export const DonationValidation = {
  createDonationSchema,
  updateDonationStatusSchema,
  getDonationByIdSchema,
  getDonationsQuerySchema,
  updateDonationSchema,
};

import { z } from 'zod';

// 2. Get user donations schema
const getUserDonationsSchema = z.object({
  query: z.object({
    page: z.coerce
      .number()
      .min(1, { message: 'Page must be at least 1!' })
      .default(1),

    limit: z.coerce
      .number()
      .min(1, { message: 'Limit must be at least 1!' })
      .max(100, { message: 'Limit cannot exceed 100!' })
      .default(10),

    status: z
      .enum(['all', 'pending', 'completed', 'failed', 'refunded'], {
        error: 'Invalid status option!',
      })
      .default('all'),

    donationType: z
      .enum(['all', 'one-time', 'recurring', 'round-up'], {
        error: 'Invalid donation type!',
      })
      .default('all'),
  }),
});

// 3. Get donation by ID schema (params validation)
const getDonationByIdSchema = z.object({
  params: z.object({
    id: z
      .string({
        error: 'Donation ID is required!',
      })
      .min(1, { message: 'Donation ID is required!' }),
  }),
});

// 4. Get organization donations schema
const getOrganizationDonationsSchema = z.object({
  params: z.object({
    organizationId: z
      .string({
        error: 'Organization ID is required!',
      })
      .min(1, { message: 'Organization ID is required!' }),
  }),
  query: z.object({
    page: z.coerce
      .number()
      .min(1, { message: 'Page must be at least 1!' })
      .default(1),

    limit: z.coerce
      .number()
      .min(1, { message: 'Limit must be at least 1!' })
      .max(100, { message: 'Limit cannot exceed 100!' })
      .default(10),

    status: z
      .enum(['all', 'pending', 'completed', 'failed', 'refunded'], {
        error: 'Invalid status option!',
      })
      .default('all'),

    type: z
      .enum(['all', 'one-time', 'recurring', 'round-up'], {
        error: 'Invalid donation type!',
      })
      .default('all'),
  }),
});

// 5. Create recurring donation schema (for future use)
const createRecurringDonationSchema = z.object({
  body: z.object({
    amount: z
      .number({
        error: 'Amount is required!',
      })
      .min(0.01, { message: 'Amount must be at least 0.01!' })
      .max(9999.99, {
        message: 'Amount cannot exceed $9,999.99 for recurring donations!',
      }),

    organizationId: z
      .string({
        error: 'Organization ID is required!',
      })
      .min(1, { message: 'Organization ID is required!' }),

    causeId: z
      .string({
        error: 'Cause ID is required!',
      })
      .min(1, { message: 'Cause ID is required!' }),

    frequency: z.enum(
      ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      {
        error: 'Invalid frequency option!',
      }
    ),

    startDate: z
      .string()
      .datetime({ message: 'Invalid date format!' })
      .refine((date) => new Date(date) > new Date(), {
        message: 'Start date must be in the future!',
      }),

    endDate: z
      .string()
      .datetime({ message: 'Invalid date format!' })
      .optional(),

    causeCategory: z
      .string()
      .max(100, { message: 'Cause category must be less than 100 characters!' })
      .transform((category) => category?.trim())
      .optional(),

    specialMessage: z
      .string()
      .max(500, { message: 'Message must be less than 500 characters!' })
      .transform((message) => message?.trim())
      .optional(),

    // For custom frequency - these would be validated separately
    customFrequencyDays: z
      .number({
        error: 'Days must be a number!',
      })
      .min(1, { message: 'Custom frequency days must be at least 1!' })
      .optional(),

    customFrequencyWeeks: z
      .number({
        error: 'Weeks must be a number!',
      })
      .min(1, { message: 'Custom frequency weeks must be at least 1!' })
      .optional(),

    customFrequencyMonths: z
      .number({
        error: 'Months must be a number!',
      })
      .min(1, { message: 'Custom frequency months must be at least 1!' })
      .optional(),
  }),
});

// 6. Create round-up schema (for future use)
const createRoundUpSchema = z.object({
  body: z.object({
    organizationId: z
      .string({
        error: 'Organization ID is required!',
      })
      .min(1, { message: 'Organization ID is required!' }),

    bankConnectionId: z
      .string({
        error: 'Bank connection ID is required!',
      })
      .min(1, { message: 'Bank connection ID is required!' }),

    thresholdAmount: z
      .union([
        z.enum(['10', '20', '25', '40', '50', 'none'], {
          error: 'Invalid threshold amount!',
        }),
        z
          .number({
            error: 'Custom threshold must be a number!',
          })
          .min(1, { message: 'Custom threshold must be at least $1!' }),
      ])
      .optional(),

    monthlyLimit: z
      .number({
        error: 'Monthly limit must be a number!',
      })
      .min(0, { message: 'Monthly limit must be non-negative!' })
      .max(1000, { message: 'Monthly limit cannot exceed $1000!' })
      .optional(),

    autoDonateTrigger: z.object({
      type: z.enum(['amount', 'days', 'both'], {
        error: 'Invalid trigger type!',
      }),

      amount: z
        .number({
          error: 'Trigger amount must be a number!',
        })
        .min(1, { message: 'Trigger amount must be at least $1!' })
        .optional(),

      days: z
        .number({
          error: 'Trigger days must be a number!',
        })
        .min(1, { message: 'Trigger days must be at least 1!' }),
    }),

    specialMessage: z
      .string()
      .max(500, { message: 'Message must be less than 500 characters!' })
      .transform((message) => message?.trim())
      .optional(),
  }),
});

// 7. Create donation record schema (separate from payment)
const createDonationRecordSchema = z.object({
  body: z.object({
    amount: z
      .number({
        error: 'Amount is required!',
      })
      .min(0.01, { message: 'Amount must be at least 0.01!' })
      .max(99999.99, { message: 'Amount cannot exceed $99,999.99!' }),

    causeId: z
      .string({
        error: 'Cause ID is required!',
      })
      .min(1, { message: 'Cause ID is required!' }),

    organizationId: z
      .string({
        error: 'Organization ID is required!',
      })
      .min(1, { message: 'Organization ID is required!' }),

    connectedAccountId: z.string().optional(),

    specialMessage: z
      .string()
      .max(500, { message: 'Message must be less than 500 characters!' })
      .transform((message) => message?.trim())
      .optional(),

    donationId: z.string().optional(), // For idempotency
  }),
});

// 8. Process payment for donation schema
const processPaymentForDonationSchema = z.object({
  params: z.object({
    donationId: z
      .string({
        error: 'Donation ID is required!',
      })
      .min(1, { message: 'Donation ID is required!' }),
  }),
  body: z.object({
    successUrl: z.string().url({ message: 'Invalid success URL!' }).optional(),

    cancelUrl: z.string().url({ message: 'Invalid cancel URL!' }).optional(),

    paymentMethodType: z
      .enum(['card', 'ideal', 'sepa_debit'], {
        error: 'Invalid payment method type!',
      })
      .optional(),
  }),
});

// 9. Retry failed payment schema
const retryFailedPaymentSchema = z.object({
  params: z.object({
    donationId: z
      .string({
        error: 'Donation ID is required!',
      })
      .min(1, { message: 'Donation ID is required!' }),
  }),
});

// 10. Webhook payment status update schema (internal use)
const updatePaymentStatusSchema = z.object({
  body: z.object({
    paymentIntentId: z.string({
      error: 'Payment intent ID is required!',
    }),
    status: z.enum(['completed', 'failed'], {
      error: 'Invalid status!',
    }),
    chargeId: z.string().optional(),
    customerId: z.string().optional(),
    failureReason: z
      .string()
      .max(500, { message: 'Failure reason must be less than 500 characters!' })
      .optional(),
    failureCode: z.string().optional(),
  }),
});

// 10. Create one-time donation with PaymentIntent schema
const createOneTimeDonationSchema = z.object({
  body: z.object({
    amount: z
      .number({
        error: 'Amount is required!',
      })
      .min(0.01, { message: 'Amount must be at least 0.01!' })
      .max(99999.99, { message: 'Amount cannot exceed $99,999.99!' }),

    currency: z
      .string()
      .min(3, { message: 'Currency must be 3 characters (e.g., USD)!' })
      .max(3, { message: 'Currency must be 3 characters (e.g., USD)!' })
      .default('usd')
      .transform((val) => val.toLowerCase()),

    organizationId: z
      .string({
        error: 'Organization ID is required!',
      })
      .min(1, { message: 'Organization ID is required!' }),

    causeId: z
      .string({
        error: 'Cause ID is required',
      })
      .min(1, { message: 'Cause ID is required!' }),

    connectedAccountId: z.string().optional(),

    specialMessage: z
      .string()
      .max(500, { message: 'Message must be less than 500 characters!' })
      .transform((message) => message?.trim())
      .optional(),
  }),
});

// Export all schemas as a single object like auth module
export const DonationValidation = {
  createOneTimeDonationSchema,
  getUserDonationsSchema,
  getDonationByIdSchema,
  getOrganizationDonationsSchema,
  createRecurringDonationSchema,
  createRoundUpSchema,
  createDonationRecordSchema,
  processPaymentForDonationSchema,
  retryFailedPaymentSchema,
  updatePaymentStatusSchema,
};

// Export types for TypeScript inference
export type TCreateOneTimeDonationPayload = z.infer<
  typeof createOneTimeDonationSchema.shape.body
>;
export type TGetUserDonationsQuery = z.infer<
  typeof getUserDonationsSchema.shape.query
>;
export type TGetDonationByIdParams = z.infer<
  typeof getDonationByIdSchema.shape.params
>;
export type TGetOrganizationDonationsParams = z.infer<
  typeof getOrganizationDonationsSchema.shape.params
>;
export type TGetOrganizationDonationsQuery = z.infer<
  typeof getOrganizationDonationsSchema.shape.query
>;
export type TCreateDonationRecordPayload = z.infer<
  typeof createDonationRecordSchema.shape.body
>;
export type TProcessPaymentForDonationParams = z.infer<
  typeof processPaymentForDonationSchema.shape.params
>;
export type TProcessPaymentForDonationBody = z.infer<
  typeof processPaymentForDonationSchema.shape.body
>;
export type TRetryFailedPaymentParams = z.infer<
  typeof retryFailedPaymentSchema.shape.params
>;
export type TUpdatePaymentStatusBody = z.infer<
  typeof updatePaymentStatusSchema.shape.body
>;
export type TCreateOneTimeDonation = z.infer<
  typeof createOneTimeDonationSchema.shape.body
>;

// Keep response schemas separate for API documentation
export const checkoutSessionResponseSchema = z.object({
  sessionId: z.string(),
  url: z.string().url(),
});

export type CheckoutSessionResponse = z.infer<
  typeof checkoutSessionResponseSchema
>;

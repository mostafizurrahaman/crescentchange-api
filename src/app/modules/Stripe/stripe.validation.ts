import { z } from 'zod';

// Create checkout session schema
const createCheckoutSessionSchema = z.object({
  body: z.object({
    amount: z
      .number({
        error: 'Amount is required!',
      })
      .min(0.01, { message: 'Amount must be at least 0.01!' })
      .max(99999.99, { message: 'Amount cannot exceed $99,999.99!' }),
    
    causeId: z
      .string()
      .optional(),
    
    organizationId: z
      .string({
        error: 'Organization ID is required!',
      })
      .min(1, { message: 'Organization ID is required!' }),
    
    specialMessage: z
      .string()
      .max(500, { message: 'Message must be less than 500 characters!' })
      .transform((message) => message?.trim())
      .optional(),
  }),
});

// Update donation status schema
const updateDonationStatusSchema = z.object({
  body: z.object({
    donationId: z
      .string({
        error: 'Donation ID is required!',
      })
      .min(1, { message: 'Donation ID is required!' }),
    
    status: z
      .enum(['completed', 'failed', 'refunded'], {
        error: 'Invalid status option!',
      }),
    
    stripePaymentIntentId: z
      .string()
      .optional(),
    
    stripeCustomerId: z
      .string()
      .optional(),
  }),
});

// Export all schemas as a single object
export const StripeValidation = {
  createCheckoutSessionSchema,
  updateDonationStatusSchema,
};

// Export types for TypeScript inference
export type TCreateCheckoutSessionPayload = z.infer<typeof createCheckoutSessionSchema.shape.body>;
export type TUpdateDonationStatusPayload = z.infer<typeof updateDonationStatusSchema.shape.body>;

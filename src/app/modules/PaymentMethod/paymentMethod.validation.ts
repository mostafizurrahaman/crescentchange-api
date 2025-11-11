import { z } from 'zod';

// 1. Add payment method schema
const addPaymentMethodSchema = z.object({
  body: z.object({
    stripePaymentMethodId: z
      .string({
        error: 'Stripe payment method ID is required!',
      })
      .min(1, { message: 'Stripe payment method ID is required!' })
      .startsWith('pm_', {
        message: 'Invalid Stripe payment method ID format!',
      }),

    cardHolderName: z
      .string()
      .max(100, { message: 'Card holder name must be less than 100 characters!' })
      .transform((name) => name?.trim())
      .optional(),

    isDefault: z.boolean().default(false),
  }),
});

// 2. Get payment methods schema
const getPaymentMethodsSchema = z.object({
  query: z.object({
    includeInactive: z
      .string()
      .transform((val) => val === 'true')
      .optional(),
  }),
});

// 3. Get payment method by ID schema
const getPaymentMethodByIdSchema = z.object({
  params: z.object({
    id: z
      .string({
        error: 'Payment method ID is required!',
      })
      .min(1, { message: 'Payment method ID is required!' }),
  }),
});

// 4. Set default payment method schema
const setDefaultPaymentMethodSchema = z.object({
  params: z.object({
    id: z
      .string({
        error: 'Payment method ID is required!',
      })
      .min(1, { message: 'Payment method ID is required!' }),
  }),
});

// 5. Delete payment method schema
const deletePaymentMethodSchema = z.object({
  params: z.object({
    id: z
      .string({
        error: 'Payment method ID is required!',
      })
      .min(1, { message: 'Payment method ID is required!' }),
  }),
});

// 6. Create setup intent schema (for collecting payment method)
const createSetupIntentSchema = z.object({
  body: z.object({
    // Only card payment method type is supported
  }).optional(),
});

export const PaymentMethodValidation = {
  addPaymentMethodSchema,
  getPaymentMethodsSchema,
  getPaymentMethodByIdSchema,
  setDefaultPaymentMethodSchema,
  deletePaymentMethodSchema,
  createSetupIntentSchema,
};

// Export types for TypeScript inference
export type TAddPaymentMethodPayload = z.infer<
  typeof addPaymentMethodSchema.shape.body
>;
export type TGetPaymentMethodsQuery = z.infer<
  typeof getPaymentMethodsSchema.shape.query
>;
export type TGetPaymentMethodByIdParams = z.infer<
  typeof getPaymentMethodByIdSchema.shape.params
>;
export type TSetDefaultPaymentMethodParams = z.infer<
  typeof setDefaultPaymentMethodSchema.shape.params
>;
export type TDeletePaymentMethodParams = z.infer<
  typeof deletePaymentMethodSchema.shape.params
>;
export type TCreateSetupIntentPayload = Record<string, never>; // Empty object for card-only payments

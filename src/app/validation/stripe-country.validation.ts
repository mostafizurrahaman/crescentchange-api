import z from 'zod';
import { isSupportedStripeCountry } from '../utils/currency.utils';

/** Required country for org signup — frontend sends country only; currency is derived server-side. */
export const stripeCountrySchema = z
  .string()
  .trim()
  .min(1, 'Country is required')
  .refine((val) => isSupportedStripeCountry(val), {
    message: 'Country is not supported for Stripe Connect on this platform',
  });

/** Optional country on profile update — cannot be cleared once set. */
export const optionalStripeCountrySchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (val) =>
      val === undefined ||
      (val.length > 0 && isSupportedStripeCountry(val)),
    {
      message:
        'Country is required and must be supported for Stripe Connect on this platform',
    }
  );

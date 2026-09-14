import { z } from 'zod';
import { STRIPE_SETTLEMENT_CURRENCIES } from '../utils/currency.utils';

export const preferredCurrencyZod = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => STRIPE_SETTLEMENT_CURRENCIES.includes(value), {
    message: `Unsupported display currency. Use one of: ${STRIPE_SETTLEMENT_CURRENCIES.join(', ')}`,
  });

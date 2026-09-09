import { z } from 'zod';

export const EMAIL_TEST_TYPES = [
  'otp',
  'receipt',
  'receipt-simple',
  'welcome',
  'contact',
  'reward',
] as const;

export const testEmailsSchema = z.object({
  body: z.object({
    to: z.string().email('A valid recipient email is required'),
    name: z.string().min(1).optional(),
  }),
});

import { z } from 'zod';

export const transactionFilterValidation = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(['pending', 'processed', 'processing', 'donated', 'failed']).optional(),
    bankConnection: z.string().optional(),
    organization: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2030).optional(),
  }),
});

export const transactionIdParamValidation = z.object({
  params: z.object({
    transactionId: z.string().min(1, 'Transaction ID is required'),
  }),
});

export const eligibleTransactionsValidation = z.object({
  query: z.object({
    startDate: z.string().datetime('Start date must be a valid datetime'),
    endDate: z.string().datetime('End date must be a valid datetime'),
    charityId: z.string().optional(),
  }),
});

export const retryFailedValidation = z.object({
  body: z.object({
    userId: z.string().optional(), // Optional: retry for specific user
  }),
});

export type TransactionFilterQuery = z.infer<typeof transactionFilterValidation>['query'];
export type TransactionIdParam = z.infer<typeof transactionIdParamValidation>['params'];
export type EligibleTransactionsQuery = z.infer<typeof eligibleTransactionsValidation>['query'];
export type RetryFailedBody = z.infer<typeof retryFailedValidation>['body'];

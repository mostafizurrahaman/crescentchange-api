import { z } from 'zod';

const GetTransactionsQuerySchema = z.object({
  page: z.string({
    errorMap: () => ({ message: 'Page must be a string number' }),
  }).optional().transform((val) => parseInt(val || '1', 10)),
  limit: z.string({
    errorMap: () => ({ message: 'Limit must be a string number' }),
  }).optional().transform((val) => parseInt(val || '20', 10)),
  startDate: z.string({
    errorMap: () => ({ message: 'Start date must be in YYYY-MM-DD format' }),
  }).optional(),
  endDate: z.string({
    errorMap: () => ({ message: 'End date must be in YYYY-MM-DD format' }),
  }).optional(),
  processed: z.string({
    errorMap: () => ({ message: 'Processed must be a string boolean' }),
  }).optional().transform((val) => val === 'true'),
  category: z.string().optional(),
  minAmount: z.number({
    errorMap: () => ({ message: 'Minimum amount must be a number' }),
  }).optional(),
  maxAmount: z.number({
    errorMap: () => ({ message: 'Maximum amount must be a number' }),
  }).optional(),
  searchTerm: z.string().optional(),
});

const CreateFromSyncSchema = z.object({
  bankConnectionId: z.string({
    required_error: 'Bank connection ID is required',
  }),
});

const ProcessTransactionsSchema = z.object({
  thresholdAmount: z.number({
    required_error: 'Threshold amount is required',
    invalid_type_error: 'Threshold amount must be a number',
  }).min(1, {
    message: 'Threshold amount must be at least 1',
  }),
});

const GetTransactionByIdSchema = z.object({
  id: z.string({
    required_error: 'Transaction ID is required',
  }),
});

const MarkProcessedSchema = z.object({
  donationId: z.string({
    required_error: 'Donation ID is required',
  }),
});

const CreateTransactionSchema = z.object({
  user: z.string({
    required_error: 'User ID is required',
  }),
  bankConnection: z.string({
    required_error: 'Bank connection ID is required',
  }),
  plaidTransaction: z.object({
    account_id: z.string(),
    amount: z.number(),
    category: z.array(z.string()).optional(),
    date: z.string(),
    location: z.object({
      address: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
    }).optional(),
    merchant_name: z.string().optional(),
    name: z.string(),
    pending: z.boolean(),
    transaction_id: z.string(),
    transaction_type: z.string(),
  }),
});

const UpdateTransactionSchema = z.object({
  processed: z.boolean().optional(),
  donationId: z.string().optional(),
  transactionDate: z.string().optional(),
  transactionDescription: z.string().optional(),
});

export const ROUNDUP_VALIDATION = {
  getTransactionsQuery: GetTransactionsQuerySchema,
  createFromSync: CreateFromSyncSchema,
  processTransactions: ProcessTransactionsSchema,
  getTransactionById: GetTransactionByIdSchema,
  markProcessed: MarkProcessedSchema,
  createTransaction: CreateTransactionSchema,
  updateTransaction: UpdateTransactionSchema,
};

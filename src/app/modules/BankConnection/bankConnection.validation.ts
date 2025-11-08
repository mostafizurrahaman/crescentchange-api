import { z } from 'zod';
import { TAccountType, TBankConnectionStatus } from './bankConnection.interface';

const LinkTokenCreateSchema = z.object({
  user_id: z.string().optional(), // Will be set from authenticated user
});

const ConnectBankSchema = z.object({
  public_token: z.string({
    required_error: 'Public token is required',
  }),
  institution_id: z.string().optional(),
  accounts: z.array(z.object({
    account_id: z.string(),
    name: z.string(),
    type: z.enum(['depository', 'credit', 'loan', 'investment', 'other']),
    subtype: z.string(),
    mask: z.string(),
  })).optional(),
});

const GetConnectionByIdSchema = z.object({
  id: z.string({
    required_error: 'Connection ID is required',
  }),
});

const SyncTransactionsSchema = z.object({
  connection_id: z.string({
    required_error: 'Connection ID is required',
  }),
  start_date: z.string({
    required_error: 'Start date is required',
  }).optional(),
  end_date: z.string({
    required_error: 'End date is required',
  }).optional(),
});

const DeleteConnectionSchema = z.object({
  id: z.string({
    required_error: 'Connection ID is required',
  }),
});

const UpdateConnectionSchema = z.object({
  id: z.string({
    required_error: 'Connection ID is required',
  }),
  consentStatus: z.enum(['active', 'expired', 'revoked', 'error']).optional(),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
});

const WebhookVerificationSchema = z.object({
  webhook_type: z.string({
    required_error: 'Webhook type is required',
  }),
  webhook_code: z.string({
    required_error: 'Webhook code is required',
  }),
  item_id: z.string({
    required_error: 'Item ID is required',
  }),
  error: z.object({
    error_code: z.string().optional(),
    error_message: z.string().optional(),
    display_message: z.string().optional(),
  }).optional(),
  new_transactions: z.number().optional(),
});

const GetConnectionsQuerySchema = z.object({
  page: z.string({
    errorMap: () => ({ message: 'Page must be a string number' }),
  }).optional().transform((val) => parseInt(val || '1', 10)),
  limit: z.string({
    errorMap: () => ({ message: 'Limit must be a string number' }),
  }).optional().transform((val) => parseInt(val || '20', 10)),
  status: z.enum(['active', 'expired', 'revoked', 'error']).optional(),
  account_type: z.enum(['depository', 'credit', 'loan', 'investment', 'other']).optional(),
});

const TransactionFilterSchema = z.object({
  start_date: z.string({
    errorMap: () => ({ message: 'Start date must be a string format YYYY-MM-DD' }),
  }).optional(),
  end_date: z.string({
    errorMap: () => ({ message: 'End date must be a string format YYYY-MM-DD' }),
  }).optional(),
  category: z.string().optional(),
  transaction_type: z.enum(['debit', 'credit']).optional(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
  search_term: z.string().optional(),
});

export const BANK_CONNECTION_VALIDATION = {
  createLinkToken: LinkTokenCreateSchema,
  connectBank: ConnectBankSchema,
  getConnectionById: GetConnectionByIdSchema,
  syncTransactions: SyncTransactionsSchema,
  deleteConnection: DeleteConnectionSchema,
  updateConnection: UpdateConnectionSchema,
  webhookVerification: WebhookVerificationSchema,
  getConnectionsQuery: GetConnectionsQuerySchema,
  transactionFilter: TransactionFilterSchema,
};

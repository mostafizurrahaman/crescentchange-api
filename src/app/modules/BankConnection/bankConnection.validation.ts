import { z } from 'zod';

export const createBankConnectionValidation = z.object({
  public_token: z.string().min(1, 'Public token is required'),
});

export const linkTokenRequestValidation = z.object({
  user: z.object({
    client_user_id: z.string().min(1, 'Client user ID is required'),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional(),
  }),
  account_filters: z
    .object({
      depository: z
        .object({
          account_subtypes: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const syncTransactionsValidation = z.object({
  bank_connection_id: z.string().min(1, 'Bank connection ID is required'),
  cursor: z.string().optional(),
  count: z.number().min(1).max(500).default(100),
});

export const revokeConsentValidation = z.object({
  bank_connection_id: z.string().min(1, 'Bank connection ID is required'),
});

export const updateBankConnectionValidation = z.object({
  isActive: z.boolean().optional(),
  consentExpiry: z.date().optional(),
});

export type CreateBankConnectionInput = z.infer<
  typeof createBankConnectionValidation
>;
export type LinkTokenRequestInput = z.infer<typeof linkTokenRequestValidation>;
export type SyncTransactionsInput = z.infer<typeof syncTransactionsValidation>;
export type RevokeConsentInput = z.infer<typeof revokeConsentValidation>;
export type UpdateBankConnectionInput = z.infer<
  typeof updateBankConnectionValidation
>;
